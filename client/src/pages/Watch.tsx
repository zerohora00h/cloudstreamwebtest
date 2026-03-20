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
  Loader2,
  Play,
  Server,
  Tv
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';
import { api, type Episode, type MediaDetails, type StreamLink } from '../services/api';

const detailsCache: Record<string, MediaDetails> = {};

export default function Watch() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const pluginId = searchParams.get('pluginId');
  const data = searchParams.get('data');
  const title = searchParams.get('title') || 'Reproduzindo';
  const originalUrl = searchParams.get('originalUrl');
  const seasonParam = searchParams.get('season');
  const episodeParam = searchParams.get('episode');

  const location = useLocation();
  const preloadedLinks = location.state?.preloadedLinks as StreamLink[] | undefined;

  const [links, setLinks] = useState<StreamLink[]>([]);
  const [activeLink, setActiveLink] = useState<StreamLink | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);

  const [mediaDetails, setMediaDetails] = useState<MediaDetails | null>(
    originalUrl ? detailsCache[originalUrl] || null : null
  );
  const [loadingDetails, setLoadingDetails] = useState(false);

  const extractingRef = useRef<Set<string>>(new Set());

  // 1. Busca os links brutos (rápido)
  useEffect(() => {
    if (!pluginId || !data) return;

    const fetchRawLinks = async () => {
      setLoadingLinks(true);
      setError(null);
      try {
        let result: StreamLink[] = [];
        if (preloadedLinks && preloadedLinks.length > 0) {
          result = preloadedLinks.map(l => ({ ...l, status: 'extracted' }));
        } else {
          result = await api.getRawLinks(pluginId, data);
          result = result.map(l => ({ ...l, status: 'raw' }));
        }

        if (result.length > 0) {
          setLinks(result);
          setActiveLink(result[0]);
        } else {
          setError('Nenhum link de streaming encontrado.');
        }
      } catch (err) {
        console.error('Failed to load raw links', err);
        setError('Erro ao carregar os servidores de vídeo.');
      } finally {
        setLoadingLinks(false);
      }
    };

    fetchRawLinks();
  }, [pluginId, data, preloadedLinks]);

  // 2. Lógica de Extração Progressiva
  const extractOne = useCallback(async (linkToExtract: StreamLink) => {
    if (!pluginId || !linkToExtract.url || linkToExtract.status !== 'raw') return;
    if (extractingRef.current.has(linkToExtract.url)) return;

    extractingRef.current.add(linkToExtract.url);

    // Atualiza status para extracting
    setLinks(prev => prev.map(l => l.url === linkToExtract.url ? { ...l, status: 'extracting' } : l));
    if (activeLink?.url === linkToExtract.url) {
      setActiveLink(prev => prev ? { ...prev, status: 'extracting' } : null);
    }

    try {
      const result = await api.extractLink(pluginId, linkToExtract);
      if (result && result.length > 0) {
        const extracted = { ...result[0], status: 'extracted' as const };

        setLinks(prev => {
          const index = prev.findIndex(l => l.url === linkToExtract.url);
          if (index === -1) return prev;

          const newLinks = [...prev];
          newLinks[index] = extracted;
          return newLinks;
        });

        setActiveLink(prev => prev?.url === linkToExtract.url ? extracted : prev);
      } else {
        throw new Error('Extraction failed');
      }
    } catch (err) {
      console.error('Extraction error', err);
      setLinks(prev => prev.map(l => l.url === linkToExtract.url ? { ...l, status: 'error' } : l));
      if (activeLink?.url === linkToExtract.url) {
        setActiveLink(prev => prev ? { ...prev, status: 'error' } : null);
      }
    } finally {
      extractingRef.current.delete(linkToExtract.url);
    }
  }, [pluginId, activeLink]);

  // Efeito para priorizar o link ativo e processar a fila
  useEffect(() => {
    if (loadingLinks || links.length === 0) return;

    if (activeLink && activeLink.status === 'raw') {
      extractOne(activeLink);
      return;
    }

    const nextInQueue = links.find(l => l.status === 'raw');
    if (nextInQueue) {
      extractOne(nextInQueue);
    }
  }, [links, activeLink, loadingLinks, extractOne]);

  // Auto-fallback: when the player reports a source error before playback,
  // advance to the next available extracted or raw link.
  const handleSourceError = useCallback(() => {
    setLinks(prev => {
      const updated = prev.map(l =>
        l.url === activeLink?.url ? { ...l, status: 'error' as const } : l
      );

      const failedName = activeLink?.name || 'Servidor';

      // Find next link that is already extracted or still raw (will be extracted automatically)
      const nextLink = updated.find(
        l => l.url !== activeLink?.url && (l.status === 'extracted' || l.status === 'raw')
      );

      if (nextLink) {
        console.log(`[Watch] Fallback: ${failedName} failed, advancing to ${nextLink.name}`);
        setFallbackMessage(`Fonte "${failedName}" falhou. Tentando "${nextLink.name}"...`);
        // Use setTimeout to avoid state update during render
        setTimeout(() => setActiveLink(nextLink), 0);
      } else {
        console.log('[Watch] All sources exhausted, no fallback available');
        setFallbackMessage(null);
        setError('Todas as fontes falharam. Nenhum servidor disponível.');
      }

      return updated;
    });
  }, [activeLink]);

  // Clear fallback message once a source plays successfully
  useEffect(() => {
    if (activeLink?.status === 'extracted') {
      // Keep the message briefly so the user sees what happened, then clear
      const timer = setTimeout(() => setFallbackMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [activeLink]);



  // 4. Busca detalhes em background para exibir temporadas/episodios
  useEffect(() => {
    if (!pluginId || !originalUrl) return;

    let fetchUrl = originalUrl;
    if (seasonParam && !fetchUrl.includes('requested_season')) {
      fetchUrl = fetchUrl.includes('?')
        ? `${fetchUrl}&requested_season=${seasonParam}`
        : `${fetchUrl}?requested_season=${seasonParam}`;
    }

    if (detailsCache[fetchUrl] || mediaDetails) return;

    let isMounted = true;
    const fetchBackgroundDetails = async () => {
      setLoadingDetails(true);
      try {
        const decodedUrl = decodeURIComponent(fetchUrl);
        const data = await api.load(pluginId, decodedUrl);
        if (isMounted) {
          detailsCache[fetchUrl] = data;
          setMediaDetails(data);
        }
      } catch (err) {
        console.log('Fundo: erro ao carregar detalhes', err);
      } finally {
        if (isMounted) setLoadingDetails(false);
      }
    };

    fetchBackgroundDetails();
    return () => { isMounted = false; };
  }, [pluginId, originalUrl, seasonParam, mediaDetails]);

  const handlePlayEpisode = (ep: Episode) => {
    if (!pluginId || !originalUrl) return;
    const baseTitle = mediaDetails?.name || title.split(' - ')[0];
    const videoTitle = `${baseTitle} - S${ep.season}E${ep.episode}`;
    let watchUrl = `/watch?pluginId=${pluginId}&data=${encodeURIComponent(ep.data)}&title=${encodeURIComponent(videoTitle)}&originalUrl=${encodeURIComponent(originalUrl)}`;
    watchUrl += `&season=${ep.season}&episode=${ep.episode}`;
    navigate(watchUrl);
  };

  const getLinkStatusIcon = (status?: string) => {
    switch (status) {
      case 'extracting': return <Loader2 className="w-3 h-3 text-primary animate-spin" />;
      case 'error': return <AlertCircle className="w-3 h-3 text-danger" />;
      default: return null;
    }
  };

  const getLinkStatusText = (status?: string) => {
    switch (status) {
      case 'extracting': return 'Extraindo...';
      case 'extracted': return 'Pronto';
      case 'error': return 'Erro';
      default: return 'Na fila';
    }
  };

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
            {activeLink && activeLink.status === 'extracted' ? (
              <VideoPlayer
                url={activeLink.url}
                type={activeLink.type}
                title={title}
                onSourceError={handleSourceError}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/50 backdrop-blur-sm gap-4">
                {activeLink?.status === 'error' ? (
                  <>
                    <AlertCircle className="w-12 h-12 text-danger" />
                    <p className="text-lg font-medium">Falha ao extrair este link.</p>
                    <Button color="primary" variant="flat" onPress={() => navigate(-1)}>Voltar</Button>
                  </>
                ) : (
                  <>
                    <div className="relative">
                      <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Server className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xl font-bold text-white">
                        {activeLink?.status === 'extracting' ? 'Extraindo link direto...' : 'Preparando servidor...'}
                      </p>
                      <p className="text-default-400 text-sm italic">
                        {activeLink?.name} • {activeLink?.quality}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            {loadingLinks && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md">
                <Spinner size="lg" color="primary" label="Buscando lista de servidores..." />
              </div>
            )}

            {error && !loadingLinks && links.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-3 z-50">
                <AlertCircle className="w-12 h-12 text-danger" />
                <p className="text-lg font-medium">{error}</p>
                <Button color="primary" variant="flat" onPress={() => navigate(-1)}>Voltar</Button>
              </div>
            )}

            {/* Fallback progress indicator */}
            {fallbackMessage && (
              <div className="absolute bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom duration-300">
                <div className="bg-warning/10 border border-warning/30 backdrop-blur-md rounded-lg px-4 py-2 flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-warning animate-spin shrink-0" />
                  <p className="text-sm text-warning font-medium">{fallbackMessage}</p>
                </div>
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
                <p className="font-bold">{activeLink?.name || 'Iniciando...'}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Chip
                variant="flat"
                size="sm"
                color={activeLink?.status === 'extracted' ? 'success' : 'warning'}
                className="font-bold"
              >
                {activeLink?.status === 'extracted' ? activeLink.quality : getLinkStatusText(activeLink?.status)}
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
                    description={
                      <div className="flex items-center gap-2">
                        <span>{link.quality}</span>
                        <span className="text-[10px] opacity-50">•</span>
                        <span className={`text-[10px] ${link.status === 'extracted' ? 'text-success' : link.status === 'error' ? 'text-danger' : 'text-default-400'}`}>
                          {getLinkStatusText(link.status)}
                        </span>
                      </div>
                    }
                    startContent={
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${activeLink?.url === link.url ? 'bg-primary' : 'bg-default-300'}`} />
                        {getLinkStatusIcon(link.status)}
                      </div>
                    }
                  >
                    {link.name || `Servidor ${idx + 1}`}
                  </ListboxItem>
                ))}
              </Listbox>

              {links.length === 0 && !loadingLinks && (
                <p className="text-sm text-default-400 italic text-center py-4">
                  Nenhum servidor disponível.
                </p>
              )}
            </CardBody>
          </Card>

          {mediaDetails?.type === 'TvSeries' && mediaDetails.episodes && seasonParam && episodeParam && (
            (() => {
              const currentSeason = parseInt(seasonParam);
              const currentEpisode = parseInt(episodeParam);
              const nextEp = mediaDetails.episodes.find(ep => ep.season === currentSeason && ep.episode === currentEpisode + 1);
              return nextEp ? (
                <Button
                  color="secondary"
                  variant="flat"
                  fullWidth
                  className="mt-6 py-6 flex flex-col items-center justify-center gap-1 h-auto border border-secondary/20 hover:bg-secondary/10"
                  onPress={() => handlePlayEpisode(nextEp)}
                >
                  <span className="text-[10px] uppercase font-bold tracking-widest opacity-70">Avançar para</span>
                  <span className="font-bold text-sm">Próximo Episódio ({nextEp.episode})</span>
                </Button>
              ) : null;
            })()
          )}

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

      {mediaDetails?.type === 'TvSeries' && mediaDetails.episodes && mediaDetails.episodes.length > 0 && (
        <div className="mt-12 mb-20">
          <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
            Episódios desta Temporada
            {loadingDetails && <Spinner size="sm" className="ml-2" />}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {mediaDetails.episodes
              .filter(ep => ep.season === parseInt(seasonParam || '1'))
              .map((ep, idx) => {
                const isCurrent = data === ep.data;
                return (
                  <Card
                    key={idx}
                    isPressable={!isCurrent}
                    className={`border ${isCurrent ? 'bg-primary/20 border-primary shadow-lg shadow-primary/10' : 'bg-default-100/30 hover:bg-default-100/50 border-white/5'}`}
                    onPress={() => !isCurrent && handlePlayEpisode(ep)}
                  >
                    <CardBody className="py-3 px-4 flex flex-row items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isCurrent ? 'bg-primary text-white' : 'bg-primary/20 text-primary'}`}>
                        {isCurrent ? <Tv className="w-4 h-4" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
                      </div>
                      <div className="flex-1 overflow-hidden text-left">
                        <p className={`text-sm font-bold truncate ${isCurrent ? 'text-primary' : ''}`}>
                          {ep.name}
                        </p>
                        <p className={`text-xs ${isCurrent ? 'text-primary-400' : 'text-default-400'}`}>
                          Temp {ep.season} • {ep.episode > 0 ? `Ep ${ep.episode}` : 'Especial'}
                          {isCurrent && ' (Reproduzindo)'}
                        </p>
                      </div>
                    </CardBody>
                  </Card>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
