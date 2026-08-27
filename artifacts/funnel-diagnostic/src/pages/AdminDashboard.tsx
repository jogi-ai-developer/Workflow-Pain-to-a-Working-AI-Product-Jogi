import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FlaskConical,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  XCircle,
} from 'lucide-react';
import {
  getGetAdminSummaryQueryKey,
  getGetAnalysisQueryKey,
  getListAnalysesQueryKey,
  useGetAdminSummary,
  useGetAnalysis,
  useListAnalyses,
} from '@workspace/api-client-react';
import type {
  AdminSummary,
  Analysis,
  AnalysisSummary,
  AnalysisStatus,
} from '@workspace/api-client-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'flagged' | 'no-flag' | 'ai-error';

const filterOptions: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'no-flag', label: 'No flag' },
  { value: 'ai-error', label: 'AI error' },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAnalysisSummary(value: unknown): value is AnalysisSummary {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.timestamp === 'string' &&
    Array.isArray(value.flaggedSteps) &&
    value.flaggedSteps.every((step) => typeof step === 'string') &&
    typeof value.confidence === 'string' &&
    typeof value.status === 'string'
  );
}

function isAdminSummary(value: unknown): value is AdminSummary {
  if (!isRecord(value)) return false;
  const confidenceCounts = value.confidenceCounts;
  return (
    typeof value.totalAnalyses === 'number' &&
    typeof value.aiErrorCount === 'number' &&
    isRecord(confidenceCounts) &&
    typeof confidenceCounts.high === 'number' &&
    typeof confidenceCounts.medium === 'number' &&
    typeof confidenceCounts.low === 'number' &&
    Array.isArray(value.recentAnalyses) &&
    value.recentAnalyses.every(isAnalysisSummary)
  );
}

