import pg from "pg";
import { fileURLToPath } from "node:url";
import { is, SQL, Table } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import * as schema from "../src/schema/index.ts";

export type DeclaredColumn = {
  name: string;
  sqlType: string;
  notNull: boolean;
  hasDefault: boolean;
  primaryKey: boolean;
  unique: boolean;
  uniqueName: string | undefined;
};

export type DeclaredIndex = {
  name: string;
  columns: string[];
  unique: boolean;
  method: string;
  predicate: string | null;
};

export type DeclaredForeignKey = {
  name: string;
  columns: string[];
  foreignSchema: string;
  foreignTable: string;
  foreignColumns: string[];
  onUpdate: string;
  onDelete: string;
};

export type DeclaredConstraint = {
  name: string;
  type: "check" | "primary" | "unique";
  columns: string[];
  expression: string | null;
  nullsNotDistinct: boolean;
};

export type DeclaredTable = {
  schema: string;
  name: string;
  columns: DeclaredColumn[];
  indexes: DeclaredIndex[];
  foreignKeys: DeclaredForeignKey[];
  constraints: DeclaredConstraint[];
};

export type DatabaseColumn = {
  tableSchema: string;
  tableName: string;
  columnName: string;
  sqlType: string;
  isNullable: boolean;
  hasDefault: boolean;
  isPrimaryKey: boolean;
};

export type DatabaseIndex = {
  tableSchema: string;
  tableName: string;
  indexName: string;
  columns: string[];
  unique: boolean;
  method: string;
  predicate: string | null;
};

export type DatabaseConstraint = {
  tableSchema: string;
  tableName: string;
  constraintName: string;
  type: "check" | "foreign" | "primary" | "unique";
  columns: string[];
  foreignSchema: string | null;
  foreignTable: string | null;
  foreignColumns: string[];
  onUpdate: string | null;
  onDelete: string | null;
  expression: string | null;
  nullsNotDistinct: boolean;
};

const { Pool } = pg;
const DEFAULT_SCHEMA = "public";
const dialect = new PgDialect();

function tableKey(schemaName: string, tableName: string): string {
  return `${schemaName}.${tableName}`;
}

function normalizeSqlType(sqlType: string): string {
  const normalized = sqlType.toLowerCase().replace(/\s+/g, " ").trim();

  // PostgreSQL represents Drizzle's serial types as their underlying integer
  // type in pg_catalog, with the sequence expression stored as the default.
  return normalized
    .replace(/^smallserial$/, "smallint")
    .replace(/^serial$/, "integer")
    .replace(/^bigserial$/, "bigint");
}

