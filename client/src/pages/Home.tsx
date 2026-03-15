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
  const updatedSectionsRef = useRef<string[]>([]);

  activePluginRef.current = activePlugin;

  const fetchHome = useCallback(async (pluginId: string) => {
    setError(null);
    setLoading(true);

    try {
      const data = await api.getHome(pluginId);
      
      if (activePluginRef.current?.id !== pluginId) return;

      setSections(data);
    } catch (err) {
      if (activePluginRef.current?.id !== pluginId) return;
      setError('Falha ao carregar conteúdo da Home.');
    } finally {
      setLoading(false);
    }
  }, []);

  const smartSync = useCallback(async (pluginId: string) => {
    startSync('Procurando novidades...');

    try {
      const result = await api.checkHome(pluginId);

      if (activePluginRef.current?.id !== pluginId) return;

      if (!result.changed) {
        endSync('Nenhuma novidade encontrada.');
        return;
      }

      if (result.sections) {
        setSections(result.sections);
        updatedSectionsRef.current = result.updatedSections ?? [];
      }

      const count = result.updatedSections?.length ?? 0;
      endSync(`${count} seção(ões) atualizada(s)!`);
    } catch {
      if (activePluginRef.current?.id !== pluginId) return;
      failSync();
    }
  }, [startSync, endSync, failSync]);

  const recursivePrefetch = useCallback(async (pluginId: string, homeSections: HomeSection[]) => {
    if (hasRecursiveSyncedRef.current) return;
    hasRecursiveSyncedRef.current = true;

    const changedNames = new Set(updatedSectionsRef.current);
    const targetSections = homeSections.filter(s => changedNames.has(s.name));
    const allItems = targetSections.flatMap(s => s.list);
    if (allItems.length === 0) return;

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
    updatedSectionsRef.current = [];
    cancelSync();
    fetchHome(activePlugin.id);
  }, [activePlugin, fetchHome, cancelSync]);

  // Smart background sync after initial load (once per plugin)
  useEffect(() => {
    if (!activePlugin || loading || sections.length === 0) return;
    if (!settings?.syncEnabled || hasSyncedRef.current) return;

    const timer = setTimeout(() => {
      hasSyncedRef.current = true;
      smartSync(activePlugin.id);
    }, 1000);

    return () => clearTimeout(timer);
  }, [activePlugin, loading, sections.length, settings?.syncEnabled, smartSync]);

  // Recursive prefetch: only after smart sync detects changes
  useEffect(() => {
    if (!activePlugin || loading || sections.length === 0) return;
    if (!settings?.recursiveHomeSync || hasRecursiveSyncedRef.current) return;
    if (updatedSectionsRef.current.length === 0) return;

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
          onPress={() => activePlugin && smartSync(activePlugin.id)}
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
            onPress={() => activePlugin && fetchHome(activePlugin.id)}
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
