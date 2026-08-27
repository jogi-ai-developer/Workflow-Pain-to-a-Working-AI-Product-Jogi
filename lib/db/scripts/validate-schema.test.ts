import assert from "node:assert/strict";
import test from "node:test";
import {
  findSchemaDrift,
  type DatabaseColumn,
  type DatabaseConstraint,
  type DatabaseIndex,
  type DeclaredConstraint,
  type DeclaredForeignKey,
  type DeclaredIndex,
  type DeclaredTable,
} from "./validate-schema.ts";

const tableName = "orders";
const tableKey = `public.${tableName}`;

const declaredColumn = {
  name: "id",
  sqlType: "integer",
  notNull: true,
  hasDefault: false,
  primaryKey: true,
  unique: false,
  uniqueName: undefined,
};

const actualColumn: DatabaseColumn = {
  tableSchema: "public",
  tableName,
  columnName: declaredColumn.name,
  sqlType: declaredColumn.sqlType,
  isNullable: false,
  hasDefault: declaredColumn.hasDefault,
  isPrimaryKey: declaredColumn.primaryKey,
};

function declaredTable(overrides: Partial<DeclaredTable> = {}): DeclaredTable {
  return {
    schema: "public",
    name: tableName,
    columns: [declaredColumn],
    indexes: [],
    foreignKeys: [],
    constraints: [],
    ...overrides,
  };
}

function driftFor(
  table: DeclaredTable,
  indexes: DatabaseIndex[] = [],
  constraints: DatabaseConstraint[] = [],
): string[] {
  return findSchemaDrift([table], [actualColumn], indexes, constraints);
}

function declaredIndex(overrides: Partial<DeclaredIndex> = {}): DeclaredIndex {
  return {
    name: "orders_customer_id_idx",
    columns: ["customer_id"],
    unique: false,
    method: "btree",
    predicate: null,
    ...overrides,
  };
}

function actualIndex(overrides: Partial<DatabaseIndex> = {}): DatabaseIndex {
  return {
    tableSchema: "public",
    tableName,
    indexName: "orders_customer_id_idx",
    columns: ["customer_id"],
    unique: false,
    method: "btree",
    predicate: null,
    ...overrides,
  };
}

test("reports a missing index with its table and object name", () => {
  const drift = driftFor(declaredTable({ indexes: [declaredIndex()] }));

  assert.deepEqual(drift, [
    `table "${tableKey}" is missing index "orders_customer_id_idx"`,
  ]);
});

test("reports an unexpected index with its table and object name", () => {
  const drift = driftFor(declaredTable(), [
    actualIndex({
      indexName: "orders_created_at_idx",
      columns: ["created_at"],
    }),
  ]);

  assert.deepEqual(drift, [
    `table "${tableKey}" has unexpected index "orders_created_at_idx"`,
  ]);
});

function declaredForeignKey(
  overrides: Partial<DeclaredForeignKey> = {},
): DeclaredForeignKey {
  return {
    name: "orders_customer_id_fkey",
    columns: ["customer_id"],
    foreignSchema: "public",
    foreignTable: "customers",
    foreignColumns: ["id"],
    onUpdate: "no action",
    onDelete: "cascade",
    ...overrides,
  };
}

function actualForeignKey(
  overrides: Partial<DatabaseConstraint> = {},
): DatabaseConstraint {
  return {
    tableSchema: "public",
    tableName,
    constraintName: "orders_customer_id_fkey",
    type: "foreign",
    columns: ["customer_id"],
    foreignSchema: "public",
    foreignTable: "customers",
    foreignColumns: ["id"],
    onUpdate: "no action",
    onDelete: "cascade",
    expression: null,
    nullsNotDistinct: false,
    ...overrides,
  };
}

test("reports foreign-key reference drift with its table and object name", () => {
  const foreignKey = declaredForeignKey();
  const drift = driftFor(
    declaredTable({ foreignKeys: [foreignKey] }),
    [],
    [actualForeignKey({ foreignTable: "accounts" })],
  );

  assert.deepEqual(drift, [
    `table "${tableKey}" foreign-key constraint "orders_customer_id_fkey" ` +
      'references "public.accounts" (id), expected "public.customers" (id)',
  ]);
});

test("reports foreign-key action drift with its table and object name", () => {
  const foreignKey = declaredForeignKey();
  const drift = driftFor(
    declaredTable({ foreignKeys: [foreignKey] }),
    [],
    [
      actualForeignKey({
        onUpdate: "cascade",
        onDelete: "restrict",
      }),
    ],
  );

  assert.deepEqual(drift, [
    `table "${tableKey}" foreign-key constraint "orders_customer_id_fkey" ` +
      "uses ON UPDATE cascade, expected ON UPDATE no action",
    `table "${tableKey}" foreign-key constraint "orders_customer_id_fkey" ` +
      "uses ON DELETE restrict, expected ON DELETE cascade",
  ]);
});

function declaredCheck(
  overrides: Partial<DeclaredConstraint> = {},
): DeclaredConstraint {
  return {
    name: "orders_amount_check",
    type: "check",
    columns: [],
    expression: "amount >= 0",
    nullsNotDistinct: false,
    ...overrides,
  };
}

function actualCheck(
  overrides: Partial<DatabaseConstraint> = {},
): DatabaseConstraint {
  return {
    tableSchema: "public",
    tableName,
    constraintName: "orders_amount_check",
    type: "check",
    columns: [],
    foreignSchema: null,
    foreignTable: null,
    foreignColumns: [],
    onUpdate: null,
    onDelete: null,
    expression: "amount >= 0",
    nullsNotDistinct: false,
    ...overrides,
  };
}

test("reports check-constraint expression drift with its table and object name", () => {
  const constraint = declaredCheck();
  const drift = driftFor(
    declaredTable({ constraints: [constraint] }),
    [],
    [actualCheck({ expression: "amount > 0" })],
  );

  assert.deepEqual(drift, [
    `table "${tableKey}" check constraint "orders_amount_check" ` +
      'has expression "amount > 0", expected "amount >= 0"',
  ]);
});
