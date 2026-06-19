import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  // @types/react kurulu olmadığından Component'in `props` üyesi tip olarak görünmüyor;
  // `state` gibi açıkça tanımlanır (any kullanılmaz).
  public declare readonly props: Readonly<Props>;

  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
          <div className="glass-panel p-8 rounded-3xl shadow-xl max-w-lg w-full text-center">
            <div className="w-16 h-16 bg-red-100/50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 backdrop-blur">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Bir Hata Oluştu</h1>
            <p className="text-slate-500 mb-6">
              Uygulama çalışırken beklenmeyen bir hata meydana geldi. Lütfen sayfayı yenileyin.
            </p>
            <div className="bg-white/40 backdrop-blur-sm p-4 rounded-xl text-left overflow-auto mb-6 border border-slate-200/50">
              <p className="text-xs font-mono text-red-600 break-words">
                {error?.message}
              </p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-colors w-full"
            >
              Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
