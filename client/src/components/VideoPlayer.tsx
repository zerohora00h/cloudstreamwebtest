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

    let isMounted = true;
    setIsLoading(true);
    setIsPlaying(false);
    setError(null);
    let hls: Hls | null = null;

    // Detecção aprimorada: se contém 'get_video', '.mp4' ou não parece HLS, tratamos como MP4
    const urlLower = url.toLowerCase();
    const isExplicitHls = urlLower.includes('.m3u8') || urlLower.includes('type=hls') || urlLower.includes('m3u8');
    const isExplicitMp4 = urlLower.includes('.mp4') || urlLower.includes('get_video') || urlLower.includes('streamtape.com');
    
    // Tentamos HLS apenas se for explicitamente HLS ou não for explicitamente MP4
    const shouldTryHls = isExplicitHls || (!isExplicitMp4 && Hls.isSupported());

    const startNativePlayback = () => {
      if (!isMounted) return;
      console.log("[VideoPlayer] Starting native playback for:", url);
      video.src = url;
      video.load();
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn("[VideoPlayer] native play() failed:", err.message);
          if (isMounted) setIsPlaying(false);
        });
      }
    };

    if (shouldTryHls) {
      hls = new Hls({
        capLevelToPlayerSize: true,
        autoStartLoad: true,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isMounted) return;
        setIsLoading(false);
        video.play().catch(err => {
          console.warn("[VideoPlayer] HLS play() failed:", err.message);
          if (isMounted) setIsPlaying(false);
        });
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isMounted) return;
        
        if (data.fatal) {
          console.error('[VideoPlayer] HLS Fatal Error:', data.type, data.details);
          
          // Se for erro de rede ou de parsing no manifesto, tentamos fallback nativo
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) {
             console.log("[VideoPlayer] Attempting native fallback...");
             hls?.destroy();
             hls = null;
             startNativePlayback();
          } else {
            setError('Falha crítica no carregamento do vídeo.');
            setIsLoading(false);
            hls?.destroy();
          }
        }
      });
    } else {
      startNativePlayback();
    }

    const handleLoadedMetadata = () => {
      if (isMounted) setIsLoading(false);
    };
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      isMounted = false;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
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

  const [loadedProgress, setLoadedProgress] = useState(0);

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
      updateBuffered();
    }
  };

  const handleProgress = () => {
    updateBuffered();
  };

  const updateBuffered = () => {
    if (videoRef.current && videoRef.current.buffered.length > 0) {
      try {
        const bufferedEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
        setLoadedProgress(bufferedEnd);
      } catch (e) {}
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
        onProgress={handleProgress}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onEnded={onEnded}
        onError={handleVideoError}
        onClick={togglePlay}
        playsInline
        autoPlay
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
          <div className="px-2 relative w-full flex items-center h-4">
            {/* Custom Track and Buffer Bar */}
            <div className="absolute left-2 right-2 h-1 bg-white/20 rounded-full overflow-hidden pointer-events-none">
              <div 
                className="h-full bg-white/50 transition-all duration-300 ease-linear"
                style={{ width: `${duration > 0 ? (loadedProgress / duration) * 100 : 0}%` }}
              />
            </div>

            <Slider
              aria-label="Seeker"
              size="sm"
              color="primary"
              maxValue={duration}
              minValue={0}
              value={currentTime}
              onChange={handleSeek}
              className="absolute left-2 right-2 w-auto"
              classNames={{
                track: "bg-transparent border-transparent",
              }}
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
