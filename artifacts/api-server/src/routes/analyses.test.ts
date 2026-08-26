import express from 'express';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import analysesRouter from './analyses';

const nativeFetch = globalThis.fetch;
const app = express();
app.use(express.json());
app.use(analysesRouter);

type ApiResponse = {
  id: number;
  status: string;
  input: {
    steps: Array<{ name: string; [key: string]: unknown }>;
    funnelGoal?: string;
    recentChanges?: string;
    additionalContext?: string;
  };
  ai: { hypotheses: string[] } | null;
  errorMessage: string | null;
  logic: {
    flaggedSteps: string[];
    hasAbnormalDropOff: boolean;
    steps: Array<{ name: string; [key: string]: unknown }>;
  };
};

const noFlagSteps = [
  { name: 'Landing page', order: 1, entered: 1_000, converted: 900, description: 'Viewed the page' },
  { name: 'Signup form', order: 2, entered: 900, converted: 810, description: 'Started signup' },
  { name: 'Welcome screen', order: 3, entered: 810, converted: 729, description: 'Reached the product' },
];

const flaggedSteps = [
  { name: 'Landing page', order: 1, entered: 1_000, converted: 900, description: 'Viewed the page' },
  { name: 'Checkout', order: 2, entered: 900, converted: 300, description: 'Started checkout' },
  { name: 'Confirmation', order: 3, entered: 300, converted: 270, description: 'Completed purchase' },
];

const aiResponse = {
  likely_causes: ['Possible payment friction'],
  hypotheses: ['A payment issue blocks checkout', 'A pricing concern causes abandonment'],
  missing_evidence: ['Payment error rate by method'],
  recommended_investigation: 'Compare checkout errors with successful payment attempts.',
  suggested_experiment: 'Expose the clearest payment error and measure recovery.',
  confidence: 'medium',
  reasoning: 'These are competing possibilities based on the flagged checkout evidence.',
};

