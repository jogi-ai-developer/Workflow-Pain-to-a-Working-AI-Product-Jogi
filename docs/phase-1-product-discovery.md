# Phase 1 — Product Discovery

## Product context

This project is part of the “Workflow Pain to a Working AI Product” assignment. It
explores Track 3 — Marketing & Growth.

The product is not intended to be an autonomous funnel optimizer or a system that
knows the true cause of a conversion drop. It is a diagnostic decision-support
tool:

> Data tells us where the problem is. Logic determines whether the drop is
> meaningful. AI helps reason about why it might be happening. A human decides
> what to do.

All statements about the user, current workflow, and value in this document are
working hypotheses unless explicitly marked as observed product behavior. No
customer interviews, surveys, or external validation are being claimed here.

## 1. Problem statement

### Who has the problem?

The primary user is a Growth Manager or Product Manager responsible for
understanding and improving a product funnel.

### What are they trying to do?

They are trying to diagnose a meaningful conversion drop and determine what to
investigate next. A useful outcome is not merely a percentage; it is a defensible
next step such as checking a release, validating instrumentation, comparing a
segment, reviewing a user journey, or designing one experiment.

### Trigger moment

A funnel report shows a sharp drop at one step, but the dashboard does not explain
what might be behind it. The manager needs to turn an observed symptom into a
short, evidence-aware investigation plan.

### What happens today?

The exact process varies by team, analytics maturity, and urgency. A plausible
workflow is:

1. Review analytics.
2. Identify a funnel drop.
3. Inspect individual steps.
4. Compare metrics.
5. Look at segments and surrounding context.
6. Check recent product changes.
7. Form hypotheses.
8. Decide what to investigate.
9. Decide what experiment to run.

Some users will skip, reorder, or add steps. For example, an experienced analyst
may start with SQL or a release timeline, while a smaller team may start with a
dashboard and a conversation with an engineer.

### Where the workflow becomes difficult

The arithmetic is usually not the hardest part. The difficult transition is from
“this step is lower than expected” to “these are the most useful explanations to
check next.” Relevant context is distributed across analytics, product changes,
segments, instrumentation knowledge, session evidence, and conversations with
other teams. The manager must synthesize those signals under time pressure without
turning a plausible story into an asserted fact.

### Pain

| Layer | Definition |
|---|---|
| Observable symptom | A funnel step shows a material drop in users or conversion compared with the preceding step. |
| Underlying problem | The manager lacks a fast, structured way to distinguish a meaningful behavioral signal from a data-quality issue and to turn the signal into competing, evidence-aware hypotheses. |
| Consequence | Investigation time increases, cross-functional questions are less focused, and the team may prioritize an attractive explanation before checking whether the evidence supports it. |

This is more specific than “users struggle with analytics.” The pain is the
reasoning gap between a visible funnel symptom and a trustworthy next action.

## 2. User persona

### Primary persona: growth manager at a product-led company

- **Role:** Growth Manager or Product Manager who owns conversion improvement for a
  product journey.
- **Responsibilities:** Monitor funnel performance, identify meaningful changes,
  coordinate investigations, prioritize experiments, and communicate recommendations
  to product, engineering, design, or marketing partners.
- **Goals:** Find the highest-signal problem, understand what evidence is missing,
  avoid wasting engineering time, and move from observation to an actionable
  investigation or test.
- **Tools:** An analytics or funnel product, dashboards, spreadsheets, SQL
  queries when available, release notes, ticketing or documentation systems, and
  communication with engineers and product teammates. The exact stack is an
  assumption to validate.
- **Technical/data literacy:** Comfortable interpreting conversion rates, trends,
  cohorts, and segments; may be able to write or request SQL, but should not need
  to be a data engineer to use the diagnostic. This is an assumption, not a
  research finding.
- **Workflow:** Reviews a recurring dashboard or an alert, drills into a funnel
  step, gathers context from adjacent systems and people, forms hypotheses, then
  proposes investigation and experimentation work.
- **Frustrations:** Data is split across places; a sharp drop can be caused by
  behavior, product changes, traffic mix, or broken instrumentation; and a
  plausible explanation can be mistaken for a proven one.
