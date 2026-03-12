import {
  Button,
  Card,
  CardBody,
  Chip,
  Image,
  ScrollShadow,
  Spinner,
  Tab,
  Tabs
} from '@heroui/react';
import {
  Calendar,
  ChevronLeft,
  Clock,
  Info,
  ListVideo,
  Play,
  Star
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import MediaCard from '../components/media/MediaCard';
import { api, type Episode, type MediaDetails } from '../services/api';

export default function Details() {
  const { pluginId, url } = useParams<{ pluginId: string; url: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodesCache, setEpisodesCache] = useState<Record<number, Episode[]>>({}); // Cache em memória
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  useEffect(() => {
    if (!pluginId || !url) return;

    const fetchDetails = async () => {
      setLoading(true);
      setEpisodesCache({}); // Limpa o cache ao mudar de título
      try {
        const decodedUrl = decodeURIComponent(url);
        const data = await api.load(pluginId, decodedUrl);
        setDetails(data);
        
        // Se for uma série e tiver temporadas, seleciona a primeira por padrão
        if (data.type === 'TvSeries' && data.seasons && data.seasons.length > 0) {
          setSelectedSeason(data.seasons[0]);
        }
      } catch (err) {
        console.error('Failed to load details', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
    window.scrollTo(0, 0);
  }, [pluginId, url]);

  // Efeito para carregar episódios quando a temporada muda
  useEffect(() => {
    if (!pluginId || !url || selectedSeason === null || !details || details.type !== 'TvSeries') return;

    // Se já temos a temporada no cache, não busca novamente
    if (episodesCache[selectedSeason]) {
      return;
    }

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

  const currentEpisodes = selectedSeason !== null ? episodesCache[selectedSeason] || [] : [];

  const handlePlay = (episode?: Episode) => {
    if (!details || !pluginId) return;
    const mediaData = episode ? episode.data : (details.dataUrl || details.url);
    const videoTitle = episode ? `${details.name} - S${episode.season}E${episode.episode}` : details.name;

    navigate(`/watch?pluginId=${pluginId}&data=${encodeURIComponent(mediaData)}&title=${encodeURIComponent(videoTitle)}`);
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
      <Button
        variant="light"
        size="sm"
        startContent={<ChevronLeft className="w-4 h-4" />}
        className="mb-6 opacity-70 hover:opacity-100"
        onPress={() => navigate(-1)}
      >
        Voltar
      </Button>

      <div className="flex flex-col md:flex-row gap-8 lg:gap-12 mb-12">
        {/* Poster Column */}
        <div className="w-full md:w-[300px] lg:w-[350px] shrink-0">
          <div className="sticky top-24">
            <Image
              src={details.posterUrl || 'https://via.placeholder.com/400x600?text=No+Image'}
              alt={details.name}
              className="w-full shadow-2xl shadow-primary/10"
              radius="lg"
            />

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
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <ListVideo className="w-4 h-4 text-primary" /> Episódios
              </h3>
              
              <Tabs
                aria-label="Seasons"
                color="primary"
                variant="solid"
                className="mb-6"
                selectedKey={selectedSeason?.toString()}
                onSelectionChange={(key) => setSelectedSeason(parseInt(key.toString()))}
              >
                {details.seasons.map(season => (
                  <Tab key={season.toString()} title={`Temporada ${season}`}>
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
                                    <p className="text-sm font-bold truncate">{ep.name}</p>
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
