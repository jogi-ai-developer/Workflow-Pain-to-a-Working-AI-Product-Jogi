import { Router, type IRouter } from "express";
import {
  CreateAnalysisBody,
  RetryAnalysisBody,
  type Analysis,
  type AnalysisInput,
  type FunnelStepInput,
} from "@workspace/api-zod";
import { analysesTable, db } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();
const thresholdPercent = 40;
const staleLoadingThresholdMs = 60_000;

const aiResponseSchema = z.object({
  likely_causes: z.array(z.string().min(1)).min(1).max(3),
  hypotheses: z.array(z.string().min(1)).min(2).max(3),
  missing_evidence: z.array(z.string().min(1)).min(1).max(3),
  recommended_investigation: z.string().min(1),
  suggested_experiment: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  reasoning: z.string().min(1),
}).strict();

type StepResult = FunnelStepInput & {
  conversionRate: number;
  dropOffPercent: number;
  usersLost: number;
  isAbnormal: boolean;
  evidenceStrength: EvidenceStrength;
};

type EvidenceStrength = "high" | "medium" | "low" | "insufficient";

const minimumEvidenceSampleSize = 30;
const minimumEvidenceUsersLost = 10;
const strongEvidenceSampleSize = 1_000;
const strongEvidenceUsersLost = 500;

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function classifyEvidenceStrength(
  entered: number,
  usersLost: number,
  dropOffPercent: number,
): EvidenceStrength {
  if (entered < minimumEvidenceSampleSize || usersLost < minimumEvidenceUsersLost) {
    return "insufficient";
  }
  if (dropOffPercent >= thresholdPercent) {
    return entered >= strongEvidenceSampleSize || usersLost >= strongEvidenceUsersLost
      ? "high"
      : "medium";
  }
  return "low";
}

function calculateLogic(steps: FunnelStepInput[]) {
  const analyzedSteps: StepResult[] = steps.map((step) => {
    const conversionRate = step.entered === 0 ? 0 : (step.converted / step.entered) * 100;
    const dropOffPercent = step.entered === 0
      ? 0
      : ((step.entered - step.converted) / step.entered) * 100;
    const usersLost = step.entered - step.converted;
    const isAbnormal = dropOffPercent >= thresholdPercent;
    return {
      ...step,
      conversionRate: roundToTwoDecimals(conversionRate),
      dropOffPercent: roundToTwoDecimals(dropOffPercent),
      usersLost,
      isAbnormal,
      evidenceStrength: classifyEvidenceStrength(step.entered, usersLost, dropOffPercent),
    };
  });
  const flaggedSteps = analyzedSteps.filter((step) => step.isAbnormal).map((step) => step.name);
  const actionableSteps = analyzedSteps.filter(
    (step) => step.isAbnormal && step.evidenceStrength !== "insufficient",
  );
  const evidenceStrength: EvidenceStrength = flaggedSteps.length === 0
    ? analyzedSteps.every((step) => step.evidenceStrength === "insufficient") ? "insufficient" : "low"
    : analyzedSteps.some((step) => step.isAbnormal && step.evidenceStrength === "high")
      ? "high"
      : analyzedSteps.some((step) => step.isAbnormal && step.evidenceStrength === "medium")
        ? "medium"
        : actionableSteps.length > 0
          ? "low"
          : "insufficient";
  return {
    thresholdPercent,
    steps: analyzedSteps,
    flaggedSteps,
    hasAbnormalDropOff: flaggedSteps.length > 0,
    hasActionableDropOff: actionableSteps.length > 0,
    hasInsufficientEvidence: analyzedSteps.some(
      (step) => step.isAbnormal && step.evidenceStrength === "insufficient",
    ),
    evidenceStrength,
  };
}

function validateBusinessRules(steps: FunnelStepInput[]): string | null {
  if (new Set(steps.map((step) => step.order)).size !== steps.length) {
    return "Step orders must be unique";
  }
  const normalizedNames = steps.map((step) => step.name.trim().toLowerCase());
  if (new Set(normalizedNames).size !== normalizedNames.length) {
    return "Step names must be unique";
  }
  const invalidStep = steps.find((step) => step.converted > step.entered);
  if (invalidStep) return `Converted cannot exceed entered for "${invalidStep.name}"`;
  const orderedSteps = [...steps].sort((a, b) => a.order - b.order);
  for (let index = 1; index < orderedSteps.length; index += 1) {
    if (orderedSteps[index].entered > orderedSteps[index - 1].converted) {
      return `Users cannot increase between "${orderedSteps[index - 1].name}" and "${orderedSteps[index].name}"`;
    }
  }
  return null;
}