- **Decision-making responsibilities:** Chooses what to investigate next, frames
  questions for partners, and recommends experiments. They do not necessarily
  control engineering implementation or final rollout decisions.
- **Desired outcome:** A concise diagnostic that makes the flagged step and its
  evidence visible, names uncertainty and missing context, and recommends one
  practical next investigation or experiment.

### Why this is the correct primary user

This persona experiences the full workflow gap: they own the business outcome but
often need to combine quantitative data with context held by other people or
systems. They also have authority to act on a recommendation, unlike a viewer who
only consumes a dashboard. The scope intentionally does not assume a dedicated
data scientist is available.

### Assumptions to validate later

1. Growth and product managers routinely receive funnel data as step-level counts
   or can export counts into a lightweight tool.
2. The bottleneck is prioritizing and framing investigation, not calculating a
   basic conversion rate.
3. Users will provide short step descriptions or contextual notes when prompted.
4. A structured “next thing to check” is useful even when a root cause cannot be
   established.

## 3. Jobs to be done

### Core JTBD

> When I see a meaningful drop in a funnel step and do not yet know why, I want to
> separate a real signal from a data problem and generate evidence-aware
> hypotheses with a clear next investigation, so that I can focus the team on the
> most useful action without presenting a guess as the cause.

### Functional job

Identify where a funnel loses users, assess whether the loss is large enough to
deserve attention, provide relevant context, compare competing explanations, and
select one next investigation or experiment.

### Emotional job

Feel confident that the recommendation is grounded in the numbers and honest
about uncertainty, rather than feeling pressure to defend an unsupported story in
front of colleagues.

### Professional/social job

Show disciplined analytical judgment: communicate a clear problem, ask focused
questions of partner teams, and make a recommendation that is useful to an
experiment or planning discussion.

### Why this is more useful than “Analyze my funnel.”

“Analyze my funnel” hides the desired decision and invites a generic summary. This
JTBD states the trigger, the uncertainty, and the outcome. It also creates a
boundary for the product: the tool should help the user decide what to check next,
not claim that an LLM has discovered causality.

## 4. Current alternatives

The descriptions below are workflow hypotheses, not a claim that every listed
product has every capability or that every customer uses it the same way.

### Mixpanel and Amplitude

Teams may use funnel and behavioral analytics products to inspect conversion
between events, compare time periods, and explore segments where configured. They
are good places to locate the step and quantify the symptom. The workflow can still
break when context about releases, implementation details, user intent, or
instrumentation quality is outside the analytics view. The manager may have to
manually connect those signals and turn them into a short investigation plan.

### Google Analytics

Teams may use Google Analytics for traffic, acquisition, and product behavior
questions depending on their setup and event implementation. It can provide
valuable measurement, but a manager may still need to reconcile event definitions,
product context, data quality, and experiment planning across separate workflows.
Exact reports and capabilities depend on configuration and should be validated
before product claims are made.

### SQL

SQL gives experienced teams precise, inspectable control over the data. It is
useful for custom definitions and deeper slices. It can be slow for non-SQL users,
dependent on trustworthy schemas, and focused on retrieving numbers rather than
explaining which investigation should come next.

### Spreadsheets

Spreadsheets are flexible for copying counts, calculating rates, adding notes, and
sharing a lightweight working analysis. They become fragile when formulas,
definitions, context, and evidence are maintained manually or when the same
analysis must be repeated.

### Dashboards

Dashboards make recurring metrics easy to monitor and create a shared reference
point. They can still leave the reasoning step to the manager: a dashboard can
show what changed without making uncertainty, missing evidence, or the next
investigation explicit.

### Session recordings

Where a team has session-replay or recording tools, individual journeys may help
generate qualitative clues. Recordings are not a substitute for checking event
definitions, sample sufficiency, segment differences, or the scale of a pattern.
Reviewing them can also be time-consuming and should follow a well-framed question.

### Talking to engineers and product teams

Partners often hold important context about releases, bugs, feature flags,
instrumentation, and intended behavior. This is a necessary complement to metrics,
but it is interrupt-driven and depends on the quality of the question the manager
brings.

