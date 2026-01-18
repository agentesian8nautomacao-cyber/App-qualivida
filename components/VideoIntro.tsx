import React, { useState, useEffect, useRef } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const videoSrc = '/Qualivida.mp4';

  useEffect(() => {
    // Mostrar botão de pular após 2 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2000);

    // Auto-completar após o vídeo terminar ou 10 segundos máximo
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 10000);

    // Tentar carregar o vídeo
    if (videoRef.current) {
      const video = videoRef.current;
      
      const handleLoadedData = () => {
        setIsLoading(false);
        setHasError(false);
        // Tocar o vídeo
        video.play().catch(err => {
          console.error('Erro ao reproduzir vídeo:', err);
          setIsLoading(false);
        });
      };

      const handleError = () => {
        console.error('Erro ao carregar vídeo');
        setIsLoading(false);
        setHasError(true);
        // Auto-completar após 1 segundo se houver erro
        setTimeout(() => onComplete(), 1000);
      };

      const handleEnded = () => {
        // Quando o vídeo terminar, completar a apresentação
        onComplete();
      };

      video.addEventListener('loadeddata', handleLoadedData);
      video.addEventListener('error', handleError);
      video.addEventListener('ended', handleEnded);

      // Tentar carregar
      video.load();

      return () => {
        clearTimeout(skipTimer);
        clearTimeout(autoCompleteTimer);
        video.removeEventListener('loadeddata', handleLoadedData);
        video.removeEventListener('error', handleError);
        video.removeEventListener('ended', handleEnded);
      };
    }

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(autoCompleteTimer);
    };
  }, [onComplete]);

  const handleSkip = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onComplete();
  };

  // Se houver erro, mostrar mensagem e permitir pular
  if (hasError) {
    return (
      <div 
        className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
        style={{ 
          width: '100vw', 
          height: '100vh',
          backgroundColor: 'var(--bg-color)'
        }}
      >
        <div className="text-center space-y-6 px-8">
          <h2 className="text-2xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
            {config.condominiumName}
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Carregando sistema...
          </p>
          <button
            onClick={handleSkip}
            className="px-6 py-3 backdrop-blur-md border rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all"
            style={{ 
              backgroundColor: 'var(--glass-bg)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-primary)'
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[10000] overflow-hidden"
      style={{ 
        width: '100vw', 
        height: '100vh',
        backgroundColor: 'var(--bg-color)',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      {/* Vídeo de apresentação */}
      <video
        ref={videoRef}
        className="splash-video"
        src={videoSrc}
        autoPlay
        muted
        playsInline
        loop={false}
        style={{
          width: '100vw',
          height: '100vh',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0
        }}
      />

      {/* CSS para responsividade do vídeo */}
      <style>{`
        .splash-video {
          transition: opacity 0.5s ease;
        }

        /* Desktop: usar cover para preencher completamente */
        @media (min-width: 1024px) {
          .splash-video {
            object-fit: cover !important;
          }
        }

        /* Mobile: usar contain para não cortar conteúdo importante */
        @media (max-width: 1023px) {
          .splash-video {
            object-fit: contain !important;
          }
        }

        /* Ajustes específicos para telas muito pequenas */
        @media (max-width: 480px) {
          .splash-video {
            object-fit: contain !important;
          }
        }

        /* Ajustes para orientação paisagem em mobile */
        @media (orientation: landscape) and (max-height: 500px) {
          .splash-video {
            object-fit: contain !important;
          }
        }

        /* Ajustes para orientação retrato em mobile */
        @media (orientation: portrait) and (max-width: 768px) {
          .splash-video {
            object-fit: contain !important;
          }
        }
      `}</style>

      {/* Botão de pular */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-4 right-4 md:bottom-8 md:right-8 px-4 py-2 md:px-6 md:py-3 backdrop-blur-md border rounded-full text-xs md:text-sm font-black uppercase tracking-widest hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500 z-30"
          style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.1)', 
            borderColor: 'rgba(255, 255, 255, 0.3)',
            color: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)'
          }}
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento */}
      {isLoading && (
        <div 
          className="absolute inset-0 flex items-center justify-center backdrop-blur-sm z-20" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
        >
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto" />
            <p className="text-sm font-bold uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
              Carregando apresentação...
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoIntro;
