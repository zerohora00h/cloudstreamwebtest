import { Button, Spinner } from '@heroui/react';
import { RefreshCcw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import MediaCarousel from '../components/media/MediaCarousel';
import { usePlugins } from '../hooks/usePlugins';
import { useSettings } from '../contexts/SettingsContext';
import { useSyncStatus } from '../contexts/SyncContext';
import { api, type HomeSection } from '../services/api';

export default function Home() {
  const { activePlugin } = usePlugins();
  const { settings } = useSettings();
  const { startSync, endSync, failSync } = useSyncStatus();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activePluginRef = useRef(activePlugin);
  const hasSyncedRef = useRef(false);

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

  // Initial load when plugin changes
  useEffect(() => {
    if (!activePlugin) return;
    setSections([]);
    hasSyncedRef.current = false;
    fetchHome(activePlugin.id, true);
  }, [activePlugin, fetchHome]);

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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in duration-500">
        <Spinner size="lg" color="primary" label="Buscando as melhores mídias..."
          classNames={{ label: "text-primary font-bold mt-4" }}
        />
        <p className="text-default-400 text-sm animate-pulse">Isso pode levar alguns segundos enquanto carregamos os dados de <b>{activePlugin?.name}</b>  </p>
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

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
        >
          Atualizar
        </Button>
      </div>

      {sections.map((section, idx) => (
        <MediaCarousel
          key={`${section.name}-${idx}`}
          title={section.name}
          items={section.list}
          pluginId={activePlugin!.id}
        />
      ))}

      {sections.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-20 opacity-50">
          <p>Nenhum conteúdo encontrado para este plugin.</p>
        </div>
      )}
    </div>
  );
}