### Manual analysis

Manual analysis combines the alternatives above and is often the real current
state. It works for high-attention investigations and expert users, but it is
inconsistent, difficult to reproduce, and vulnerable to anchoring on the first
plausible explanation.

### What existing tools do well

Existing tools can help teams measure, segment, query, visualize, and inspect user
behavior when data is configured correctly. They provide the raw material needed
to locate a drop and investigate it.

### Where the workflow still breaks

The break is not simply a lack of an AI button. It is the handoff between:

1. a quantified signal,
2. context that may be distributed across systems and people,
3. a set of competing hypotheses,
4. an explicit statement of missing evidence, and
5. a decision about what to investigate or test next.

### Product opportunity

Provide a small, inspectable reasoning layer on top of user-supplied funnel data.
The tool should calculate and explain the signal deterministically, then use AI
only to organize possible explanations and next actions from the flagged evidence
and supplied context. Its value is a faster, more disciplined diagnostic handoff,
not replacing an analytics platform or adding AI for its own sake.

## 5. Why AI?

AI is useful after deterministic analysis has established that a step deserves
attention. It can help with work that is language-heavy and context-dependent:

- synthesize several flagged steps, descriptions, and calculated signals;
- generate two or three competing hypotheses rather than anchoring on one story;
- explain why each hypothesis might fit the supplied evidence;
- identify evidence that is missing or would discriminate between hypotheses;
- suggest a focused investigation;
- suggest one experiment that tests a stated hypothesis.

### Critical evaluation

| Potential responsibility | Keep in MVP? | Reason |
|---|---:|---|
| Synthesize contextual signals | Yes | This is a language-and-context task after the logic layer has narrowed the input. |
| Generate competing hypotheses | Yes | Multiple hypotheses reduce premature commitment to one explanation. |
| Explain possible causes | Yes, carefully | The wording must remain “possible” and reference only supplied evidence. |
| Identify missing evidence | Yes | Explicit uncertainty is a core trust feature. |
| Suggest investigations | Yes | This converts analysis into a concrete next action. |
| Suggest experiments | Yes, one | A bounded experiment makes the output actionable without promising causal certainty. |
| Calculate funnel metrics | No | Deterministic code is more reliable, auditable, and cheaper. |
| Decide whether a drop crosses a threshold | No | The rule should be visible and consistent. |
| Claim the true causal reason | No | The supplied funnel data cannot establish causality on its own. |

The system prompt must define a fixed role: the AI is a funnel analyst that only
reasons from the provided data, explicitly says when evidence is insufficient, and
never invents numbers or facts.

## 6. What should not use AI?

The following responsibilities belong in deterministic code:

- input validation;
- data validation and consistency checks;
- conversion calculation;
- drop-off calculation;
- users-lost calculation;
- identifying the largest drop;
- threshold checks;
- sample-size sufficiency checks;
- identifying diagnostic signals;
- determining whether any step is abnormal;
- deciding whether an AI call is necessary;
- computing a rule-based evidence-strength component.

These operations have defined inputs and reliable formulas. Deterministic code is
more transparent to inspect, easier to test against known examples, cheaper to
run, and less likely to produce a confident arithmetic error.

> If the answer can be reliably calculated with deterministic code, do not ask an
> LLM to calculate it.

## 7. Logic vs AI

| Task | Deterministic Logic | AI | Why |
|---|---|---|---|
| Input validation | Yes | No | Reject invalid or incomplete structures before analysis. |
| Conversion calculation | Yes | No | A formula is exact and auditable. |
| Drop-off calculation | Yes | No | A formula is exact and auditable. |
| Abnormal-drop detection | Yes | No | A visible threshold creates consistent behavior. |
| Sample-size sufficiency | Yes | No | Guardrails should not vary with wording. |
| Critical-step identification | Yes | No | Rank by calculated signal such as users lost or drop-off. |
| Hypothesis generation | No | Yes | Generate competing language-based explanations from constrained evidence. |
| Hypothesis ranking | Partly | Yes, constrained | Logic can prioritize signals; AI can explain relative fit, but must not turn fit into causality. |
| Evidence explanation | Partly | Yes | Logic supplies the facts; AI explains their relevance in plain language. |
| Confidence | Partly | Yes, constrained | Logic supplies evidence strength; AI supplies a stated qualitative confidence that is never treated as proof. |
| Investigation recommendation | No | Yes, constrained | The AI can turn missing evidence into a focused check. |
| Experiment recommendation | No | Yes, constrained | The AI can propose one test tied to a hypothesis and measurable outcome. |

