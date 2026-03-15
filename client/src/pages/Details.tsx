import {
  Button,
  Card,
  CardBody,
  Chip,
  Image,
  ScrollShadow,
  Spinner,
  Tab,
  Tabs,
  Tooltip
} from '@heroui/react';
import {
  Calendar,
  ChevronLeft,
  Clock,
  CloudDownload,
  Info,
  ListVideo,
  Play,
  RefreshCcw,
  Star,
  CheckCircle
} from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MediaCard from '../components/media/MediaCard';
import { useSync } from '../contexts/SyncContext';
import { useSettings } from '../contexts/SettingsContext';
import { api, type Episode, type MediaDetails, type StreamLink } from '../services/api';

export default function Details() {
  const { pluginId, url } = useParams<{ pluginId: string; url: string }>();
  const navigate = useNavigate();
  const { startSync, updateProgress, endSync, failSync, cancelSync } = useSync();
  const { settings } = useSettings();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodesCache, setEpisodesCache] = useState<Record<number, Episode[]>>({}); 
  const [prefetchedSeasons, setPrefetchedSeasons] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [preloadedLinks, setPreloadedLinks] = useState<StreamLink[] | null>(null);
  const hasRecursiveSyncedRef = useRef(false);
  const abortSeriesRef = useRef<AbortController | null>(null);

  const fetchDetails = async (forceFresh = false) => {
    if (!pluginId || !url) return;
    
    if (forceFresh || !details) {
      if(!details) setLoading(true);
      if(forceFresh) startSync('Atualizando detalhes...');
      setEpisodesCache({});
      setPrefetchedSeasons(new Set());
      hasRecursiveSyncedRef.current = false;
    }

    try {
      const decodedUrl = decodeURIComponent(url);
      const data = await api.load(pluginId, decodedUrl, forceFresh);
      setDetails(data);
      
      if (data.type === 'TvSeries' && data.seasons && data.seasons.length > 0) {
        if (selectedSeason === null || forceFresh) setSelectedSeason(data.seasons[0]);
      }
      
      // Auto-refresh recommendations if they came empty and this was an initial cached load
      if (!forceFresh && (!data.recommendations || data.recommendations.length === 0) && !hasSyncedRecsRef.current) {
        hasSyncedRecsRef.current = true;
        setTimeout(async () => {
          try {
            const freshData = await api.load(pluginId, decodedUrl, true);
            if (freshData.recommendations && freshData.recommendations.length > 0) {
              setDetails(prev => prev ? { ...prev, recommendations: freshData.recommendations } : null);
            }
          } catch (e) {
            // Silently fail background recommendation fetch
          }
        }, 1500);
      }

      if (forceFresh) endSync();
    } catch (err) {
      console.error('Failed to load details', err);
      if (forceFresh) failSync();
    } finally {
      setLoading(false);
    }
  };

  // Recursive prefetch all seasons
  const recursivePrefetchSeasons = useCallback(async (
    pid: string,
    rawUrl: string,
    seasons: number[],
    concurrency: number,
  ) => {
    if (hasRecursiveSyncedRef.current) return;
    hasRecursiveSyncedRef.current = true;

    const controller = new AbortController();
    abortSeriesRef.current = controller;
    const signal = startSync('Pré-carregando temporadas... ');

    let done = 0;
    const total = seasons.length;
    const queue = [...seasons];

    const worker = async () => {
      while (queue.length > 0) {
        if (signal.aborted || controller.signal.aborted) return;
        const season = queue.shift()!;
        try {
          const decodedUrl = decodeURIComponent(rawUrl);
          const seasonUrl = decodedUrl.includes('?')
            ? `${decodedUrl}&requested_season=${season}`
            : `${decodedUrl}?requested_season=${season}`;

          const data = await api.load(pid, seasonUrl);
          if (signal.aborted || controller.signal.aborted) return;

          if (data.episodes) {
            setEpisodesCache(prev => ({
              ...prev,
              [season]: data.episodes!,
            }));
            setPrefetchedSeasons(prev => new Set(prev).add(season));
          }
        } catch {
          // Skip failed seasons
        }
        done++;
        if (!signal.aborted && !controller.signal.aborted) {
          updateProgress(done, total);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, seasons.length) },
      () => worker()
    );
    await Promise.all(workers);

    if (!signal.aborted && !controller.signal.aborted) {
      endSync();
    }
    abortSeriesRef.current = null;
  }, [startSync, updateProgress, endSync]);

  // Reload all seasons manually
  const handleReloadAllSeasons = useCallback(async () => {
    if (!pluginId || !url || !details?.seasons) return;
    
    setEpisodesCache({});
    setPrefetchedSeasons(new Set());
    hasRecursiveSyncedRef.current = false;

    const concurrency = settings?.recursiveConcurrency ?? 2;
    await recursivePrefetchSeasons(pluginId, url, details.seasons, concurrency);
  }, [pluginId, url, details?.seasons, settings?.recursiveConcurrency, recursivePrefetchSeasons]);

  useEffect(() => {
    cancelSync();
    if (abortSeriesRef.current) {
      abortSeriesRef.current.abort();
      abortSeriesRef.current = null;
    }
    hasRecursiveSyncedRef.current = false;
    hasSyncedRecsRef.current = false;
    setEpisodesCache({});
    setPrefetchedSeasons(new Set());
    fetchDetails(false);
    window.scrollTo(0, 0);
  }, [pluginId, url]);

  // Prefetch movie links
  useEffect(() => {
    if (!pluginId || !details?.url || details.type !== 'Movie') return;

    let isMounted = true;
    const prefetchMovieLinks = async () => {
      try {
        const result = await api.loadLinks(pluginId, details.dataUrl || details.url);
        if (isMounted && result.length > 0) {
          setPreloadedLinks(result);
        }
      } catch (err) {
        console.error('Falha no prefetch dos links do filme', err);
      }
    };

    prefetchMovieLinks();
    
    return () => {
      isMounted = false;
    };
  }, [pluginId, details]);

  // Load episodes when season changes (normal behavior)
  useEffect(() => {
    if (!pluginId || !url || selectedSeason === null || !details || details.type !== 'TvSeries') return;
    if (episodesCache[selectedSeason]) return;

    const fetchEpisodes = async () => {
      setLoadingEpisodes(true);
      try {
        const decodedUrl = decodeURIComponent(url);
        const seasonUrl = decodedUrl.includes('?') 
          ? `${decodedUrl}&requested_season=${selectedSeason}` 
          : `${decodedUrl}?requested_season=${selectedSeason}`;
        
        const data = await api.load(pluginId, seasonUrl);
        if (data.episodes) {
          setEpisodesCache(prev => ({
            ...prev,
            [selectedSeason]: data.episodes!
          }));
        }
      } catch (err) {
        console.error('Failed to load episodes', err);
      } finally {
        setLoadingEpisodes(false);
      }
    };

    fetchEpisodes();
  }, [pluginId, url, selectedSeason, details?.type, episodesCache]);

  // Background sync for missing recommendations (cache refresh)
  const hasSyncedRecsRef = useRef(false);

  // Recursive series prefetch after details load
  useEffect(() => {
    if (!pluginId || !url || !details || details.type !== 'TvSeries') return;
    if (!details.seasons || details.seasons.length === 0) return;
    if (!settings?.recursiveSeriesSync || hasRecursiveSyncedRef.current) return;

    const concurrency = settings?.recursiveConcurrency ?? 2;

    const timer = setTimeout(() => {
      recursivePrefetchSeasons(pluginId, url, details.seasons!, concurrency);
    }, 1500);

    return () => clearTimeout(timer);
  }, [pluginId, url, details, settings?.recursiveSeriesSync, settings?.recursiveConcurrency, recursivePrefetchSeasons]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelSync();
      if (abortSeriesRef.current) {
        abortSeriesRef.current.abort();
      }
    };
  }, [cancelSync]);

  const currentEpisodes = selectedSeason !== null ? episodesCache[selectedSeason] || [] : [];

  const handlePlay = (episode?: Episode) => {
    if (!details || !pluginId) return;
    const mediaData = episode ? episode.data : (details.dataUrl || details.url);
    const videoTitle = episode ? `${details.name} - S${episode.season}E${episode.episode}` : details.name;

    let watchUrl = `/watch?pluginId=${pluginId}&data=${encodeURIComponent(mediaData)}&title=${encodeURIComponent(videoTitle)}&originalUrl=${encodeURIComponent(url || '')}`;
    if (episode) {
      watchUrl += `&season=${episode.season}&episode=${episode.episode}`;
    }

    navigate(watchUrl, {
      state: { preloadedLinks: episode ? null : preloadedLinks }
    });
  };


  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <Spinner size="lg" color="primary" label="Carregando detalhes..." />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-xl opacity-50">Não foi possível carregar os detalhes.</p>
        <Button variant="flat" onPress={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-1000">
      <div className="flex justify-between items-center mb-6">
        <Button
          variant="light"
          size="sm"
          startContent={<ChevronLeft className="w-4 h-4" />}
          className="opacity-70 hover:opacity-100"
          onPress={() => navigate(-1)}
        >
          Voltar
        </Button>
        <Button
          variant="flat"
          size="sm"
          color="primary"
          startContent={<RefreshCcw className="w-4 h-4" />}
          onPress={() => fetchDetails(true)}
        >
          Atualizar
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-12">
        {/* Poster Column */}
        <div className="w-full md:w-[300px] lg:w-[350px] shrink-0">
          <div className="sticky top-24">
            {details.posterUrl ? (
              <Image
                src={details.posterUrl}
                alt={details.name}
                className="w-full shadow-2xl shadow-primary/10"
                radius="lg"
              />
            ) : (
              <div className="w-full aspect-2/3 flex flex-col items-center justify-center bg-linear-to-br from-primary/20 to-secondary/20 shadow-2xl shadow-primary/10 rounded-xl p-6 text-center">
                <span className="text-3xl font-black text-white/80 drop-shadow-md leading-tight">
                  {details.name}
                </span>
              </div>
            )}

            {details.type === 'Movie' && (
              <Button
                color="primary"
                size="lg"
                fullWidth
                className="mt-6 font-bold shadow-lg shadow-primary/30"
                startContent={<Play className="w-5 h-5 fill-current" />}
                onPress={() => handlePlay()}
              >
                ASSISTIR AGORA
              </Button>
            )}
          </div>
        </div>

        {/* Content Column */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Chip
              color={details.type === 'TvSeries' ? 'secondary' : 'primary'}
              variant="flat"
              className="font-bold"
            >
              {details.type === 'TvSeries' ? 'Série' : details.type === 'Anime' ? 'Anime' : 'Filme'}
            </Chip>
            {details.year && (
              <Chip variant="flat" startContent={<Calendar className="w-3 h-3" />}>
                {details.year}
              </Chip>
            )}
            {details.score && (
              <Chip color="warning" variant="flat" className="font-bold" startContent={<Star className="w-3 h-3 fill-current" />}>
                {details.score.toFixed(1)}
              </Chip>
            )}
            {details.duration && (
              <Chip variant="flat" startContent={<Clock className="w-3 h-3" />}>
                {details.duration} min
              </Chip>
            )}
          </div>

          <h1 className="text-4xl lg:text-5xl font-black mb-6 tracking-tight leading-tight">
            {details.name}
          </h1>

          {details.tags && (
            <div className="flex flex-wrap gap-2 mb-8">
              {details.tags.map(tag => (
                <Chip key={tag} size="sm" variant="dot" className="border-white/10 text-default-500">
                  {tag}
                </Chip>
              ))}
            </div>
          )}

          <div className="mb-10">
            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-primary" /> Sinopse
            </h3>
            <p className="text-default-500 leading-relaxed text-lg">
              {details.plot || 'Nenhuma sinopse disponível para este título.'}
            </p>
          </div>

          {/* Episodes Section for Series */}
          {(details.type === 'TvSeries' && details.seasons && details.seasons.length > 0) && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <ListVideo className="w-4 h-4 text-primary" /> Episódios
                </h3>
                <div className="flex items-center gap-2">
                  {prefetchedSeasons.size > 0 && (
                    <Tooltip content="Temporadas pré-carregadas pelo sync recursivo">
                      <Chip size="sm" variant="flat" color="success" startContent={<CheckCircle className="w-3 h-3" />}>
                        {prefetchedSeasons.size}/{details.seasons.length}
                      </Chip>
                    </Tooltip>
                  )}
                  <Tooltip content="Recarregar todas as temporadas">
                    <Button
                      isIconOnly
                      variant="flat"
                      size="sm"
                      color="warning"
                      onPress={handleReloadAllSeasons}
                    >
                      <CloudDownload className="w-4 h-4" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              
              <Tabs
                aria-label="Seasons"
                color="primary"
                variant="solid"
                className="mb-6"
                selectedKey={selectedSeason !== null ? selectedSeason.toString() : undefined}
                onSelectionChange={(key) => setSelectedSeason(parseInt(key.toString()))}
              >
                {details.seasons.map(season => (
                  <Tab
                    key={season.toString()}
                    title={
                      <div className="flex items-center gap-1.5">
                        <span>Temporada {season}</span>
                        {prefetchedSeasons.has(season) && (
                          <CheckCircle className="w-3 h-3 text-success" />
                        )}
                      </div>
                    }
                  >
                    {loadingEpisodes ? (
                      <div className="flex justify-center py-10">
                        <Spinner size="md" label="Carregando episódios..." />
                      </div>
                    ) : (
                      <ScrollShadow className="max-h-[500px] pr-2">
                        {currentEpisodes.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {currentEpisodes.map((ep, idx) => (
                              <Card
                                key={idx}
                                isPressable
                                className="bg-default-100/30 hover:bg-default-100/50 border border-white/5"
                                onPress={() => handlePlay(ep)}
                              >
                                <CardBody className="py-3 px-4 flex flex-row items-center gap-3">
                                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <Play className="w-3 h-3 text-primary fill-primary" />
                                  </div>
                                  <div className="flex-1 overflow-hidden">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-bold truncate">{ep.name}</p>
                                      {prefetchedSeasons.has(ep.season) && (
                                        <CheckCircle className="w-3 h-3 text-success shrink-0" />
                                      )}
                                    </div>
                                    <p className="text-[10px] text-default-400">Temp {ep.season} • {ep.episode > 0 ? `Ep ${ep.episode}` : 'Especial'}</p>
                                  </div>
                                </CardBody>
                              </Card>
                            ))}
                          </div>
                        ) : (
                          <p className="text-center py-10 opacity-50">Nenhum episódio encontrado para esta temporada.</p>
                        )}
                      </ScrollShadow>
                    )}
                  </Tab>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {details.recommendations && details.recommendations.length > 0 && (
        <div className="mt-20">
          <h3 className="text-2xl font-bold mb-8">Títulos Semelhantes</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {details.recommendations.map((item, idx) => (
              <MediaCard key={idx} item={item} pluginId={pluginId!} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
