import { Router, type IRouter } from "express";
import {
  GenerateHypothesesBody,
  GenerateHypothesesResponse,
} from "@workspace/api-zod";
import { openai } from "../lib/openai";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are an evidence-aware funnel diagnostic assistant.
You receive only deterministic calculations for steps already flagged by a visible threshold.
Never claim to know the true cause. Never invent releases, segments, user behavior, numbers, or evidence that was not supplied.
Describe all explanations as hypotheses or possibilities. Treat evidence strength as distinct from causal certainty.
Return JSON only, matching this exact shape:
{
  "likelyCauses": ["1 to 3 concise possible causes tied to the supplied step evidence"],
  "hypotheses": ["2 to 3 competing, non-overlapping hypotheses"],
  "missingEvidence": ["1 to 3 specific checks that could distinguish between the hypotheses"],
  "suggestedInvestigation": "one focused next investigation",
  "suggestedExperiment": "one bounded experiment tied to a hypothesis",
  "confidence": "high, medium, or low",
  "reasoning": "brief explanation that only references the supplied calculations and explicitly states uncertainty"
}`;

function extractJson(content: string): unknown {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return JSON.parse(fenced?.[1] ?? trimmed);
}

router.post("/hypotheses", async (req, res): Promise<void> => {
  const body = GenerateHypothesesBody.safeParse(req.body);

  if (!body.success) {
    req.log.warn({ errors: body.error.flatten() }, "Invalid hypothesis request");
    res.status(400).json({ error: "The flagged funnel evidence is invalid." });
    return;
  }

  if (body.data.flaggedSteps.some((step) => !step.isAbnormal)) {
    req.log.warn("Hypothesis request included an unflagged step");
    res.status(400).json({ error: "AI reasoning requires only flagged funnel steps." });
    return;
  }

  const evidence = {
    thresholdPercent: body.data.thresholdPercent,
    flaggedSteps: body.data.flaggedSteps,
  };

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.6-luna",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Generate an evidence-aware diagnostic from this JSON. Do not use information outside it.\n${JSON.stringify(evidence)}`,
        },
      ],
    });
    const content = completion.choices[0]?.message.content;

    if (!content) {
      req.log.warn("AI hypothesis response was empty");
      res.status(422).json({
        error: "The AI response was empty, so no hypotheses were shown.",
      });
      return;
    }

    let candidate: unknown;
    try {
      candidate = extractJson(content);
    } catch {
      req.log.warn("AI hypothesis response was not valid JSON");
      res.status(422).json({
        error: "The AI response could not be read safely, so deterministic results remain unchanged.",
      });
      return;
    }

    const response = GenerateHypothesesResponse.safeParse(candidate);
    if (!response.success) {
      req.log.warn(
        { errors: response.error.flatten() },
        "AI hypothesis response failed validation",
      );
      res.status(422).json({
        error: "The AI response did not meet the evidence-aware format, so deterministic results remain unchanged.",
      });
      return;
    }

    res.json(response.data);
  } catch (error) {
    req.log.error({ err: error }, "AI hypothesis generation failed");
    res.status(502).json({
      error: "AI hypotheses are unavailable right now. Your deterministic analysis is still available.",
    });
  }
});

export default router;