### Structured input sent to the LLM

Only send the minimum necessary JSON:

```json
{
  "flagged_steps": [
    {
      "step_name": "Checkout",
      "step_order": 3,
      "entered_users": 2000,
      "converted_users": 150,
      "conversion_rate_percent": 7.5,
      "drop_off_percent": 92.5,
      "users_lost": 1850,
      "description": "Completed checkout"
    }
  ],
  "threshold_percent": 40,
  "sample_size_flags": [],
  "data_quality_flags": []
}
```

The real implementation may use equivalent field names, but it must not send
unflagged steps, unrelated user data, hidden prompts, or invented context. The
AI response must be strict JSON with:

```json
{
  "likely_causes": ["string"],
  "hypotheses": ["2-3 strings"],
  "suggested_experiment": "string",
  "confidence": "high|medium|low",
  "reasoning": "string"
}
```

The response must also make missing evidence explicit, either in `reasoning` or a
future structured field if that becomes necessary.

## 8. Product hypothesis

> If we provide a lightweight diagnostic that visibly separates calculated
> funnel signals from AI-generated, evidence-aware hypotheses and next actions,
> then growth and product managers will be able to move from a suspicious drop to
> a focused investigation faster and with less unjustified certainty, because the
> tool reduces the reasoning handoff while keeping the numbers and uncertainty
> inspectable.

### Assumptions

1. Users can provide or export step-level counts.
2. A short description per step adds meaningful context.
3. Users value competing hypotheses and missing-evidence prompts.
4. A recommendation for what to investigate next is more useful than another
   generic summary.
5. Users will trust the tool more when deterministic calculations are visible.

### Risks

- A fixed threshold may over-flag normal funnel behavior.
- Small samples can produce dramatic-looking percentages.
- Poor instrumentation can look like user behavior.
- Generic AI output may not help the manager decide anything.
- Users may interpret “high confidence” as causal certainty.
- The manual-input MVP may not fit a team’s existing workflow.

### Riskiest assumption

The riskiest assumption is that a constrained, text-based diagnostic can produce a
more useful next investigation than the manager’s current combination of
dashboard review and conversations with partner teams. The prototype can test
this through manual walkthroughs using representative but clearly labeled sample
funnels: ask whether the flagged signal is understandable, whether the hypotheses
are distinct and evidence-linked, and whether the recommended next step changes
what the user would do.

This is a usability test plan, not evidence that validation has already happened.

## 9. Failure mode analysis

The primary failure mode is a **generic or unjustified diagnosis**: the tool
produces a plausible-sounding explanation that is not supported by the supplied
data or does not help the user decide what to do next.