function toAiResult(result: z.infer<typeof aiResponseSchema>) {
  return {
    likelyCauses: result.likely_causes,
    hypotheses: result.hypotheses,
    missingEvidence: result.missing_evidence,
    suggestedInvestigation: result.recommended_investigation,
    recommendedInvestigation: result.recommended_investigation,
    suggestedExperiment: result.suggested_experiment,
    confidence: result.confidence,
    reasoning: result.reasoning,
  };
}

function normalizeInput(input: AnalysisInput): AnalysisInput {
  const additionalContext = input.additionalContext?.trim() || input.context?.trim();
  return {
    steps: input.steps,
    ...(input.funnelGoal?.trim() ? { funnelGoal: input.funnelGoal.trim() } : {}),
    ...(input.recentChanges?.trim() ? { recentChanges: input.recentChanges.trim() } : {}),
    ...(additionalContext ? { additionalContext } : {}),
  };
}

function addMissingDescriptions(body: unknown): unknown {
  if (!body || typeof body !== "object" || !Array.isArray((body as { steps?: unknown }).steps)) {
    return body;
  }
  return {
    ...(body as Record<string, unknown>),
    steps: (body as { steps: unknown[] }).steps.map((step) => {
      if (!step || typeof step !== "object" || "description" in step) return step;
      return { ...(step as Record<string, unknown>), description: "" };
    }),
  };
}

async function generateHypotheses(
  logic: ReturnType<typeof calculateLogic>,
  input: AnalysisInput,
) {
  const allSteps = logic.steps.map((step) => ({
    name: step.name,
    order: step.order,
    entered: step.entered,
    converted: step.converted,
    conversionRate: step.conversionRate,
    dropOffPercent: step.dropOffPercent,
    usersLost: step.usersLost,
    isAbnormal: step.isAbnormal,
    evidenceStrength: step.evidenceStrength,
    stepDescription: step.description,
    sampleSize: step.entered,
  }));

  const flaggedSteps = allSteps
    .filter((step) => step.isAbnormal)
    .map((step) => ({
      ...step,
      previousStep: allSteps.find((candidate) => candidate.order === step.order - 1) ?? null,
      nextStep: allSteps.find((candidate) => candidate.order === step.order + 1) ?? null,
    }));
  const primaryStep = flaggedSteps.reduce<(typeof flaggedSteps)[number] | null>(
    (largest, step) =>
      largest === null || step.dropOffPercent > largest.dropOffPercent ? step : largest,
    null,
  );
  const diagnosticContext = {
    funnelGoal: input.funnelGoal?.trim() || null,
    allSteps,
    flaggedSteps,
    previousStep: primaryStep?.previousStep ?? null,
    nextStep: primaryStep?.nextStep ?? null,
    thresholdPercent: logic.thresholdPercent,
    usersEntered: primaryStep?.entered ?? null,
    usersConverted: primaryStep?.converted ?? null,
    usersLost: primaryStep?.usersLost ?? null,
    conversionRate: primaryStep?.conversionRate ?? null,
    dropOffPercent: primaryStep?.dropOffPercent ?? null,
    sampleSize: primaryStep?.sampleSize ?? null,
    stepDescription: primaryStep?.stepDescription ?? null,
    recentChanges: input.recentChanges?.trim() || null,
    additionalContext: input.additionalContext?.trim() || input.context?.trim() || null,
    evidenceStrength: logic.evidenceStrength,
    hasInsufficientEvidence: logic.hasInsufficientEvidence,
  };
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Managed AI integration is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5.6-terra",
        max_completion_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an evidence-aware funnel analyst. Reason only from the supplied diagnosticContext JSON. Use allSteps to understand the surrounding funnel and use previousStep/nextStep to compare the flagged step with its neighbors. Treat funnelGoal, recentChanges, and additionalContext as user-supplied context, not verified facts. Never invent facts, numbers, segments, releases, or causal certainty. A drop-off is an observed signal, not proof of a cause. Return strict JSON with exactly these fields: likely_causes (array of 1 to 3 strings), hypotheses (array of 2 or 3 competing strings), missing_evidence (array of 1 to 3 strings), recommended_investigation (string), suggested_experiment (string), confidence (high, medium, or low), reasoning (string). Make missing evidence explicit and tie each hypothesis to the supplied evidence.",
          },
          { role: "user", content: JSON.stringify({ diagnosticContext }) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`AI service returned HTTP ${response.status}`);
    }
    const payload: unknown = await response.json();
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      throw new Error("AI service returned no JSON message");
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content);
    } catch {
      throw new Error("AI service returned malformed JSON");
    }
    const parsed = aiResponseSchema.safeParse(parsedJson);
    if (!parsed.success) {
      throw new Error("AI service returned an invalid hypothesis shape");
    }
    return toAiResult(parsed.data);
  } finally {
    clearTimeout(timeout);
  }
}

