import { Button } from '@heroui/react';
import { RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import MediaCarousel from '../components/media/MediaCarousel';
import MediaSkeleton from '../components/media/MediaSkeleton';
import { usePlugins } from '../hooks/usePlugins';
import { useSettings } from '../contexts/SettingsContext';
import { useSync } from '../contexts/SyncContext';
import { api, type HomeSection } from '../services/api';

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  signal: AbortSignal,
  onProgress: (done: number, total: number) => void,
  fn: (item: T) => Promise<void>,
) {
  let done = 0;
  const total = items.length;
  const queue = [...items];

  const worker = async () => {
    while (queue.length > 0) {
      if (signal.aborted) return;
      const item = queue.shift()!;
      try {
        await fn(item);
      } catch {
        // Skip failed items
      }
      done++;
      onProgress(done, total);
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
}

export default function Home() {
  const { activePlugin } = usePlugins();
  const { settings } = useSettings();
  const { startSync, updateProgress, endSync, failSync, cancelSync } = useSync();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activePluginRef = useRef(activePlugin);
  const hasSyncedRef = useRef(false);
  const hasRecursiveSyncedRef = useRef(false);

  activePluginRef.current = activePlugin;

  const fetchHome = useCallback(async (pluginId: string, isInitialLoad: boolean) => {
    setError(null);

    if (isInitialLoad) {
      setLoading(true);
    } else {
      startSync('Verificando novidades...');
    }

    try {
      const data = await api.getHome(pluginId, !isInitialLoad);
      
      if (activePluginRef.current?.id !== pluginId) return;

      setSections(data);

      if (!isInitialLoad) {
        endSync();
      }
    } catch (err) {
      if (activePluginRef.current?.id !== pluginId) return;
      if (isInitialLoad) setError('Falha ao carregar conteúdo da Home.');
      failSync();
    } finally {
      setLoading(false);
    }
  }, [startSync, endSync, failSync]);

  // Recursive prefetch: load details for every item on the home page
  const recursivePrefetch = useCallback(async (pluginId: string, homeSections: HomeSection[]) => {
    if (hasRecursiveSyncedRef.current) return;
    hasRecursiveSyncedRef.current = true;

    const allItems = homeSections.flatMap(s => s.list);
    if (allItems.length === 0) return;

    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueItems = allItems.filter(item => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    const concurrency = settings?.recursiveConcurrency ?? 2;
    const signal = startSync('Pré-carregando... ');

    await runWithConcurrency(
      uniqueItems,
      concurrency,
      signal,
      (done, total) => {
        if (!signal.aborted) updateProgress(done, total);
      },
      async (item) => {
        if (signal.aborted) return;
        if (activePluginRef.current?.id !== pluginId) return;
        await api.load(pluginId, item.url);
      },
    );

    if (!signal.aborted && activePluginRef.current?.id === pluginId) {
      endSync();
    }
  }, [settings?.recursiveConcurrency, startSync, updateProgress, endSync]);

  // Cancel sync when plugin changes
  useEffect(() => {
    if (!activePlugin) return;
    setSections([]);
    hasSyncedRef.current = false;
    hasRecursiveSyncedRef.current = false;
    cancelSync();
    fetchHome(activePlugin.id, true);
  }, [activePlugin, fetchHome, cancelSync]);

  // Background sync after initial load (once per plugin)
  useEffect(() => {
    if (!activePlugin || loading || sections.length === 0) return;
    if (!settings?.syncEnabled || hasSyncedRef.current) return;

    hasSyncedRef.current = true;
    const timer = setTimeout(() => {
      fetchHome(activePlugin.id, false);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activePlugin, loading, sections.length, settings?.syncEnabled]);

  // Recursive prefetch after sections are loaded and sync is done
  useEffect(() => {
    if (!activePlugin || loading || sections.length === 0) return;
    if (!settings?.recursiveHomeSync || hasRecursiveSyncedRef.current) return;

    const timer = setTimeout(() => {
      recursivePrefetch(activePlugin.id, sections);
    }, 2000);

    return () => clearTimeout(timer);
  }, [activePlugin, loading, sections, settings?.recursiveHomeSync, recursivePrefetch]);

  return (
    <div className="animate-in fade-in duration-700">
      <div className="mb-10 px-1 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-2 text-foreground/90 tracking-tight">
            Explorar <span className="text-primary">{activePlugin?.name}</span>
          </h1>
          <p className="text-default-500 max-w-lg">
            {activePlugin?.description || 'Navegue pelos melhores filmes e séries disponíveis para você.'}
          </p>
        </div>
        
        <Button
          variant="flat"
          size="sm"
          startContent={<RefreshCcw className="w-4 h-4" />}
          onPress={() => activePlugin && fetchHome(activePlugin.id, false)}
          isDisabled={loading}
        >
          Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-12">
          {[1, 2, 3, 4].map((i) => (
            <MediaSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="text-danger font-medium">{error}</p>
          <Button
            variant="flat"
            color="primary"
            startContent={<RefreshCcw className="w-4 h-4" />}
            onPress={() => activePlugin && fetchHome(activePlugin.id, true)}
          >
            Recarregar
          </Button>
        </div>
      ) : sections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <p>Nenhum conteúdo encontrado para este plugin.</p>
        </div>
      ) : (
        sections.map((section, idx) => (
          <MediaCarousel
            key={`${section.name}-${idx}`}
            title={section.name}
            items={section.list}
            pluginId={activePlugin!.id}
          />
        ))
      )}
    </div>
  );
}
