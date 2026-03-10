import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Listbox,
  ListboxItem,
  Spinner
} from '@heroui/react';
import {
  AlertCircle,
  ChevronLeft,
  Server,
  Tv
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { api, type StreamLink } from '../services/api';

export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const pluginId = searchParams.get('pluginId');
  const data = searchParams.get('data');
  const title = searchParams.get('title') || 'Reproduzindo';

  const [links, setLinks] = useState<StreamLink[]>([]);
  const [activeLink, setActiveLink] = useState<StreamLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pluginId || !data) return;

    const fetchLinks = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await api.loadLinks(pluginId, data);
        if (result.length > 0) {
          setLinks(result);
          setActiveLink(result[0]);
        } else {
          setError('Nenhum link de streaming encontrado.');
        }
      } catch (err) {
        console.error('Failed to load links', err);
        setError('Erro ao carregar os servidores de vídeo.');
      } finally {
        setLoading(false);
      }
    };

    fetchLinks();
  }, [pluginId, data]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-4">
        <Spinner size="lg" color="primary" label="Buscando servidores..." />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000">
      <div className="flex items-center justify-between mb-6">
        <Button
          variant="light"
          size="sm"
          startContent={<ChevronLeft className="w-4 h-4" />}
          onPress={() => navigate(-1)}
        >
          Voltar
        </Button>
        <h1 className="text-xl font-bold truncate max-w-md">{title}</h1>
        <div className="w-20" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Player Column */}
        <div className="flex-1 min-w-0">
          <div className="aspect-video bg-black rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 relative group">
            {activeLink ? (
              <VideoPlayer
                url={activeLink.url}
                title={title}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black/80 gap-3">
                <AlertCircle className="w-12 h-12 text-danger" />
                <p className="text-lg font-medium">{error || 'Selecione um servidor'}</p>
                <Button color="primary" variant="flat" onPress={() => navigate(-1)}>Voltar</Button>
              </div>
            )}

            {error && !loading && !activeLink && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 z-50">
                <AlertCircle className="w-12 h-12 text-danger" />
                <p className="text-lg font-medium">{error}</p>
                <Button color="primary" variant="flat" onPress={() => navigate(-1)}>Voltar</Button>
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Tv className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-default-400">Servidor Ativo</p>
                <p className="font-bold">{activeLink?.name || 'Automático'}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Chip variant="flat" size="sm" color="success">
                {activeLink?.quality || 'Auto'}
              </Chip>
              <Chip variant="flat" size="sm" className="bg-white/5 opacity-50">
                Premium Player (Vidstack)
              </Chip>
            </div>
          </div>
        </div>

        {/* Servers Column */}
        <div className="w-full lg:w-[320px] shrink-0">
          <Card className="bg-default-100/30 border border-white/5">
            <CardBody className="p-4">
              <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                <Server className="w-4 h-4 text-primary" /> Opções de Servidor
              </h3>
              <Divider className="mb-4 opacity-5" />

              <Listbox
                aria-label="Selection of video servers"
                variant="flat"
                disallowEmptySelection
                selectionMode="single"
                selectedKeys={activeLink ? new Set([activeLink.url]) : new Set()}
                onSelectionChange={(keys) => {
                  const url = Array.from(keys)[0] as string;
                  const link = links.find((l: StreamLink) => l.url === url);
                  if (link) {
                    setActiveLink(link);
                    setError(null);
                  }
                }}
              >
                {links.map((link: StreamLink, idx: number) => (
                  <ListboxItem
                    key={link.url}
                    description={link.quality}
                    startContent={
                      <div className={`w-2 h-2 rounded-full ${activeLink?.url === link.url ? 'bg-primary' : 'bg-default-300'}`} />
                    }
                  >
                    {link.name || `Servidor ${idx + 1}`}
                  </ListboxItem>
                ))}
              </Listbox>

              {links.length === 0 && !loading && (
                <p className="text-sm text-default-400 italic text-center py-4">
                  Nenhum servidor disponível.
                </p>
              )}
            </CardBody>
          </Card>

          <div className="mt-6 p-4 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-[10px] text-primary/70 leading-relaxed uppercase font-bold tracking-wider mb-1">
              Controles do Player
            </p>
            <p className="text-xs text-default-400 leading-relaxed">
              Use as teclas <strong>Espaço</strong> para Play/Pause, <strong>F</strong> para Fullscreen e as <strong>Setas</strong> para avançar/retroceder 10 segundos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