type StoredAnalysis = typeof analysesTable.$inferSelect;

function isStaleLoadingAnalysis(status: string, timestamp: string, now = Date.now()): boolean {
  if (status !== "loading") return false;
  const startedAt = Date.parse(timestamp);
  return Number.isFinite(startedAt) && now - startedAt >= staleLoadingThresholdMs;
}

function deserializeAnalysis(row: StoredAnalysis): Analysis {
  const steps = row.steps as Analysis["steps"];
  return {
    id: row.id,
    timestamp: row.timestamp,
    input: (row.input as Analysis["input"] | null) ?? { steps },
    steps,
    logic: row.logic as Analysis["logic"],
    ai: row.ai as Analysis["ai"],
    confidence: row.confidence as Analysis["confidence"],
    status: row.status as Analysis["status"],
    errorMessage: row.errorMessage,
    isStale: isStaleLoadingAnalysis(row.status, row.timestamp),
  };
}

async function saveAnalysis(
  input: AnalysisInput,
  logic: ReturnType<typeof calculateLogic>,
  ai: Analysis["ai"],
  status: Analysis["status"],
  errorMessage: string | null,
): Promise<Analysis> {
  const [row] = await db
    .insert(analysesTable)
    .values({
      timestamp: new Date().toISOString(),
      input,
      steps: input.steps,
      logic,
      ai,
      confidence: ai?.confidence ?? "low",
      status,
      errorMessage,
    })
    .returning();

  if (!row) {
    throw new Error("Failed to save analysis");
  }
  return deserializeAnalysis(row);
}

async function updateAnalysis(
  id: number,
  values: {
    input?: AnalysisInput;
    ai: Analysis["ai"];
    confidence: Analysis["confidence"];
    status: Analysis["status"];
    errorMessage: string | null;
  },
  expected?: {
    status: string;
    timestamp: string;
  },
): Promise<Analysis | null> {
  const [row] = await db
    .update(analysesTable)
    .set({
      ...(values.input ? { input: values.input, steps: values.input.steps } : {}),
      timestamp: new Date().toISOString(),
      ai: values.ai,
      confidence: values.confidence,
      status: values.status,
      errorMessage: values.errorMessage,
    })
    .where(
      and(
        eq(analysesTable.id, id),
        ...(expected
          ? [eq(analysesTable.status, expected.status), eq(analysesTable.timestamp, expected.timestamp)]
          : []),
      ),
    )
    .returning();
  return row ? deserializeAnalysis(row) : null;
}

function toSummary(analysis: Analysis) {
  return {
    id: analysis.id,
    timestamp: analysis.timestamp,
    flaggedSteps: analysis.logic.flaggedSteps,
    confidence: analysis.confidence,
    status: analysis.status,
    isStale: analysis.isStale,
  };
}

router.get("/analyses", async (_req, res) => {
  const rows = await db.select().from(analysesTable).orderBy(desc(analysesTable.id));
  const summaries = rows.map((row) => toSummary(deserializeAnalysis(row)));
  res.json(summaries);
});

