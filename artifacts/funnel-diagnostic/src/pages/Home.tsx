import { FunnelBuilder } from '@/components/funnel/FunnelBuilder';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { listAnalyses, type AnalysisSummary } from '@workspace/api-client-react';
import { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';

export default function Home({ analysisId }: HomeProps) {
  const [, navigate] = useLocation();
  const [savedAnalyses, setSavedAnalyses] = useState<AnalysisSummary[]>([]);

  useEffect(() => {
    if (analysisId !== undefined) return;
    let active = true;
    void listAnalyses().then((analyses) => {
      if (active) setSavedAnalyses(analyses);
    }).catch(() => {
      // The builder remains usable when the optional history list is unavailable.
    });
    return () => {
      active = false;
    };
  }, [analysisId]);

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-6xl mx-auto w-full px-6 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg leading-none shadow-sm">
            F
          </div>
          <div className="font-semibold text-lg tracking-tight">Drop-off Diagnostic</div>
          <div className="ml-auto flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <Link href="/admin">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
                Admin
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
             <span className="hidden sm:inline-block">Phase 6: QA-ready diagnostics</span>
            <div className="h-2 w-2 rounded-full bg-success"></div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
        {analysisId === undefined && savedAnalyses.length > 0 && (
          <section className="mx-auto mb-10 w-full max-w-5xl" aria-label="Saved analyses">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Saved analyses</h2>
                <p className="mt-1 text-xs text-muted-foreground">Reopen a result to review it or retry a failed investigation.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {savedAnalyses.slice(0, 6).map((analysis) => (
                <Link
                  key={analysis.id}
                  href={`/analyses/${analysis.id}`}
                  className={`rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 ${analysis.isStale ? 'border-amber-500/40 bg-amber-500/5' : 'border-border/60 bg-card'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm">Analysis #{analysis.id}</span>
                    <span className={analysis.status === 'ok' ? 'text-xs text-success' : analysis.isStale || analysis.status === 'inconclusive' ? 'text-xs font-semibold text-amber-700' : analysis.status === 'loading' ? 'text-xs text-muted-foreground' : 'text-xs text-destructive'}>
                      {analysis.status === 'ok' ? 'Complete' : analysis.isStale ? 'Recovery needed' : analysis.status === 'loading' ? 'Loading' : analysis.status === 'no-flag' ? 'No drop-off' : analysis.status === 'inconclusive' ? 'Inconclusive' : 'Needs retry'}
                    </span>
                  </div>
                  <div className="mt-2 truncate text-xs text-muted-foreground">
                    {analysis.flaggedSteps.length > 0 ? analysis.flaggedSteps.join(', ') : 'No flagged steps'}
                  </div>
                  {analysis.isStale && (
                    <div className="mt-2 text-xs text-amber-800">Interrupted before AI reasoning finished — open to retry.</div>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
        <FunnelBuilder
          analysisId={analysisId}
          onAnalysisSaved={(id) => {
            if (analysisId === undefined) navigate(`/analyses/${id}`);
          }}
        />
      </main>
      
      <footer className="w-full border-t border-border py-8 mt-12 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Drop-off Diagnostic Tool. Internal workspace.
        </div>
      </footer>
    </div>
  );
}

export function HomePage() {
  return <Home />;
}

type HomeProps = {
  analysisId?: number;
};

export function SavedAnalysisPage() {
  const [, params] = useRoute('/analyses/:id');
  const analysisId = Number(params?.id);
  return <Home analysisId={Number.isInteger(analysisId) ? analysisId : -1} />;
}