| Failure Mode | Cause | User Impact | Prevention | Detection | Product Response |
|---|---|---|---|---|---|
| Generic or unjustified diagnosis | Broad prompt, too little context, or no evidence grounding | User wastes time or repeats an unsupported story | Send only flagged evidence; require reasoning and hypotheses; forbid invented facts | Review whether every claim maps to an input signal | Show “Diagnosis inconclusive” or request more context. |
| False diagnosis | Correlation or a single drop is treated as the cause | Team investigates the wrong problem | Use “possible cause” language and competing hypotheses | Human checks evidence-to-claim links | State that the cause is unconfirmed and recommend discriminating evidence. |
| AI overconfidence | Model returns high confidence despite weak context | User over-trusts the result | Blend evidence strength with context and treat AI confidence as one input only | Compare confidence against sample/context guardrails | Cap or lower confidence; show the evidence limitation. |
| Insufficient sample size | A small count creates a large percentage change | Noisy data leads to a false priority | Deterministic minimum-sample flag | Check counts before threshold interpretation | Do not call AI; return an inconclusive state with the reason. |
| Instrumentation/data-quality problem | Missing, duplicated, reordered, or inconsistent events | Product behavior is blamed for broken measurement | Validate monotonic funnel counts and show data-quality warnings | Counts, event descriptions, and known signal checks | Recommend validating instrumentation before behavioral investigation. |
| Correlation presented as causation | A hypothesis is worded as a fact | Team makes an unjustified product decision | Fixed system prompt and UI labels such as “hypothesis” | Scan output and inspect user-facing labels | Rewrite or reject unsupported output; preserve only logic results. |
| Generic recommendations | AI suggests “talk to users” or “run an A/B test” without a link to the signal | No clear next action | Require a specific investigation and one bounded experiment | Check that the recommendation names a flagged step and evidence | Mark output low-confidence or inconclusive. |
| AI inventing evidence | Model adds a release, segment, number, or behavior not supplied | Trust and decision quality are damaged | Explicit no-invention prompt; constrained JSON input | Parse and compare referenced numbers against input | Store `ai_parse_error` or reject unsupported output and show logic results. |
| Over-flagging healthy steps | Threshold is too low or ignores sample/context | Alert fatigue and reduced trust | Configurable threshold plus sample and quality checks | Review false-positive examples | Explain why the threshold fired and allow the user to treat it as inconclusive. |

## 10. Inconclusive state

The product must be allowed to say:

> Diagnosis inconclusive.

This should happen when:

- sample size is too small for a meaningful interpretation;
- step descriptions or surrounding context are insufficient;
- evidence conflicts across signals;
- there is no meaningful abnormality;
- monotonic counts or event definitions suggest an instrumentation issue;
- the data supports several hypotheses without a useful discriminator;
- the AI service fails or returns malformed output;
- the AI cannot justify a hypothesis from the supplied data.

When there is no meaningful abnormality, the product should say that no
significant drop-off was detected rather than manufacture an explanation. When an
abnormality exists but evidence is weak, “Diagnosis inconclusive” is better than
a polished guess because it tells the user what the system does not know and
protects the next decision from false certainty.

## 11. Confidence

Confidence is a qualitative label for the **strength of evidence supporting a
hypothesis**, not the probability that the hypothesis is definitely the cause.

- **High:** A large, clearly calculated signal, sufficient sample, useful step
  context, and an AI explanation that stays close to the supplied evidence.
- **Medium:** A meaningful signal with some context, but important evidence is
  still missing or multiple explanations remain plausible.
- **Low:** Limited context, weak or noisy evidence, small sample, conflicting
  signals, or an AI response that cannot justify its reasoning.

The rule-based blend can consider:

1. magnitude of the drop-off;
2. sample-size and data-quality guardrails;
3. whether a useful description was provided; and
4. the AI’s own qualitative confidence.

The system should use High/Medium/Low rather than arbitrary confidence
percentages. The UI must distinguish:

> Evidence strength ≠ causal certainty.

## 12. MVP scope

### Must have

These are the features required to prove the core product thesis:

- structured input for 3–6 funnel steps;
- step descriptions;
- validation for counts, order, and consistency;
- deterministic conversion, drop-off, and users-lost calculations;
- meaningful-drop detection with a visible threshold;
- sample-size and data-quality guardrails;
- a visible deterministic analysis result;
- AI hypothesis generation only after logic flags a step;
- evidence and missing-evidence explanation;
- High/Medium/Low confidence;
- one recommended investigation;
- one suggested experiment;
- an explicit inconclusive/no-AI state;
- saved analysis records;
- clickable analysis history;
- a simple admin dashboard;
- visible handling for API failures and malformed AI output.

### Should have

- editable threshold with a safe default;
- a compact “why this step was flagged” explanation;
- copy/export of a diagnostic;
- example funnel data for a first walkthrough;
- a way to distinguish a behavioral investigation from an instrumentation check.

### Could have

- segment-level comparisons;
- trend or time-window context;
- a library of investigation templates;
- experiment notes and outcomes;
- team comments;
- links to release or ticket context;
- integrations after the standalone workflow is validated.