function normalizeSqlFragment(fragment: string, tableName?: string): string {
  let normalized = fragment.toLowerCase().replace(/\s+/g, " ").trim();
  normalized = normalized.replace(/"/g, "");

  if (tableName) {
    const [schemaName, simpleTableName] = tableName.split(".");
    if (schemaName && simpleTableName) {
      normalized = normalized.replace(
        new RegExp(
          `\\b${schemaName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.${simpleTableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`,
          "g",
        ),
        "",
      );
      normalized = normalized.replace(
        new RegExp(
          `\\b${simpleTableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`,
          "g",
        ),
        "",
      );
    }
  }
  normalized = normalized.replace(
    /((?:'(?:''|[^'])*'))::(?:text|character varying)/g,
    "$1",
  );

  // PostgreSQL adds parentheses around check expressions in some catalog
  // versions. Strip only balanced outer pairs, preserving expression meaning.
  while (normalized.startsWith("(") && normalized.endsWith(")")) {
    let depth = 0;
    let wrapsWholeExpression = true;

    for (let index = 0; index < normalized.length; index += 1) {
      if (normalized[index] === "(") depth += 1;
      if (normalized[index] === ")") depth -= 1;
      if (depth === 0 && index < normalized.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
    }

    if (!wrapsWholeExpression) break;
    normalized = normalized.slice(1, -1).trim();
  }

  return normalized;
}

function columnNames(columns: Array<{ name: string }>): string[] {
  return columns.map((column) => column.name);
}

function sqlFragment(value: SQL, invokeSource?: "indexes"): string {
  return dialect.sqlToQuery(value, invokeSource).sql;
}

function indexColumnSql(column: unknown): string {
  if (is(column, SQL)) {
    return sqlFragment(column, "indexes");
  }

  if (
    typeof column !== "object" ||
    column === null ||
    !("name" in column) ||
    typeof column.name !== "string"
  ) {
    throw new Error(
      "Schema validation failed: unsupported declared index expression.",
    );
  }

  const indexedColumn = column as {
    name: string;
    indexConfig?: {
      order?: string;
      nulls?: string;
      opClass?: string;
    };
  };
  const config = indexedColumn.indexConfig;
  let result = dialect.escapeName(indexedColumn.name);

  if (config?.opClass) result += ` ${config.opClass}`;
  if (config?.order === "desc") result += " DESC";
  if (config?.nulls === "first") result += " NULLS FIRST";

  return result;
}

function indexColumnName(column: unknown, position: number): string {
  return typeof column === "object" &&
    column !== null &&
    "name" in column &&
    typeof column.name === "string"
    ? column.name
    : `expression${position + 1}`;
}

function constraintAction(action: string | undefined): string {
  return action ?? "no action";
}

function postgresTextArray(value: string[] | string): string[] {
  if (Array.isArray(value)) return value;
  if (value === "{}") return [];

  const contents =
    value.startsWith("{") && value.endsWith("}") ? value.slice(1, -1) : value;
  const result: string[] = [];
  let item = "";
  let quoted = false;
  let escaped = false;

  for (const character of contents) {
    if (escaped) {
      item += character;
      escaped = false;
    } else if (character === "\\") {
      escaped = true;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      result.push(item);
      item = "";
    } else {
      item += character;
    }
  }

  if (item.length > 0 || contents.endsWith(",")) result.push(item);
  return result;
}

function tableSchema(table: unknown): string {
  const config = getTableConfig(table as Parameters<typeof getTableConfig>[0]);
  return config.schema ?? DEFAULT_SCHEMA;
}

function declaredTables(): DeclaredTable[] {
  return Object.values(schema)
    .filter((value) => is(value, Table))
    .map((table) => {
      const config = getTableConfig(table);
      const tableSchemaName = config.schema ?? DEFAULT_SCHEMA;
      const indexes = config.indexes.map((index) => ({
        name:
          index.config.name ??
          `${config.name}_${index.config.columns
            .map((column, position) => indexColumnName(column, position))
            .join("_")}_index`,
        columns: index.config.columns.map(indexColumnSql),
        unique: index.config.unique,
        method: index.config.method ?? "btree",
        predicate: index.config.where ? sqlFragment(index.config.where) : null,
      }));
      const foreignKeys = config.foreignKeys.map((foreignKey) => {
        const reference = foreignKey.reference();
        return {
          name: reference.name ?? foreignKey.getName(),
          columns: columnNames(reference.columns),
          foreignSchema: tableSchema(reference.foreignTable),
          foreignTable: getTableConfig(reference.foreignTable).name,
          foreignColumns: columnNames(reference.foreignColumns),
          onUpdate: constraintAction(foreignKey.onUpdate),
          onDelete: constraintAction(foreignKey.onDelete),
        };
      });
      const constraints: DeclaredConstraint[] = [
        ...config.checks.map((check) => ({
          name: check.name,
          type: "check" as const,
          columns: [],
          expression: sqlFragment(check.value),
          nullsNotDistinct: false,
        })),
        ...config.uniqueConstraints.map((unique) => ({
          name:
            unique.getName() ??
            `${config.name}_${columnNames(unique.columns).join("_")}_unique`,
          type: "unique" as const,
          columns: columnNames(unique.columns),
          expression: null,
          nullsNotDistinct: unique.nullsNotDistinct,
        })),
        ...config.columns
          .filter((column) => column.isUnique)
          .map((column) => ({
            name: column.uniqueName ?? `${config.name}_${column.name}_unique`,
            type: "unique" as const,
            columns: [column.name],
            expression: null,
            nullsNotDistinct: false,
          })),
      ];
      const primaryKeyColumns =
        config.primaryKeys.length > 0
          ? config.primaryKeys.flatMap((primaryKey) => [
              {
                name: primaryKey.getName(),
                columns: columnNames(primaryKey.columns),
              },
            ])
          : config.columns.some((column) => column.primary)
            ? [
                {
                  name: `${config.name}_pkey`,
                  columns: config.columns
                    .filter((column) => column.primary)
                    .map((column) => column.name),
                },
              ]
            : [];
      constraints.push(
        ...primaryKeyColumns.map((primaryKey) => ({
          name: primaryKey.name,
          type: "primary" as const,
          columns: primaryKey.columns,
          expression: null,
          nullsNotDistinct: false,
        })),
      );

      return {
        schema: tableSchemaName,
        name: config.name,
        columns: config.columns.map((column) => ({
          name: column.name,
          sqlType: normalizeSqlType(column.getSQLType()),
          notNull: column.notNull,
          hasDefault: column.hasDefault,
          primaryKey: column.primary,
          unique: column.isUnique,
          uniqueName: column.uniqueName,
        })),
        indexes,
        foreignKeys,
        constraints,
      };
    });
}

async function databaseColumns(pool: pg.Pool): Promise<DatabaseColumn[]> {
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
    column_name: string;
    sql_type: string;
    is_nullable: boolean;
    has_default: boolean;
    is_primary_key: boolean;
  }>(`
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name,
      format_type(a.atttypid, a.atttypmod) AS sql_type,
      NOT a.attnotnull AS is_nullable,
      (ad.adbin IS NOT NULL OR a.attidentity <> '') AS has_default,
      EXISTS (
        SELECT 1
        FROM pg_index AS primary_index
        WHERE primary_index.indrelid = c.oid
          AND primary_index.indisprimary
          AND a.attnum = ANY(primary_index.indkey)
      ) AS is_primary_key
    FROM pg_attribute AS a
    INNER JOIN pg_class AS c ON c.oid = a.attrelid
    INNER JOIN pg_namespace AS n ON n.oid = c.relnamespace
    LEFT JOIN pg_attrdef AS ad
      ON ad.adrelid = a.attrelid
      AND ad.adnum = a.attnum
    WHERE c.relkind IN ('r', 'p')
      AND a.attnum > 0
      AND NOT a.attisdropped
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY n.nspname, c.relname, a.attnum
  `);

  return result.rows.map((row) => ({
    tableSchema: row.table_schema,
    tableName: row.table_name,
    columnName: row.column_name,
    sqlType: normalizeSqlType(row.sql_type),
    isNullable: row.is_nullable,
    hasDefault: row.has_default,
    isPrimaryKey: row.is_primary_key,
  }));
}

async function databaseIndexes(pool: pg.Pool): Promise<DatabaseIndex[]> {
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
    index_name: string;
    index_columns: string[];
    is_unique: boolean;
    method: string;
    predicate: string | null;
  }>(`
    SELECT
      table_namespace.nspname AS table_schema,
      table_relation.relname AS table_name,
      index_relation.relname AS index_name,
      ARRAY(
        SELECT pg_get_indexdef(index_info.indexrelid, key.ordinality + 1, true)
        FROM generate_subscripts(index_info.indkey, 1) AS key(ordinality)
        ORDER BY key.ordinality
      ) AS index_columns,
      index_info.indisunique AS is_unique,
      access_method.amname AS method,
      pg_get_expr(index_info.indpred, index_info.indrelid, true) AS predicate
    FROM pg_index AS index_info
    INNER JOIN pg_class AS table_relation
      ON table_relation.oid = index_info.indrelid
    INNER JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_relation.relnamespace
    INNER JOIN pg_class AS index_relation
      ON index_relation.oid = index_info.indexrelid
    INNER JOIN pg_am AS access_method
      ON access_method.oid = index_relation.relam
    WHERE table_relation.relkind IN ('r', 'p')
      AND NOT index_info.indisprimary
      AND NOT EXISTS (
        SELECT 1
        FROM pg_constraint AS constraint_info
        WHERE constraint_info.conindid = index_info.indexrelid
      )
    ORDER BY table_namespace.nspname, table_relation.relname, index_relation.relname
  `);

  return result.rows.map((row) => ({
    tableSchema: row.table_schema,
    tableName: row.table_name,
    indexName: row.index_name,
    columns: row.index_columns.map((column) => normalizeSqlFragment(column)),
    unique: row.is_unique,
    method: row.method,
    predicate:
      row.predicate === null ? null : normalizeSqlFragment(row.predicate),
  }));
}

