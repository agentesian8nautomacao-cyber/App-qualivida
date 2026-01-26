import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useAppConfig } from '../contexts/AppConfigContext';

interface LogoSplashProps {
  onComplete: () => void;
  /** Duração em ms antes de chamar onComplete. Toque/clique pula antes. */
  durationMs?: number;
}

const LogoSplash: React.FC<LogoSplashProps> = ({ onComplete, durationMs = 2200 }) => {
  const { config } = useAppConfig();
  const [hidden, setHidden] = useState(false);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    setHidden(true);
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const t = setTimeout(handleComplete, durationMs);
    return () => clearTimeout(t);
  }, [durationMs, handleComplete]);

  const handleClick = useCallback(() => handleComplete(), [handleComplete]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleComplete(); }}
      aria-label="Pular e ir para login"
      className="logoSplash-root"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        background: 'var(--bg-color, #0a0a0a)',
        cursor: 'pointer',
        transition: 'opacity 0.4s ease-out',
        opacity: hidden ? 0 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.5rem',
        }}
      >
        <img
          src="/1024.png"
          alt={`Logo ${config.condominiumName}`}
          style={{
            width: 'min(200px, 50vw)',
            height: 'auto',
            maxHeight: '40vh',
            objectFit: 'contain',
          }}
        />
        <p
          className="logoSplash-name"
          style={{
            fontSize: 'clamp(0.75rem, 3vw, 1rem)',
            fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary, rgba(255,255,255,0.6))',
          }}
        >
          {config.condominiumName}
        </p>
      </div>
    </div>
  );
};

export default LogoSplash;
