import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from 'react';
import { Loader2, CheckCircle2, X } from 'lucide-react';

type SyncStatus = 'idle' | 'syncing' | 'done';

interface SyncProgress {
  current: number;
  total: number;
}

interface SyncContextType {
  syncStatus: SyncStatus;
  progress: SyncProgress | null;
  startSync: (message?: string) => AbortSignal;
  updateProgress: (current: number, total: number) => void;
  endSync: () => void;
  failSync: () => void;
  cancelSync: () => void;
}

const SyncContext = createContext<SyncContextType>({
  syncStatus: 'idle',
  progress: null,
  startSync: () => new AbortController().signal,
  updateProgress: () => {},
  endSync: () => {},
  failSync: () => {},
  cancelSync: () => {},
});

export function useSync() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState('Verificando novidades...');
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const cancelSync = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setProgress(null);
    setSyncStatus('idle');
  }, []);

  const startSync = useCallback((msg?: string) => {
    // Abort any previous sync
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setMessage(msg || 'Verificando novidades...');
    setProgress(null);
    setSyncStatus('syncing');

    return controller.signal;
  }, []);

  const updateProgress = useCallback((current: number, total: number) => {
    setProgress({ current, total });
  }, []);

  const endSync = useCallback(() => {
    abortRef.current = null;
    setProgress(null);
    setSyncStatus('done');
    setTimeout(() => setSyncStatus('idle'), 2500);
  }, []);

  const failSync = useCallback(() => {
    abortRef.current = null;
    setProgress(null);
    setSyncStatus('idle');
  }, []);

  return (
    <SyncContext.Provider value={{ syncStatus, progress, startSync, updateProgress, endSync, failSync, cancelSync }}>
      {children}

      {syncStatus !== 'idle' && (
        <div 
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border border-white/10 animate-in slide-in-from-bottom-4 fade-in duration-300"
          style={{ 
            background: 'linear-gradient(135deg, rgba(30,30,40,0.95), rgba(20,20,30,0.95))',
            backdropFilter: 'blur(12px)'
          }}
        >
          {syncStatus === 'syncing' ? (
            <>
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <span className="text-sm text-default-400">
                {message}
                {progress && (
                  <span className="text-primary font-semibold ml-1">
                    {progress.current} / {progress.total}
                  </span>
                )}
              </span>
              {progress && (
                <button
                  onClick={cancelSync}
                  className="ml-2 p-0.5 rounded-md hover:bg-white/10 transition-colors text-default-500 hover:text-danger cursor-pointer"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span className="text-sm text-success">Tudo atualizado!</span>
            </>
          )}
        </div>
      )}
    </SyncContext.Provider>
  );
}
