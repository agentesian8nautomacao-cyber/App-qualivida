import React, { useState, useRef, useEffect } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mostrar botão de pular após 2 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2000);

    // Configurar vídeo
    const video = videoRef.current;
    if (video) {
      // Tentar carregar o vídeo
      video.load();
      
      // Auto-play do vídeo
      const playPromise = video.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setIsLoading(false);
          })
          .catch((error) => {
            console.error('Erro ao reproduzir vídeo:', error);
            setIsPlaying(false);
            setIsLoading(false);
            setHasError(true);
          });
      }

      // Event listeners
      video.addEventListener('loadeddata', () => {
        setIsLoading(false);
      });

      video.addEventListener('error', (e) => {
        console.error('Erro ao carregar vídeo:', e);
        setHasError(true);
        setIsLoading(false);
      });
    }

    return () => {
      clearTimeout(skipTimer);
      if (video) {
        video.removeEventListener('loadeddata', () => {});
        video.removeEventListener('error', () => {});
      }
    };
  }, []);

  const handleVideoEnd = () => {
    onComplete();
  };

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onComplete();
  };

  const handleVideoPlay = () => {
    setIsPlaying(true);
    setIsLoading(false);
  };

  const handleVideoPause = () => {
    setIsPlaying(false);
  };

  const handleVideoError = () => {
    setHasError(true);
    setIsLoading(false);
  };

  // Se houver erro, mostrar mensagem e permitir pular
  if (hasError) {
    return (
      <div className="fixed inset-0 z-[10000] bg-black flex items-center justify-center overflow-hidden">
        <div className="text-center space-y-6 px-8">
          <div className="w-20 h-20 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight">
            {config.condominiumName}
          </h2>
          <p className="text-white/60 text-sm">
            Carregando sistema...
          </p>
          <button
            onClick={handleSkip}
            className="px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-black uppercase tracking-widest hover:bg-white/20 transition-all"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[10000] bg-black overflow-hidden flex items-center justify-center"
      style={{ width: '100vw', height: '100vh' }}
    >
      {/* Vídeo de apresentação - Responsivo */}
      <video
        ref={videoRef}
        src="/qualivida.mp4"
        className="w-full h-full max-w-full max-h-full"
        style={{
          width: 'auto',
          height: 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          objectFit: 'contain',
          objectPosition: 'center center'
        }}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={handleVideoEnd}
        onPlay={handleVideoPlay}
        onPause={handleVideoPause}
        onError={handleVideoError}
        onLoadedData={() => {
          setIsLoading(false);
          if (videoRef.current) {
            videoRef.current.play().catch(console.error);
          }
        }}
      />

      {/* Overlay com logo/nome do condomínio (opcional, aparece no final) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center space-y-8 opacity-0 animate-in fade-in duration-1000 delay-[3000ms]">
          <h1 className="shimmer-text reveal-teaser text-5xl md:text-7xl font-black text-white drop-shadow-2xl">
            {config.condominiumName.toUpperCase()}
          </h1>
          <p className="text-[10px] text-white/60 uppercase tracking-[0.3em] font-black">
            Sistema de Gestão Condominial
          </p>
        </div>
      </div>

      {/* Botão de pular */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 right-8 px-6 py-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-full text-white text-sm font-black uppercase tracking-widest hover:bg-white/20 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento (se vídeo não estiver tocando) */}
      {(isLoading || !isPlaying) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-white/80 text-sm font-bold uppercase tracking-widest">
              Carregando apresentação...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoIntro;