function databaseConstraintType(
  type: string,
): DatabaseConstraint["type"] | null {
  switch (type) {
    case "c":
      return "check";
    case "f":
      return "foreign";
    case "p":
      return "primary";
    case "u":
      return "unique";
    default:
      return null;
  }
}

function databaseConstraintAction(action: string): string {
  switch (action) {
    case "c":
      return "cascade";
    case "d":
      return "set default";
    case "n":
      return "set null";
    case "r":
      return "restrict";
    case "a":
    default:
      return "no action";
  }
}

async function databaseConstraints(
  pool: pg.Pool,
): Promise<DatabaseConstraint[]> {
  const result = await pool.query<{
    table_schema: string;
    table_name: string;
    constraint_name: string;
    constraint_type: string;
    columns: string[];
    foreign_schema: string | null;
    foreign_table: string | null;
    foreign_columns: string[];
    on_update: string | null;
    on_delete: string | null;
    expression: string | null;
    nulls_not_distinct: boolean;
  }>(`
    SELECT
      table_namespace.nspname AS table_schema,
      table_relation.relname AS table_name,
      constraint_info.conname AS constraint_name,
      constraint_info.contype AS constraint_type,
      COALESCE((
        SELECT ARRAY_AGG(local_column.attname ORDER BY local_key.ordinality)
        FROM unnest(constraint_info.conkey) WITH ORDINALITY AS local_key(attnum, ordinality)
        INNER JOIN pg_attribute AS local_column
          ON local_column.attrelid = constraint_info.conrelid
          AND local_column.attnum = local_key.attnum
      ), ARRAY[]::text[]) AS columns,
      foreign_namespace.nspname AS foreign_schema,
      foreign_relation.relname AS foreign_table,
      COALESCE((
        SELECT ARRAY_AGG(foreign_column.attname ORDER BY foreign_key.ordinality)
        FROM unnest(constraint_info.confkey) WITH ORDINALITY AS foreign_key(attnum, ordinality)
        INNER JOIN pg_attribute AS foreign_column
          ON foreign_column.attrelid = constraint_info.confrelid
          AND foreign_column.attnum = foreign_key.attnum
      ), ARRAY[]::text[]) AS foreign_columns,
      constraint_info.confupdtype AS on_update,
      constraint_info.confdeltype AS on_delete,
      CASE
        WHEN constraint_info.contype = 'c'
        THEN pg_get_expr(constraint_info.conbin, constraint_info.conrelid, true)
        ELSE NULL
      END AS expression,
      CASE
        WHEN constraint_info.contype = 'u'
          AND pg_get_constraintdef(constraint_info.oid, true)
            ILIKE '%NULLS NOT DISTINCT%'
        THEN true
        ELSE false
      END AS nulls_not_distinct
    FROM pg_constraint AS constraint_info
    INNER JOIN pg_class AS table_relation
      ON table_relation.oid = constraint_info.conrelid
    INNER JOIN pg_namespace AS table_namespace
      ON table_namespace.oid = table_relation.relnamespace
    LEFT JOIN pg_class AS foreign_relation
      ON foreign_relation.oid = constraint_info.confrelid
    LEFT JOIN pg_namespace AS foreign_namespace
      ON foreign_namespace.oid = foreign_relation.relnamespace
    WHERE table_relation.relkind IN ('r', 'p')
      AND constraint_info.contype IN ('c', 'f', 'p', 'u')
    ORDER BY table_namespace.nspname, table_relation.relname, constraint_info.conname
  `);

  return result.rows.flatMap((row) => {
    const type = databaseConstraintType(row.constraint_type);
    if (!type) return [];

    return [
      {
        tableSchema: row.table_schema,
        tableName: row.table_name,
        constraintName: row.constraint_name,
        type,
        columns: postgresTextArray(row.columns),
        foreignSchema: row.foreign_schema,
        foreignTable: row.foreign_table,
        foreignColumns: postgresTextArray(row.foreign_columns),
        onUpdate:
          row.on_update === null
            ? null
            : databaseConstraintAction(row.on_update),
        onDelete:
          row.on_delete === null
            ? null
            : databaseConstraintAction(row.on_delete),
        expression:
          row.expression === null ? null : normalizeSqlFragment(row.expression),
        nullsNotDistinct: row.nulls_not_distinct,
      },
    ];
  });
}