function isAnalysis(value: unknown): value is Analysis {
  if (!isRecord(value) || !isRecord(value.logic)) return false;
  return (
    typeof value.id === 'number' &&
    typeof value.timestamp === 'string' &&
    Array.isArray(value.steps) &&
    Array.isArray(value.logic.steps) &&
    Array.isArray(value.logic.flaggedSteps) &&
    typeof value.logic.thresholdPercent === 'number' &&
    typeof value.logic.hasAbnormalDropOff === 'boolean' &&
    typeof value.status === 'string' &&
    typeof value.confidence === 'string'
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function statusLabel(status: AnalysisStatus): string {
  if (status === 'no-flag') return 'No flag';
  if (status === 'inconclusive') return 'Inconclusive';
  if (status === 'ai-parse-error') return 'AI parse error';
  if (status === 'api-error') return 'AI error';
  return 'Complete';
}

function statusClassName(status: AnalysisStatus): string {
  if (status === 'ok') return 'border-success/30 bg-success/10 text-success';
  if (status === 'no-flag') return 'border-border bg-muted text-muted-foreground';
  if (status === 'inconclusive') return 'border-amber-500/30 bg-amber-500/10 text-amber-800';
  return 'border-destructive/30 bg-destructive/10 text-destructive';
}

function matchesFilter(analysis: AnalysisSummary, filter: Filter): boolean {
  if (filter === 'all') return true;
  if (filter === 'flagged') return analysis.flaggedSteps.length > 0;
  if (filter === 'no-flag') return analysis.flaggedSteps.length === 0;
  return analysis.status === 'api-error' || analysis.status === 'ai-parse-error';
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  description: string;
  icon: typeof Database;
  tone?: 'default' | 'warning' | 'danger' | 'success';
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <p className="mt-3 font-mono text-3xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              tone === 'warning' && 'bg-amber-500/10 text-amber-600',
              tone === 'danger' && 'bg-destructive/10 text-destructive',
              tone === 'success' && 'bg-success/10 text-success',
              tone === 'default' && 'bg-primary/10 text-primary',
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: AnalysisStatus }) {
  return (
    <Badge variant="outline" className={cn('font-medium', statusClassName(status))}>
      {status === 'ok' && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {status === 'no-flag' && <ShieldCheck className="mr-1 h-3 w-3" />}
      {status === 'inconclusive' && <AlertTriangle className="mr-1 h-3 w-3" />}
      {(status === 'api-error' || status === 'ai-parse-error') && (
        <AlertTriangle className="mr-1 h-3 w-3" />
      )}
      {statusLabel(status)}
    </Badge>
  );
}

function ConfidenceBadge({ confidence }: { confidence: AnalysisSummary['confidence'] }) {
  return (
    <Badge variant="outline" className="border-border bg-background font-medium capitalize">
      {confidence} confidence
    </Badge>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3" aria-label="Loading analyses">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-[76px] animate-pulse rounded-lg border border-border bg-muted/40"
        />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="flex-1">
          <p className="font-semibold">The dashboard could not load</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The saved analysis service is unavailable right now. Try again without leaving this page.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}

function AnalysisDetail({ analysis }: { analysis: Analysis }) {
  const flaggedSteps = analysis.logic.steps.filter((step) => step.isAbnormal);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Analysis #{analysis.id}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Diagnostic record</h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" />
            {formatDate(analysis.timestamp)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={analysis.status} />
          <ConfidenceBadge confidence={analysis.confidence} />
        </div>
      </div>

      {analysis.errorMessage && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">AI investigation error</p>
              <p className="mt-1 text-sm text-muted-foreground">{analysis.errorMessage}</p>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Deterministic evidence</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Observed funnel signals calculated from the submitted counts.
              </p>
            </div>
            <Badge variant="secondary">Threshold: {analysis.logic.thresholdPercent}%</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Flagged steps
              </p>
              <p className="mt-1 font-mono text-xl font-bold">{flaggedSteps.length}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Funnel steps
              </p>
              <p className="mt-1 font-mono text-xl font-bold">{analysis.logic.steps.length}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total users at entry
              </p>
              <p className="mt-1 font-mono text-xl font-bold">
                {analysis.logic.steps[0]?.entered.toLocaleString() ?? '—'}
              </p>
            </div>
          </div>

          {flaggedSteps.length > 0 && (
            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Meaningful drop-off detected
              </p>
              <p className="mt-1 text-sm text-foreground">
                {flaggedSteps
                  .map((step) => `${step.name} dropped ${step.dropOffPercent}%`)
                  .join(' · ')}
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Step</th>
                  <th className="px-3 py-2.5 font-semibold">Users</th>
                  <th className="px-3 py-2.5 font-semibold">Conversion</th>
                  <th className="px-3 py-2.5 font-semibold">Drop-off</th>
                  <th className="px-3 py-2.5 font-semibold">Evidence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analysis.logic.steps.map((step) => (
                  <tr key={`${step.order}-${step.name}`}>
                    <td className="px-3 py-3">
                      <p className="font-medium">
                        {step.order}. {step.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{step.description}</p>
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {step.entered.toLocaleString()} → {step.converted.toLocaleString()}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs">{step.conversionRate}%</td>
                    <td className="px-3 py-3 font-mono text-xs">{step.dropOffPercent}%</td>
                    <td className="px-3 py-3">
                      {step.isAbnormal ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Flagged
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Within threshold
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">AI interpretation</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Possibilities generated from the evidence above—not established causes.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {analysis.ai ? (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Possible causes
                </p>
                <ul className="mt-2 space-y-2">
                  {analysis.ai.likelyCauses.map((cause) => (
                    <li key={cause} className="flex gap-2 text-sm">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Hypotheses
                    </p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {analysis.ai.hypotheses.map((hypothesis) => (
                      <li key={hypothesis} className="text-sm leading-6">
                        {hypothesis}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Missing evidence
                    </p>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {analysis.ai.missingEvidence.map((evidence) => (
                      <li key={evidence} className="text-sm leading-6">
                        {evidence}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suggested investigation
                  </p>
                  <p className="mt-2 text-sm leading-6">{analysis.ai.suggestedInvestigation}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Suggested experiment
                  </p>
                  <p className="mt-2 text-sm leading-6">{analysis.ai.suggestedExperiment}</p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  AI reasoning
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.ai.reasoning}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                No AI interpretation is stored for this analysis. This is expected for no-flag
                funnels and for investigations where the AI service failed.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminDashboard() {
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const summaryQuery = useGetAdminSummary({
    query: {
      queryKey: getGetAdminSummaryQueryKey(),
      retry: 1,
      refetchOnMount: 'always',
    },
  });
  const listQuery = useListAnalyses({
    query: {
      queryKey: getListAnalysesQueryKey(),
      retry: 1,
      refetchOnMount: 'always',
    },
  });
  const detailQuery = useGetAnalysis(selectedId ?? 0, {
    query: {
      queryKey: getGetAnalysisQueryKey(selectedId ?? 0),
      enabled: selectedId !== null,
      retry: 1,
      refetchOnMount: 'always',
    },
  });

  const rawAnalyses = listQuery.data as unknown;
  const malformedList = rawAnalyses !== undefined && (
    !Array.isArray(rawAnalyses) || !rawAnalyses.every(isAnalysisSummary)
  );
  const analyses = useMemo(
    () =>
      (Array.isArray(rawAnalyses) ? rawAnalyses.filter(isAnalysisSummary) : []).sort((a, b) => {
        const first = new Date(a.timestamp).getTime();
        const second = new Date(b.timestamp).getTime();
        return (Number.isNaN(second) ? b.id : second) - (Number.isNaN(first) ? a.id : first);
      }),
    [rawAnalyses],
  );

  const filteredAnalyses = useMemo(
    () => analyses.filter((analysis) => matchesFilter(analysis, filter)),
    [analyses, filter],
  );

  useEffect(() => {
    if (filteredAnalyses.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!filteredAnalyses.some((analysis) => analysis.id === selectedId)) {
      setSelectedId(filteredAnalyses[0].id);
    }
  }, [filteredAnalyses, selectedId]);

  const rawSummary = summaryQuery.data as unknown;
  const summary = isAdminSummary(rawSummary) ? rawSummary : undefined;
  const malformedSummary = rawSummary !== undefined && !isAdminSummary(rawSummary);
  const rawDetail = detailQuery.data as unknown;
  const malformedDetail = rawDetail !== undefined && !isAnalysis(rawDetail);
  const flaggedCount = analyses.filter((analysis) => analysis.flaggedSteps.length > 0).length;
  const noFlagCount = analyses.filter((analysis) => analysis.flaggedSteps.length === 0).length;
  const isLoading = summaryQuery.isLoading || listQuery.isLoading;
  const hasError = summaryQuery.isError || listQuery.isError || malformedSummary || malformedList;

  return (
    <div className="min-h-[100dvh] w-full bg-background">
      <header className="w-full border-b border-border bg-card">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-3 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-lg font-bold leading-none text-primary-foreground shadow-sm">
            F
          </div>
          <div>
            <p className="font-semibold tracking-tight">Drop-off Diagnostic</p>
            <p className="hidden text-xs text-muted-foreground sm:block">Internal operations</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-sm font-medium text-muted-foreground md:flex">
              <span className="h-2 w-2 rounded-full bg-success" />
              Admin dashboard
            </span>
            <Link href="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-3.5 w-3.5" />
                Workspace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-primary">
              Phase 5 · Operations
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Analysis overview
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Monitor persisted diagnostic runs and inspect what the deterministic engine observed
              before reviewing AI possibilities.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Database className="h-4 w-4" />
            Live persisted data
          </div>
        </div>

        {hasError ? (
          <ErrorState
            onRetry={() => {
              void summaryQuery.refetch();
              void listQuery.refetch();
            }}
          />
        ) : (
          <>
            <section aria-label="Summary metrics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Total analyses"
                value={isLoading ? '—' : summary?.totalAnalyses ?? analyses.length}
                description="All persisted diagnostic runs"
                icon={Database}
              />
              <MetricCard
                label="Flagged analyses"
                value={isLoading ? '—' : flaggedCount}
                description="Runs with meaningful drop-off"
                icon={AlertTriangle}
                tone="warning"
              />
              <MetricCard
                label="No-flag analyses"
                value={isLoading ? '—' : noFlagCount}
                description="Funnels within threshold"
                icon={CheckCircle2}
                tone="success"
              />
              <MetricCard
                label="AI failures"
                value={isLoading ? '—' : summary?.aiErrorCount ?? 0}
                description="API or parse errors"
                icon={XCircle}
                tone="danger"
              />
            </section>

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
              <Card className="h-fit">
                <CardHeader className="border-b border-border pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Recent analyses</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Newest saved runs first.
                      </p>
                    </div>
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter analyses">
                    {filterOptions.map((option) => {
                      const count =
                        option.value === 'all'
                          ? analyses.length
                          : analyses.filter((analysis) => matchesFilter(analysis, option.value)).length;
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          data-testid={`filter-${option.value}`}
                          size="sm"
                          variant={filter === option.value ? 'default' : 'outline'}
                          onClick={() => setFilter(option.value)}
                        >
                          {option.label}
                          <span className="font-mono text-[11px] opacity-70">{count}</span>
                        </Button>
                      );
                    })}
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  {isLoading ? (
                    <LoadingRows />
                  ) : filteredAnalyses.length === 0 ? (
                    <div className="px-3 py-12 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <Search className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="mt-3 font-semibold">No analyses in this view</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Try another filter or run a new diagnosis from the workspace.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredAnalyses.map((analysis) => (
                        <button
                          key={analysis.id}
                          type="button"
                          onClick={() => setSelectedId(analysis.id)}
                          className={cn(
                            'group w-full rounded-lg border p-3 text-left transition-colors',
                            selectedId === analysis.id
                              ? 'border-primary bg-primary/5'
                              : 'border-transparent hover:border-border hover:bg-muted/50',
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-primary">
                                  #{analysis.id}
                                </span>
                                <span className="truncate text-sm font-semibold">
                                  {analysis.flaggedSteps.length > 0
                                    ? analysis.flaggedSteps.join(', ')
                                    : 'Healthy funnel'}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {formatDate(analysis.timestamp)}
                              </p>
                            </div>
                            <ChevronRight
                              className={cn(
                                'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                                selectedId === analysis.id && 'translate-x-0.5 text-primary',
                              )}
                            />
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <StatusBadge status={analysis.status} />
                            <ConfidenceBadge confidence={analysis.confidence} />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <section aria-label="Analysis detail">
                {selectedId === null ? (
                  <Card className="flex min-h-[420px] items-center justify-center">
                    <CardContent className="max-w-sm p-8 text-center">
                      <Search className="mx-auto h-8 w-8 text-muted-foreground" />
                      <h2 className="mt-4 text-lg font-semibold">Select an analysis</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Choose a saved run to inspect its evidence and AI interpretation.
                      </p>
                    </CardContent>
                  </Card>
                ) : detailQuery.isLoading ? (
                  <Card className="min-h-[420px]">
                    <CardContent className="space-y-4 p-6">
                      <div className="h-8 w-2/5 animate-pulse rounded bg-muted" />
                      <div className="h-24 animate-pulse rounded bg-muted" />
                      <div className="h-48 animate-pulse rounded bg-muted" />
                    </CardContent>
                  </Card>
                ) : detailQuery.isError || malformedDetail || !detailQuery.data ? (
                  <Card className="min-h-[420px]">
                    <CardContent className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
                      <div>
                        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
                        <h2 className="mt-4 text-lg font-semibold">Analysis unavailable</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This saved analysis could not be loaded. It may have been removed or is
                          temporarily unavailable.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-4"
                          onClick={() => void detailQuery.refetch()}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Try again
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <AnalysisDetail analysis={detailQuery.data} />
                )}
              </section>
            </div>
          </>
        )}
      </main>

      <footer className="mt-12 border-t border-border bg-muted/20 py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Drop-off Diagnostic Tool. Internal workspace.
        </div>
      </footer>
    </div>
  );
}