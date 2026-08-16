import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error('[ErrorBoundary] Caught unhandled React error:', error, errorInfo);
  }

  private handleReload = (): void => {
    if (this.props.onReset) {
      this.props.onReset();
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.electronAPI?.relaunchApp) {
      void window.electronAPI.relaunchApp();
    } else {
      window.location.reload();
    }
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackTitle = 'Bir Hata Oluştu / An Error Occurred' } = this.props;
      const errorMessage = this.state.error?.message || 'Beklenmeyen bir çalışma zamanı hatası meydana geldi.';

      return (
        <div className="fixed inset-0 z-layer-toast flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl text-white select-none animate-fade-in">
          <div className="w-full max-w-lg rounded-3xl border border-white/15 bg-neutral-950/90 p-8 shadow-[0_32px_90px_rgba(0,0,0,0.9)] flex flex-col gap-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold text-white">{fallbackTitle}</h2>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{errorMessage}</p>
              </div>
            </div>

            {this.state.errorInfo && (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-black/60 p-3 text-[11px] font-mono text-neutral-400 scrollbar-thin">
                {this.state.error?.stack || this.state.errorInfo.componentStack}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-neutral-200 active:scale-95 cursor-pointer shadow-lg"
              >
                Uygulamayı Yeniden Başlat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