### Won’t have

The MVP explicitly excludes:

- direct Mixpanel integrations;
- direct Amplitude integrations;
- GA4 integrations;
- real-time analytics;
- session replay integrations;
- autonomous experimentation;
- automatic A/B test deployment.

These exclusions keep the prototype focused on the reasoning workflow rather than
building a competing analytics platform or allowing the system to act without
human oversight.

## 13. Feature prioritization

| Feature | User Value | Effort | Risk | Priority |
|---|---|---|---|---|
| Structured funnel input | High | Low | Low | High |
| Input and consistency validation | High | Low | Low | High |
| Deterministic calculations | High | Low | Low | High |
| Meaningful-drop and sample checks | High | Medium | Medium | High |
| Visible evidence for flagged steps | High | Low | Low | High |
| Constrained AI hypotheses | High | Medium | High | High |
| Missing-evidence explanation | High | Medium | Medium | High |
| Investigation recommendation | High | Medium | Medium | High |
| One experiment recommendation | High | Medium | Medium | High |
| Inconclusive state | High | Low | Low | High |
| Saved analysis and history | Medium | Medium | Low | Medium |
| Admin dashboard | Medium | Low | Low | Medium |
| Editable threshold | Medium | Low | Medium | Medium |
| Segment and trend comparisons | Medium | High | High | Low |
| Analytics platform integrations | Medium | High | High | Low |
| Autonomous experiment deployment | Low for MVP | High | High | Won’t have |

Priorities are based on the JTBD: reduce the gap between a meaningful signal and
a defensible next action. Visual impressiveness and technical complexity are not
priority criteria.

## 14. Success criteria

### Product success metrics

These measure whether the product helps the user:

- Users can enter a valid 3–6 step funnel without ambiguity.
- Funnel metrics are calculated correctly and are easy to inspect.
- Meaningful drop-offs are identified consistently for the same input.
- Small or insufficient samples do not trigger an unjustified diagnosis.
- Every AI hypothesis refers to supplied evidence or explicitly identifies missing
  evidence.
- Users can tell which parts are calculated and which parts are hypotheses.
- The product can return “Diagnosis inconclusive.”
- Every useful diagnosis produces one actionable investigation or experiment.
- A user can revisit a saved analysis and understand the result later.

### System quality metrics

These measure reliability and safety:

- Invalid input is rejected before a request is sent.
- No AI call is made when deterministic logic finds no abnormal drop-off.
- AI output is parsed into the required schema or stored as a visible parse error.
- OpenAI/API failures preserve and display the deterministic results.
- Unsupported numbers and claims do not appear in the AI output.
- Analysis status is stored as `ok`, `no-flag`, `api-error`, or `ai-parse-error`.
- A saved analysis can be retrieved after reload.
- The system records one AI call or zero AI calls per analysis according to the
  logic result.

These criteria are targets for the prototype; they are not claims that the
current implementation has already satisfied them.

## 15. AI trade-offs

- **Hallucination:** The model may introduce facts or numbers. Constrained input,
  explicit no-invention instructions, schema parsing, and evidence checks reduce
  this risk.
- **False positives:** A normal or seasonal drop may cross a fixed threshold.
  Sample checks, context, and an inconclusive state reduce the cost of over-
  flagging.
- **False negatives:** A real issue may not cross the threshold or may be hidden
  by inconsistent data. The threshold is a diagnostic guardrail, not a guarantee
  that healthy steps are healthy.
- **Overconfidence:** A fluent explanation can sound more certain than the data.
  Qualitative confidence, missing-evidence language, and clear hypothesis labels
  are required.
- **Explainability:** AI output is only useful if the user can trace it to the
  flagged step and understand what evidence would change the conclusion.
- **Latency:** AI adds a wait after deterministic work. The UI should show the
  deterministic result immediately or keep it visible while AI runs.
- **Cost:** Unnecessary calls are avoidable because logic runs first.
- **Reliability:** API outages and malformed JSON are expected failure states, not
  reasons to hide the logic result.
- **Deterministic alternatives:** Calculation, validation, thresholding, and
  quality checks remain deterministic.
