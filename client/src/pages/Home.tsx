import { Button, Spinner } from '@heroui/react';
import { RefreshCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import MediaCarousel from '../components/media/MediaCarousel';
import { usePlugins } from '../hooks/usePlugins';
import { api, type HomeSection } from '../services/api';

export default function Home() {
  const { activePlugin } = usePlugins();
  const [sections, setSections] = useState<HomeSection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHome = async (isInitial = false) => {
    if (!activePlugin) return;
    
    let hasLocalCache = false;

    // Se for a primeira carga do plugin, tenta buscar do cache "físico" (disco) primeiro
    if (isInitial) {
      const cachedData = localStorage.getItem(`home_cache_${activePlugin.id}`);
      const storedBootId = localStorage.getItem('server_boot_id');
      
      try {
        const { bootId } = await api.getConfig();
        if (storedBootId !== bootId) {
          localStorage.clear();
          localStorage.setItem('server_boot_id', bootId);
        } else if (cachedData) {
          const parsed = JSON.parse(cachedData);
          setSections(parsed);
          hasLocalCache = true;
        }
      } catch (e) {
        console.warn('Falha ao validar sessão do servidor para cache');
      }

      // Se não tem cache, limpa as seções do plugin anterior para mostrar o loading
      if (!hasLocalCache) {
        setSections([]);
        setLoading(true);
      }
    }

    setError(null);
    try {
      const data = await api.getHome(activePlugin.id);
      setSections(data);
      localStorage.setItem(`home_cache_${activePlugin.id}`, JSON.stringify(data));
    } catch (err) {
      if (!hasLocalCache && sections.length === 0) setError('Falha ao carregar conteúdo da Home.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHome(true);
  }, [activePlugin]);

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
          onPress={() => fetchHome()}
        >
          Recarregar
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-700">
      {/* Hero Section placeholder - could be a featured item later */}
      <div className="mb-10 px-1">
        <h1 className="text-3xl font-extrabold mb-2 text-foreground/90 tracking-tight">
          Explorar <span className="text-primary">{activePlugin?.name}</span>
        </h1>
        <p className="text-default-500 max-w-lg">
          {activePlugin?.description || 'Navegue pelos melhores filmes e séries disponíveis para você.'}
        </p>
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
