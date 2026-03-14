import { createContext, useContext, useCallback, useState, type ReactNode } from 'react';
import { Loader2, CheckCircle2 } from 'lucide-react';

type SyncStatus = 'idle' | 'syncing' | 'done';

interface SyncContextType {
  syncStatus: SyncStatus;
  startSync: (message?: string) => void;
  endSync: () => void;
  failSync: () => void;
}

const SyncContext = createContext<SyncContextType>({
  syncStatus: 'idle',
  startSync: () => {},
  endSync: () => {},
  failSync: () => {},
});

export function useSyncStatus() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [message, setMessage] = useState('Verificando novidades...');

  const startSync = useCallback((msg?: string) => {
    setMessage(msg || 'Verificando novidades...');
    setSyncStatus('syncing');
  }, []);

  const endSync = useCallback(() => {
    setSyncStatus('done');
    setTimeout(() => setSyncStatus('idle'), 2500);
  }, []);

  const failSync = useCallback(() => {
    setSyncStatus('idle');
  }, []);

  return (
    <SyncContext.Provider value={{ syncStatus, startSync, endSync, failSync }}>
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
              <span className="text-sm text-default-400">{message}</span>
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
