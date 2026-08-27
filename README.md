# Workflow-Pain-to-a-Working-AI-Product-Jogi
Funnel Drop-off Diagnostic Tool MVP

## Phase 1 — Product Discovery

### Product thesis

Provide a lightweight diagnostic that uses deterministic funnel analysis to
identify meaningful drop-offs, then uses constrained AI to generate
evidence-aware hypotheses and recommend what to investigate or test next—without
claiming causal certainty.

### JTBD

When I see a meaningful funnel drop and do not know why, I want to separate a real
signal from a data problem and get evidence-aware next steps, so I can focus the
team on the most useful investigation without presenting a guess as fact.

### Logic + AI principle

Data shows where the problem is; deterministic logic decides whether it is
meaningful; AI helps reason about possible explanations and next actions; a human
decides what to do.

Read the full product definition in
[`docs/phase-1-product-discovery.md`](docs/phase-1-product-discovery.md).

## QA / Reliability

The diagnostic keeps deterministic funnel math separate from AI interpretation.
It safely handles zero-user and small-sample inputs, validates step order and
duplicate names, and classifies observed drop-offs as high, medium, low, or
insufficient evidence. A flagged result with insufficient evidence is shown as
**Diagnosis inconclusive** and does not call the AI.

Completed analyses, deterministic logic, AI errors, and retry state are
persisted in PostgreSQL. Failed or stale investigations can be retried without
duplicating the saved analysis. The release checklist, expected behavior, and
latest verification results are recorded in
[`docs/qa-checklist.md`](docs/qa-checklist.md).