async function postAnalysis(body: unknown) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a port');
    }
    return await nativeFetch(`http://127.0.0.1:${address.port}/analyses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function postRetry(id: number, body: unknown) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a port');
    }
    return await nativeFetch(`http://127.0.0.1:${address.port}/analyses/${id}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function getAnalysis(id: number) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a port');
    }
    return await nativeFetch(`http://127.0.0.1:${address.port}/analyses/${id}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function getAnalysisSummaries() {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a port');
    }
    return await nativeFetch(`http://127.0.0.1:${address.port}/analyses`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

async function readBody(response: Response): Promise<ApiResponse> {
  return await response.json() as ApiResponse;
}

describe('POST /analyses', () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const originalApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

  beforeEach(() => {
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = 'https://ai.test/v1';
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = 'test-key';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    } else {
      process.env.AI_INTEGRATIONS_OPENAI_BASE_URL = originalBaseUrl;
    }
    if (originalApiKey === undefined) {
      delete process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    } else {
      process.env.AI_INTEGRATIONS_OPENAI_API_KEY = originalApiKey;
    }
  });

  test('does not call the AI for a no-flag funnel and returns deterministic results', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock;

    const response = await postAnalysis({ steps: noFlagSteps });
    const body = await readBody(response);

    expect(response.status).toBe(201);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(body.status).toBe('no-flag');
    expect(body.ai).toBeNull();
    expect(body.errorMessage).toBeNull();
    expect(body.input.steps).toEqual(noFlagSteps);
    expect(body.logic.flaggedSteps).toEqual([]);
    expect(body.logic.steps[1]).toMatchObject({
      name: 'Signup form',
      conversionRate: 90,
      dropOffPercent: 10,
      usersLost: 90,
      isAbnormal: false,
    });
  });

  test('sends diagnostic context and supplied context to the AI', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const fetchMock = vi.fn(async (_input: unknown, init?: { body?: string }) => {
      requestBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(aiResponse) } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    globalThis.fetch = fetchMock;

    const response = await postAnalysis({
      steps: flaggedSteps,
      context: 'The payment provider migration launched last week.',
    });
    const body = await readBody(response);
    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    const evidence = JSON.parse(messages[1].content).diagnosticContext as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(body.status).toBe('ok');
    expect(body.ai?.hypotheses).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.keys(evidence)).toEqual([
      'funnelGoal',
      'allSteps',
      'flaggedSteps',
      'previousStep',
      'nextStep',
      'thresholdPercent',
      'usersEntered',
      'usersConverted',
      'usersLost',
      'conversionRate',
      'dropOffPercent',
      'sampleSize',
      'stepDescription',
      'recentChanges',
      'additionalContext',
    ]);
    expect(evidence.additionalContext).toBe('The payment provider migration launched last week.');
    expect(evidence.flaggedSteps).toEqual([{
      name: 'Checkout',
      order: 2,
      entered: 900,
      converted: 300,
      conversionRate: 33.33,
      dropOffPercent: 66.67,
      usersLost: 600,
      isAbnormal: true,
      stepDescription: 'Started checkout',
      sampleSize: 900,
      previousStep: expect.objectContaining({ name: 'Landing page' }),
      nextStep: expect.objectContaining({ name: 'Confirmation' }),
    }]);
  });

  test('retains deterministic results and exposes an error when the AI API fails', async () => {
    globalThis.fetch = vi.fn(async () => new Response('upstream unavailable', { status: 503 }));

    const response = await postAnalysis({ steps: flaggedSteps });
    const body = await readBody(response);

    expect(response.status).toBe(502);
    expect(body.status).toBe('api-error');
    expect(body.ai).toBeNull();
    expect(body.errorMessage).toBe('AI service returned HTTP 503');
    expect(body.input.steps).toEqual(flaggedSteps);
    expect(body.logic.flaggedSteps).toEqual(['Checkout']);
    expect(body.logic.steps[1]).toMatchObject({
      name: 'Checkout',
      isAbnormal: true,
      usersLost: 600,
    });
  });

  test('persists the loading state while hypothesis generation is in progress', async () => {
    let resolveAI: (response: Response) => void = () => {};
    const pendingResponse = new Promise<Response>((resolve) => {
      resolveAI = resolve;
    });
    const fetchMock = vi.fn(() => pendingResponse);
    globalThis.fetch = fetchMock;
    const beforeResponse = await getAnalysisSummaries();
    const before = await beforeResponse.json() as Array<{ id: number }>;
    const existingIds = new Set(before.map((analysis) => analysis.id));

    const analysisPromise = postAnalysis({ steps: flaggedSteps });
    for (let attempt = 0; attempt < 100 && fetchMock.mock.calls.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const summaries = await getAnalysisSummaries().then((response) => response.json()) as Array<{ id: number; status: string }>;
    const loadingSummary = summaries.find((analysis) => !existingIds.has(analysis.id) && analysis.status === 'loading');
    expect(loadingSummary).toBeDefined();

    resolveAI(new Response('upstream unavailable', { status: 503 }));
    const response = await analysisPromise;
    expect(response.status).toBe(502);
  });

  test('retains deterministic results and exposes an error for malformed AI JSON', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{not valid json' } }],
    }), { status: 200 }));

    const response = await postAnalysis({ steps: flaggedSteps });
    const body = await readBody(response);

    expect(response.status).toBe(502);
    expect(body.status).toBe('ai-parse-error');
    expect(body.ai).toBeNull();
    expect(body.errorMessage).toBe('AI service returned malformed JSON');
    expect(body.input.steps).toEqual(flaggedSteps);
    expect(body.logic.hasAbnormalDropOff).toBe(true);
    expect(body.logic.steps.map((step) => step.name)).toEqual([
      'Landing page',
      'Checkout',
      'Confirmation',
    ]);
  });

  test('retries a failed analysis using its saved logic and updates the same record', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('upstream unavailable', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(aiResponse) } }],
      }), { status: 200 }));
    globalThis.fetch = fetchMock;

    const initialResponse = await postAnalysis({
      steps: flaggedSteps,
      funnelGoal: 'Increase completed purchases',
      recentChanges: 'Checkout redesign launched last week',
      additionalContext: 'Payment errors are suspected',
    });
    const failedBody = await readBody(initialResponse);
    const reopenedBody = await getAnalysis(failedBody.id).then(readBody);
    const retryResponse = await postRetry(failedBody.id, {});
    const retriedBody = await readBody(retryResponse);

    expect(initialResponse.status).toBe(502);
    expect(retryResponse.status).toBe(200);
    expect(retriedBody.id).toBe(failedBody.id);
    expect(failedBody.input).toEqual({
      steps: flaggedSteps,
      funnelGoal: 'Increase completed purchases',
      recentChanges: 'Checkout redesign launched last week',
      additionalContext: 'Payment errors are suspected',
    });
    expect(reopenedBody.status).toBe('api-error');
    expect(reopenedBody.input).toEqual(failedBody.input);
    expect(retriedBody.status).toBe('ok');
    expect(retriedBody.errorMessage).toBeNull();
    expect(retriedBody.logic).toEqual(failedBody.logic);
    expect(retriedBody.ai?.hypotheses).toEqual(aiResponse.hypotheses);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const retryRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const retryContext = JSON.parse(retryRequest.messages[1].content).diagnosticContext;
    expect(retryContext.funnelGoal).toBe('Increase completed purchases');
    expect(retryContext.recentChanges).toBe('Checkout redesign launched last week');
    expect(retryContext.additionalContext).toBe('Payment errors are suspected');
  });
});