function constraintsForTable(
  constraints: DatabaseConstraint[],
  table: DeclaredTable,
): DatabaseConstraint[] {
  return constraints.filter(
    (constraint) =>
      constraint.tableSchema === table.schema &&
      constraint.tableName === table.name,
  );
}

function indexesForTable(
  indexes: DatabaseIndex[],
  table: DeclaredTable,
): DatabaseIndex[] {
  return indexes.filter(
    (index) =>
      index.tableSchema === table.schema && index.tableName === table.name,
  );
}

function findNamedDrift<T extends { name: string }, U extends { name: string }>(
  expected: T[],
  actual: U[],
  label: string,
  tableKeyValue: string,
  compare: (expected: T, actual: U) => string[],
): string[] {
  const actualByName = new Map(actual.map((item) => [item.name, item]));
  const expectedNames = new Set(expected.map((item) => item.name));
  const drift: string[] = [];

  for (const expectedItem of expected) {
    const actualItem = actualByName.get(expectedItem.name);
    if (!actualItem) {
      drift.push(
        `table "${tableKeyValue}" is missing ${label} "${expectedItem.name}"`,
      );
      continue;
    }
    drift.push(...compare(expectedItem, actualItem));
  }

  for (const actualItem of actual) {
    if (!expectedNames.has(actualItem.name)) {
      drift.push(
        `table "${tableKeyValue}" has unexpected ${label} "${actualItem.name}"`,
      );
    }
  }

  return drift;
}