- **Human oversight:** The user owns the final investigation and experiment
  decision.

AI remains justified because generating, contrasting, and clearly communicating
possible explanations from a small, structured evidence packet is language-heavy
work. The product is not asking AI to do the math or make the decision.

## 16. Cost and sustainability

All figures below are planning estimates, not measured costs or vendor quotes.

### Per-analysis model

- **LLM calls:** Zero when no abnormal drop-off is found; one call when at least
  one step is flagged.
- **Prompt size:** Small structured JSON containing only flagged steps,
  descriptions, calculated signals, and guardrail flags. Estimate: a few hundred
  input tokens for a typical 3–6 step funnel.
- **Output size:** Strict JSON with two or three hypotheses, one experiment,
  confidence, and reasoning. Estimate: a few hundred output tokens.
- **Database storage:** One compact record containing raw input, deterministic
  output, AI output or error, status, confidence, and timestamp.

### Sustainability controls

- deterministic logic eliminates unnecessary LLM calls;
- send flagged steps only, not the whole raw dataset;
- cap the number of hypotheses and output length;
- do not retry automatically on malformed output;
- preserve logic results when AI is unavailable;
- use database history for auditability rather than repeating the same analysis;
- add rate limiting and retention policies only if the MVP becomes a shared
  production service.

Infrastructure and database costs depend on the Replit project plan and usage.
For the MVP, the file/database record size is small and the main variable cost is
the one conditional LLM call per abnormal analysis. No cost estimate here should
be interpreted as a guarantee.

## 17. UX principles

1. **Evidence before explanation.** Show the calculated signal before AI reasoning.
2. **Never present hypotheses as facts.** Use clear labels and cautious language.
3. **Show why a step was flagged.** Expose counts, rates, threshold, and users lost.
4. **Let users inspect underlying numbers.** Do not replace raw inputs with a score.
5. **Prefer inconclusive over false certainty.** Refusing to guess is a useful result.
6. **Keep AI output concise.** The next action should not be buried in prose.
7. **Make the next action explicit.** Every useful result should name an
   investigation or one experiment.
8. **Keep deterministic analysis visible.** AI should add reasoning, not obscure the
   calculations.

## 18. Core user flow

### Structured Input

The user enters 3–6 ordered steps, counts, and short descriptions. The form
should make the required fields and count relationships clear.

### Validation

Deterministic validation rejects empty names, invalid integers, non-positive
entered counts, converted counts greater than entered counts, invalid ordering,
and inconsistent funnel data. No analysis request is made when validation fails.

### Deterministic Analysis

The logic layer calculates conversion rate, drop-off percentage, users lost, and
sample/data-quality flags for each step. It uses a configurable meaningful-drop
threshold.

### Diagnostic Signals

The tool identifies the largest or abnormal drops and explains the rule that
caused each flag. If nothing is abnormal, it returns a no-significant-drop state
and stops before AI.

### AI Reasoning

Only flagged steps, descriptions, computed drop-off, sample flags, and data-quality
signals are passed to the model. The fixed system role forbids invented numbers
and requires explicit uncertainty.

### Hypotheses

The AI returns two or three competing possible explanations, not a single claimed
cause. Each should be tied to the supplied evidence and describe what remains
unknown.

### Evidence

The result separates known input signals from evidence that is missing. A useful
response might recommend checking a segment, release, event definition, or user
journey, but it must not claim that the check has already proven anything.

### Confidence

The product combines deterministic evidence strength, sample/context guardrails,
and the AI’s qualitative confidence into High, Medium, or Low. It communicates
that the label is not causal certainty.

### Investigation

The AI recommends one focused next check that could distinguish between the
hypotheses or validate data quality.

### Experiment

The AI suggests one bounded experiment tied to a hypothesis and outcome. The
human decides whether it is appropriate and how to implement it.

### Database Storage

Every analysis stores the raw input, deterministic output, AI output or error,
confidence, status, and timestamp. History lets the user review previous work and
the admin view summarizes usage and errors.

## 19. Screen structure

These are intended screens for the product. They are documented here for later
implementation; they are not new Phase 1 development work.

