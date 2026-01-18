import React, { useState, useEffect, useMemo } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface VideoIntroProps {
  onComplete: () => void;
}

const VideoIntro: React.FC<VideoIntroProps> = ({ onComplete }) => {
  const { config } = useAppConfig();
  const [showSkip, setShowSkip] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Cache busting para garantir que a imagem atualizada seja sempre carregada
  // O timestamp é gerado apenas uma vez na montagem do componente
  const imageSrc = useMemo(() => `/gestão Qualivida Residence.png?t=${Date.now()}`, []);

  useEffect(() => {
    // Mostrar botão de pular após 2 segundos
    const skipTimer = setTimeout(() => {
      setShowSkip(true);
    }, 2000);

    // Auto-completar após 5 segundos (tempo de exibição da imagem)
    const autoCompleteTimer = setTimeout(() => {
      onComplete();
    }, 5000);

    // Verificar se a imagem foi carregada
    const img = new Image();
    img.onload = () => {
      setIsLoading(false);
      setImageLoaded(true);
    };
    img.onerror = () => {
      console.error('Erro ao carregar imagem:', imageSrc);
      setHasError(true);
      setIsLoading(false);
    };
    img.src = imageSrc;

    return () => {
      clearTimeout(skipTimer);
      clearTimeout(autoCompleteTimer);
    };
  }, [imageSrc, onComplete]);

  const handleSkip = () => {
    onComplete();
  };

  // Se houver erro, mostrar mensagem e permitir pular
  if (hasError) {
    return (
      <div className="fixed inset-0 z-[10000] bg-[var(--bg-color)] flex items-center justify-center overflow-hidden">
        <div className="text-center space-y-6 px-8">
          <div className="w-20 h-20 border-4 border-[var(--border-color)] border-t-[var(--text-primary)] rounded-full animate-spin mx-auto" />
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
      className="fixed inset-0 z-[10000] overflow-hidden flex items-center justify-center"
      style={{ 
        width: '100vw', 
        height: '100vh',
        backgroundColor: 'var(--bg-color)'
      }}
    >
      {/* Imagem de apresentação - Fullscreen com animação de texto */}
      <img
        src={imageSrc}
        alt="Qualivida Residence - Sistema de Gestão Condominial"
        className={`absolute inset-0 w-full h-full transition-all duration-1000 intro-image-animated ${
          imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
        }`}
        style={{
          objectFit: 'cover',
          objectPosition: 'center center'
        }}
        onLoad={() => {
          setIsLoading(false);
          setImageLoaded(true);
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
      />

      {/* CSS Animation para animar o texto presente na imagem */}
      <style>{`
        .intro-image-animated {
          animation: imageTextReveal 2s ease-out forwards, imageTextPulse 4s ease-in-out 2s infinite;
        }

        @keyframes imageTextReveal {
          0% {
            opacity: 0;
            filter: blur(15px) brightness(0.7) contrast(0.8);
            transform: scale(1.05);
          }
          100% {
            opacity: 1;
            filter: blur(0px) brightness(1) contrast(1);
            transform: scale(1);
          }
        }

        @keyframes imageTextPulse {
          0%, 100% {
            filter: brightness(1) contrast(1) saturate(1);
          }
          25% {
            filter: brightness(1.08) contrast(1.08) saturate(1.1);
          }
          50% {
            filter: brightness(1.15) contrast(1.15) saturate(1.2);
          }
          75% {
            filter: brightness(1.08) contrast(1.08) saturate(1.1);
          }
        }

        @keyframes imageTextGlow {
          0%, 100% {
            filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.4)) drop-shadow(0 0 16px rgba(255, 255, 255, 0.2));
          }
          50% {
            filter: drop-shadow(0 0 16px rgba(255, 255, 255, 0.7)) drop-shadow(0 0 32px rgba(255, 255, 255, 0.4));
          }
        }
      `}</style>

      {/* Botão de pular */}
      {showSkip && (
        <button
          onClick={handleSkip}
          className="absolute bottom-8 right-8 px-6 py-3 backdrop-blur-md border rounded-full text-sm font-black uppercase tracking-widest hover:scale-105 transition-all animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ 
            backgroundColor: 'var(--glass-bg)', 
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          Pular
        </button>
      )}

      {/* Indicador de carregamento */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}>
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