function compareIndex(
  expected: DeclaredIndex,
  actual: DatabaseIndex,
  tableKeyValue: string,
): string[] {
  const drift: string[] = [];
  const indexLabel = `table "${tableKeyValue}" index "${expected.name}"`;

  if (actual.unique !== expected.unique) {
    drift.push(
      `${indexLabel} is ${actual.unique ? "unique" : "not unique"}, ` +
        `expected ${expected.unique ? "unique" : "not unique"}`,
    );
  }
  if (actual.method !== expected.method) {
    drift.push(
      `${indexLabel} uses method "${actual.method}", expected "${expected.method}"`,
    );
  }
  if (
    actual.columns.length !== expected.columns.length ||
    actual.columns.some(
      (column, index) =>
        normalizeSqlFragment(column) !==
        normalizeSqlFragment(expected.columns[index]),
    )
  ) {
    drift.push(
      `${indexLabel} has columns (${actual.columns.join(", ")}), ` +
        `expected (${expected.columns.join(", ")})`,
    );
  }
  if (
    (actual.predicate === null
      ? null
      : normalizeSqlFragment(actual.predicate, tableKeyValue)) !==
    (expected.predicate === null
      ? null
      : normalizeSqlFragment(expected.predicate, tableKeyValue))
  ) {
    drift.push(
      `${indexLabel} has predicate ` +
        `${actual.predicate === null ? "none" : `"${actual.predicate}"`}, ` +
        `expected ${expected.predicate === null ? "none" : `"${expected.predicate}"`}`,
    );
  }

  return drift;
}