router.post("/analyses", async (req, res): Promise<void> => {
  const parsed = CreateAnalysisBody.safeParse(addMissingDescriptions(req.body));
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const businessRuleError = validateBusinessRules(parsed.data.steps);
  if (businessRuleError) {
    res.status(400).json({ error: businessRuleError });
    return;
  }

  const input = normalizeInput(parsed.data);
  const logic = calculateLogic(input.steps);
  if (!logic.hasAbnormalDropOff) {
    res
      .status(201)
      .json(await saveAnalysis(input, logic, null, "no-flag", null));
    return;
  }
  if (!logic.hasActionableDropOff) {
    res
      .status(201)
      .json(await saveAnalysis(input, logic, null, "inconclusive", null));
    return;
  }

  const saved = await saveAnalysis(input, logic, null, "loading", null);
  try {
    const ai = await generateHypotheses(logic, input);
    const analysis = await updateAnalysis(saved.id, {
      ai,
      confidence: ai.confidence,
      status: "ok",
      errorMessage: null,
    }, {
      status: "loading",
      timestamp: saved.timestamp,
    });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.status(201).json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI service failure";
    const status = message.includes("malformed JSON") || message.includes("invalid hypothesis shape") || message.includes("no JSON message")
      ? "ai-parse-error"
      : "api-error";
    const analysis = await updateAnalysis(saved.id, {
      ai: null,
      confidence: "low",
      status,
      errorMessage: message,
    }, {
      status: "loading",
      timestamp: saved.timestamp,
    });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }
    res.status(502).json(analysis);
  }
});

router.post("/analyses/:id/retry", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const parsed = RetryAnalysisBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }

  const staleLoading = isStaleLoadingAnalysis(row.status, row.timestamp);
  if (
    row.status !== "api-error" &&
    row.status !== "ai-parse-error" &&
    !(row.status === "loading" && staleLoading)
  ) {
    res.status(400).json({
      error: row.status === "loading"
        ? "This investigation is still in progress. Retry is available if it becomes stale."
        : "Only failed or stale analyses can be retried",
    });
    return;
  }

  const logic = row.logic as ReturnType<typeof calculateLogic>;
  if (!logic.hasAbnormalDropOff) {
    res.status(400).json({ error: "Only analyses with flagged funnel steps can be retried" });
    return;
  }
  if (logic.hasActionableDropOff === false) {
    res.status(400).json({ error: "This analysis is inconclusive because the flagged sample is too small" });
    return;
  }

  const input = normalizeInput({
    steps: row.steps as AnalysisInput["steps"],
    ...(row.input as Partial<AnalysisInput> | null),
    ...parsed.data,
  });

  const loadingAnalysis = await updateAnalysis(id, {
    input,
    ai: null,
    confidence: "low",
    status: "loading",
    errorMessage: null,
  }, {
    status: row.status,
    timestamp: row.timestamp,
  });
  if (!loadingAnalysis) {
    res.status(409).json({ error: "This investigation is already being retried" });
    return;
  }

  try {
    const ai = await generateHypotheses(logic, input);
    const analysis = await updateAnalysis(id, {
      ai,
      confidence: ai.confidence,
      status: "ok",
      errorMessage: null,
    }, {
      status: "loading",
      timestamp: loadingAnalysis.timestamp,
    });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    res.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI service failure";
    const status = message.includes("malformed JSON") || message.includes("invalid hypothesis shape") || message.includes("no JSON message")
      ? "ai-parse-error"
      : "api-error";
    const analysis = await updateAnalysis(id, {
      ai: null,
      confidence: "low",
      status,
      errorMessage: message,
    }, {
      status: "loading",
      timestamp: loadingAnalysis.timestamp,
    });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    res.status(502).json(analysis);
  }
});

router.get("/analyses/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  const [row] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, id))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Analysis not found" });
    return;
  }
  res.json(deserializeAnalysis(row));
});

router.get("/admin/summary", async (_req, res) => {
  const rows = await db.select().from(analysesTable);
  const all = rows.map(deserializeAnalysis);
  res.json({
    totalAnalyses: all.length,
    confidenceCounts: {
      high: all.filter((analysis) => analysis.confidence === "high").length,
      medium: all.filter((analysis) => analysis.confidence === "medium").length,
      low: all.filter((analysis) => analysis.confidence === "low").length,
    },
    aiErrorCount: all.filter((analysis) => analysis.status === "api-error" || analysis.status === "ai-parse-error").length,
    recentAnalyses: all.sort((a, b) => b.id - a.id).slice(0, 10).map(toSummary),
  });
});

export default router;