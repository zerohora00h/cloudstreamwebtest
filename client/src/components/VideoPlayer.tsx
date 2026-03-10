import { Button, Slider, Spinner, Tooltip } from '@heroui/react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
  url: string;
  title?: string;
  poster?: string;
  onEnded?: () => void;
}

export default function VideoPlayer({ url, title, poster, onEnded }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(null);
    let hls: Hls | null = null;

    // Prioriza HLS por padrão, a menos que seja explicitamente .mp4
    const isMp4 = url.toLowerCase().includes('.mp4');
    const isHls = !isMp4 || url.includes('.m3u8') || url.includes('type=hls');

    if (isHls && Hls.isSupported()) {
      hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('HLS Fatal Error:', data.type);
          setError('O servidor de vídeo retornou um erro fatal (500 ou indisponível).');
          setIsLoading(false);
          hls?.destroy();
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Suporte nativo Safari/iOS
      video.src = url;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
    } else {
      // Fallback para MP4 ou outros formatos nativos
      video.src = url;
      video.addEventListener('loadedmetadata', () => setIsLoading(false));
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [url]);

  // Implementação de atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se o usuário estiver digitando em um input (caso existam no futuro)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'arrowright':
          skip(10);
          break;
        case 'arrowleft':
          skip(-10);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isFullscreen, isMuted, volume]); // Dependências necessárias para que os estados reflitam corretamente nas funções chamadas

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (value: number | number[]) => {
    const val = Array.isArray(value) ? value[0] : value;
    if (videoRef.current) {
      videoRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number | number[]) => {
    const val = Array.isArray(value) ? value[0] : value;
    if (videoRef.current) {
      videoRef.current.volume = val;
      setVolume(val);
      setIsMuted(val === 0);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
    }, 3000);
  };

  const skip = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds;
    }
  };

  const handleVideoError = () => {
    setError('Não foi possível carregar este vídeo. O link pode ter expirado ou o servidor está offline.');
    setIsLoading(false);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0} // Permite que o container receba foco para atalhos
      className="relative w-full h-full bg-black group overflow-hidden outline-none"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      <video
        ref={videoRef}
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={onEnded}
        onError={handleVideoError}
        onClick={togglePlay}
        playsInline
        poster={poster}
      />

      {/* Loading Overlay */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
          <Spinner size="lg" color="primary" label="Carregando buffer..." />
        </div>
      )}

      {/* Error Overlay */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-40 gap-4 p-6 text-center">
          <AlertCircle className="w-16 h-16 text-danger animate-pulse" />
          <div className="space-y-2">
            <h4 className="text-xl font-bold text-white">Erro na Fonte</h4>
            <p className="text-default-400 text-sm max-w-xs mx-auto">{error}</p>
          </div>
          <Button color="primary" variant="flat" onPress={() => window.location.reload()}>
            Tentar Recarregar
          </Button>
        </div>
      )}

      {/* Custom Controls Overlay */}
      <div className={`absolute inset-0 z-30 flex flex-col justify-between transition-opacity duration-300 bg-linear-to-t from-black/80 via-transparent to-black/40 ${showControls || !isPlaying ? 'opacity-100' : 'opacity-0'}`}>

        {/* Top bar */}
        <div className="p-4 flex items-center justify-between">
          <h3 className="text-white font-medium truncate">{title}</h3>
          <div className="flex items-center gap-2">
            <Tooltip content="Configurações">
              <Button isIconOnly variant="light" size="sm" className="text-white">
                <Settings className="w-5 h-5" />
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Center UI (Play/Pause big button or seeking indicators) */}
        <div className="flex-1 flex items-center justify-center" onClick={togglePlay}>
          {!isPlaying && !isLoading && (
            <div className="p-6 rounded-full bg-primary/20 backdrop-blur-md border border-white/10 text-white scale-125 transition-transform hover:scale-150">
              <Play className="w-10 h-10 fill-current" />
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="p-4 space-y-4">
          {/* Progress Bar */}
          <div className="px-2">
            <Slider
              aria-label="Seeker"
              size="sm"
              color="primary"
              maxValue={duration}
              minValue={0}
              value={currentTime}
              onChange={handleSeek}
              className="max-w-full"
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button isIconOnly variant="light" size="sm" className="text-white" onPress={togglePlay}>
                {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
              </Button>

              <div className="flex items-center gap-1">
                <Button isIconOnly variant="light" size="sm" className="text-white" onPress={() => skip(-10)}>
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button isIconOnly variant="light" size="sm" className="text-white" onPress={() => skip(10)}>
                  <RotateCw className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-2 group/volume">
                <Button isIconOnly variant="light" size="sm" className="text-white" onPress={toggleMute}>
                  {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </Button>
                <div className="w-0 group-hover/volume:w-24 transition-all duration-300 overflow-hidden">
                  <Slider
                    aria-label="Volume"
                    size="sm"
                    color="primary"
                    maxValue={1}
                    minValue={0}
                    step={0.1}
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>

              <span className="text-white text-xs font-mono ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button isIconOnly variant="light" size="sm" className="text-white" onPress={toggleFullscreen}>
                {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