function compareConstraint(
  expected: DeclaredConstraint,
  actual: DatabaseConstraint,
  tableKeyValue: string,
): string[] {
  const drift: string[] = [];
  const constraintLabel = `table "${tableKeyValue}" ${expected.type} constraint "${expected.name}"`;

  if (actual.type !== expected.type) {
    drift.push(
      `${constraintLabel} is recorded as a ${actual.type} constraint, ` +
        `expected ${expected.type}`,
    );
    return drift;
  }

  if (
    actual.columns.length !== expected.columns.length ||
    actual.columns.some((column, index) => column !== expected.columns[index])
  ) {
    drift.push(
      `${constraintLabel} has columns (${actual.columns.join(", ")}), ` +
        `expected (${expected.columns.join(", ")})`,
    );
  }
  if (
    expected.type === "check" &&
    normalizeSqlFragment(actual.expression ?? "", tableKeyValue) !==
      normalizeSqlFragment(expected.expression ?? "", tableKeyValue)
  ) {
    drift.push(
      `${constraintLabel} has expression "${actual.expression}", ` +
        `expected "${expected.expression}"`,
    );
  }
  if (
    expected.type === "unique" &&
    actual.nullsNotDistinct !== expected.nullsNotDistinct
  ) {
    drift.push(
      `${constraintLabel} is ` +
        `${actual.nullsNotDistinct ? "" : "not "}NULLS NOT DISTINCT, ` +
        `expected ${expected.nullsNotDistinct ? "" : "not "}NULLS NOT DISTINCT`,
    );
  }

  return drift;
}

function compareForeignKey(
  expected: DeclaredForeignKey,
  actual: DatabaseConstraint,
  tableKeyValue: string,
): string[] {
  const drift: string[] = [];
  const constraintLabel = `table "${tableKeyValue}" foreign-key constraint "${expected.name}"`;

  if (actual.type !== "foreign") {
    drift.push(
      `${constraintLabel} is recorded as a ${actual.type} constraint, expected foreign`,
    );
    return drift;
  }

  if (
    actual.columns.join(",") !== expected.columns.join(",") ||
    actual.foreignSchema !== expected.foreignSchema ||
    actual.foreignTable !== expected.foreignTable ||
    actual.foreignColumns.join(",") !== expected.foreignColumns.join(",")
  ) {
    drift.push(
      `${constraintLabel} references ` +
        `"${actual.foreignSchema}.${actual.foreignTable}" ` +
        `(${actual.foreignColumns.join(", ")}), ` +
        `expected "${expected.foreignSchema}.${expected.foreignTable}" ` +
        `(${expected.foreignColumns.join(", ")})`,
    );
  }
  if (actual.onUpdate !== expected.onUpdate) {
    drift.push(
      `${constraintLabel} uses ON UPDATE ${actual.onUpdate}, ` +
        `expected ON UPDATE ${expected.onUpdate}`,
    );
  }
  if (actual.onDelete !== expected.onDelete) {
    drift.push(
      `${constraintLabel} uses ON DELETE ${actual.onDelete}, ` +
        `expected ON DELETE ${expected.onDelete}`,
    );
  }

  return drift;
}