### 1. Funnel Builder / Input

- **Purpose:** Create a funnel and enter metrics and context.
- **Information hierarchy:** Required step data first, validation state second,
  optional context without obscuring the counts.
- **Primary action:** Validate and analyze the funnel.
- **Important UX considerations:** Support 3–6 steps, make count relationships
  understandable, show inline errors, preserve entered values, and prevent
  submission when invalid.

### 2. Diagnostic Results

- **Purpose:** Show the meaningful drop, deterministic evidence, AI reasoning, and
  next action.
- **Information hierarchy:** Flagged step and raw metrics, why it was flagged,
  hypotheses and missing evidence, confidence, then investigation/experiment.
- **Primary action:** Review or act on the recommended investigation.
- **Important UX considerations:** Keep logic visible next to AI output, label
  hypotheses as hypotheses, support no-flag and inconclusive states, and make API
  errors non-destructive.

### 3. Analysis History

- **Purpose:** Review previous analyses.
- **Information hierarchy:** Timestamp, flagged step, confidence, and status first;
  full detail on selection.
- **Primary action:** Open a saved analysis.
- **Important UX considerations:** History should remain understandable after reload,
  distinguish no-flag from AI errors, and never imply that a saved confidence label
  is a causal verdict.

### 4. Admin Dashboard

- **Purpose:** Understand system usage, confidence distribution, and errors.
- **Information hierarchy:** Total analyses, confidence counts, AI error count,
  then the most recent ten analyses.
- **Primary action:** Inspect recent analysis status.
- **Important UX considerations:** This is an unprotected MVP admin view, so it
  should remain simple and not be linked prominently from the main user flow.

## 20. Phase 1 self-critique

| Dimension | Score | Evaluation |
|---|---:|---|
| Problem clarity | 9/10 | The reasoning gap between a visible drop and a defensible next action is specific. |
| User specificity | 8/10 | Growth/Product Manager is a useful primary persona; company size and data setup remain assumptions. |
| JTBD | 9/10 | The JTBD names the trigger, the uncertainty, and the desired decision. |
| Why AI | 9/10 | AI is reserved for synthesis, hypotheses, missing evidence, and recommendations. |
| Logic/AI separation | 9/10 | Mathematical and guardrail work stays deterministic; AI receives a constrained packet. |
| Failure-mode awareness | 9/10 | Generic diagnosis, false certainty, data quality, and inconclusive behavior are explicit. |
| MVP discipline | 8/10 | The scope is bounded, though history and admin add supporting work beyond the core loop. |
| Differentiation | 7/10 | The workflow framing is stronger than “AI Funnel Analyzer,” but the concept still needs validation against existing analyst habits. |
| Technical feasibility | 9/10 | Manual input, deterministic logic, one conditional LLM call, and simple persistence are feasible. |
| Assignment fit | 9/10 | It demonstrates workflow pain, a specific user, JTBD, AI judgment, deterministic logic, and failure design. |

### Scores below 8

**Differentiation — 7/10:** Analytics and AI-assisted analysis are crowded categories.
The recommendation is to validate whether the evidence-first, next-investigation
workflow is materially more useful than a manager’s current dashboard-plus-
conversation process before adding integrations or more AI features.

### Top 5 risks

1. Users may not provide enough context for useful hypotheses.
2. A threshold may over-flag normal funnel variation.
3. Users may read qualitative confidence as causal certainty.
4. The output may be fluent but generic and fail to change the next action.
5. Manual data entry may be too far from the team’s existing analytics workflow.

### Top 5 improvements

1. Add sample-size and data-quality checks before hypothesis generation.
2. Require every hypothesis to cite a supplied signal and name missing evidence.
3. Make the recommended investigation the most concrete part of the AI output.
4. Test the prototype with representative workflow walkthroughs before adding
   analytics integrations.
5. Capture whether the user accepts, edits, or rejects the recommended next action.

### One thing we should not build

Do not build autonomous A/B-test deployment or automatic experimentation. It would
expand the risk surface, imply more causal certainty than the input supports, and
move the product away from its decision-support thesis.
