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

  const fetchHome = async () => {
    if (!activePlugin) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getHome(activePlugin.id);
      setSections(data);
    } catch (err) {
      setError('Falha ao carregar conteúdo da Home. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHome();
  }, [activePlugin]);

  if (loading && sections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spinner size="lg" color="primary" label="Populando o site..." />
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
          onPress={fetchHome}
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