export function findSchemaDrift(
  expectedTables: DeclaredTable[],
  actualColumns: DatabaseColumn[],
  actualIndexes: DatabaseIndex[] = [],
  actualConstraints: DatabaseConstraint[] = [],
): string[] {
  const actualByTable = new Map<string, Map<string, DatabaseColumn>>();

  for (const column of actualColumns) {
    const key = tableKey(column.tableSchema, column.tableName);
    const columns = actualByTable.get(key) ?? new Map<string, DatabaseColumn>();
    columns.set(column.columnName, column);
    actualByTable.set(key, columns);
  }

  const drift: string[] = [];

  for (const table of expectedTables) {
    const key = tableKey(table.schema, table.name);
    const actualColumnsForTable = actualByTable.get(key);

    if (!actualColumnsForTable) {
      drift.push(`missing table "${key}"`);
      continue;
    }

    const expectedColumnNames = new Set(
      table.columns.map((column) => column.name),
    );

    for (const column of table.columns) {
      const actualColumn = actualColumnsForTable.get(column.name);

      if (!actualColumn) {
        drift.push(`table "${key}" is missing column "${column.name}"`);
        continue;
      }

      if (actualColumn.sqlType !== column.sqlType) {
        drift.push(
          `table "${key}" column "${column.name}" has type "${actualColumn.sqlType}", ` +
            `expected "${column.sqlType}"`,
        );
      }
      if (actualColumn.isNullable === column.notNull) {
        drift.push(
          `table "${key}" column "${column.name}" is ` +
            `${actualColumn.isNullable ? "nullable" : "not nullable"}, ` +
            `expected ${column.notNull ? "not nullable" : "nullable"}`,
        );
      }
      if (actualColumn.hasDefault !== column.hasDefault) {
        drift.push(
          `table "${key}" column "${column.name}" ` +
            `${actualColumn.hasDefault ? "has" : "does not have"} a default, ` +
            `but the declared schema ${column.hasDefault ? "has" : "does not have"} one`,
        );
      }
      if (actualColumn.isPrimaryKey !== column.primaryKey) {
        drift.push(
          `table "${key}" column "${column.name}" ` +
            `${actualColumn.isPrimaryKey ? "is" : "is not"} a primary key, ` +
            `but the declared schema ${column.primaryKey ? "marks it as one" : "does not"}`,
        );
      }
    }

    for (const actualColumnName of actualColumnsForTable.keys()) {
      if (!expectedColumnNames.has(actualColumnName)) {
        drift.push(
          `table "${key}" has unexpected column "${actualColumnName}"`,
        );
      }
    }

    const actualIndexesForTable = indexesForTable(actualIndexes, table);
    drift.push(
      ...findNamedDrift(
        table.indexes,
        actualIndexesForTable.map((index) => ({
          name: index.indexName,
          index,
        })),
        "index",
        key,
        (expected, actual) => compareIndex(expected, actual.index, key),
      ),
    );

    const actualConstraintsForTable = constraintsForTable(
      actualConstraints,
      table,
    );
    const actualForeignKeys = actualConstraintsForTable
      .filter((constraint) => constraint.type === "foreign")
      .map((constraint) => ({
        name: constraint.constraintName,
        constraint,
      }));
    drift.push(
      ...findNamedDrift(
        table.foreignKeys,
        actualForeignKeys,
        "foreign-key constraint",
        key,
        (expected, actual) =>
          compareForeignKey(expected, actual.constraint, key),
      ),
    );

    const actualNamedConstraints = actualConstraintsForTable
      .filter((constraint) => constraint.type !== "foreign")
      .map((constraint) => ({
        name: constraint.constraintName,
        constraint,
      }));
    drift.push(
      ...findNamedDrift(
        table.constraints,
        actualNamedConstraints,
        "constraint",
        key,
        (expected, actual) =>
          compareConstraint(expected, actual.constraint, key),
      ),
    );
  }

  return drift;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Schema validation failed: DATABASE_URL must be set to the configured PostgreSQL database.",
    );
  }

  const expectedTables = declaredTables();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const [actualColumns, actualIndexes, actualConstraints] = await Promise.all(
      [databaseColumns(pool), databaseIndexes(pool), databaseConstraints(pool)],
    );
    const drift = findSchemaDrift(
      expectedTables,
      actualColumns,
      actualIndexes,
      actualConstraints,
    );

    if (drift.length > 0) {
      throw new Error(
        [
          "Schema validation failed: database schema drift detected.",
          ...drift.map((issue) => `- ${issue}`),
          "Run `pnpm --filter @workspace/db run push` after reviewing the schema change.",
        ].join("\n"),
      );
    }

    console.log(
      `Schema validation passed: ${expectedTables.length} declared table(s), ` +
        `${actualIndexes.length} index(es), and ${actualConstraints.length} ` +
        `constraint(s) match the configured database.`,
    );
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
