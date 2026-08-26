import { FunnelBuilder } from '@/components/funnel/FunnelBuilder';

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col">
      <header className="w-full border-b border-border bg-card">
        <div className="max-w-6xl mx-auto w-full px-6 h-16 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg leading-none shadow-sm">
            F
          </div>
          <div className="font-semibold text-lg tracking-tight">Drop-off Diagnostic</div>
          <div className="ml-auto flex items-center gap-4 text-sm font-medium text-muted-foreground">
            <span className="hidden sm:inline-block">Phase 2: Deterministic Analysis</span>
            <div className="h-2 w-2 rounded-full bg-success"></div>
          </div>
        </div>
      </header>
      
      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12">
        <FunnelBuilder />
      </main>
      
      <footer className="w-full border-t border-border py-8 mt-12 bg-muted/20">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Drop-off Diagnostic Tool. Internal workspace.
        </div>
      </footer>
    </div>
  );
}
