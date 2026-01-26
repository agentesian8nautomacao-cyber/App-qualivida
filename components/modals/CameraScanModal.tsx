import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, QrCode, Image as ImageIcon, CheckCircle2, AlertCircle, RotateCcw, Upload } from 'lucide-react';
import { Resident } from '../../types';
import { isMobile } from '../../utils/deviceDetection';
import { useCamera } from '../../hooks/useCamera';
import { normalizeUnit, compareUnits } from '../../utils/unitFormatter';

export interface CameraScanSuccessData {
  resident?: Resident;
  qrData?: string;
  image?: string;
  fromMode?: 'qr' | 'photo';
}

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: CameraScanSuccessData) => void;
  allResidents: Resident[];
}

type JsQRFn = (data: Uint8ClampedArray, width: number, height: number, opts?: { inversionAttempts?: string }) => { data: string } | null;

async function loadJsQR(): Promise<JsQRFn> {
  try {
    const m = await import('jsqr');
    return m.default as JsQRFn;
  } catch {
    return new Promise((resolve, reject) => {
      const w = window as unknown as { jsQR?: JsQRFn };
      if (w.jsQR) {
        resolve(w.jsQR);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.onload = () => (w.jsQR ? resolve(w.jsQR) : reject(new Error('jsQR não carregou')));
      script.onerror = () => reject(new Error('Erro ao carregar jsQR'));
      document.head.appendChild(script);
    });
  }
}

async function detectQRFromImageData(imageData: ImageData): Promise<string | null> {
  if (!imageData.data.length || imageData.width < 50 || imageData.height < 50) return null;
  try {
    const jsQR = await loadJsQR();
    let result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (!result) {
      result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    }
    return result?.data ?? null;
  } catch {
    return null;
  }
}

const CameraScanModal: React.FC<CameraScanModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  allResidents,
}) => {
  const mobile = isMobile();
  const { stream, status, error, requestAccessSync, stop, clearError } = useCamera({
    facingMode: 'environment',
  });

  const [mode, setMode] = useState<'qr' | 'photo'>('qr');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [qrDetecting, setQrDetecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activateButtonRef = useRef<HTMLButtonElement | null>(null);

  const displayError = localError ?? error;

  const findResidentByQR = useCallback(
    (qrData: string): Resident | undefined => {
      const raw = (qrData || '').trim();
      if (!raw) return undefined;
      const qrNorm = normalizeUnit(raw);
      try {
        const data = JSON.parse(raw) as { unit?: string; id?: string; name?: string };
        if (data.unit) {
          const u = normalizeUnit(data.unit);
          const byUnit = allResidents.find((r) => compareUnits(r.unit, u));
          if (byUnit) return byUnit;
          const byId = data.id ? allResidents.find((r) => r.id === data.id) : undefined;
          if (byId) return byId;
        }
      } catch {
        /* não é JSON */
      }
      return allResidents.find((r) => {
        if (compareUnits(r.unit, raw) || compareUnits(r.unit, qrNorm)) return true;
        if (r.unit === raw || r.unit === qrNorm) return true;
        if (raw.includes(r.unit) || qrNorm.includes(normalizeUnit(r.unit))) return true;
        if (r.name && raw.toLowerCase().includes(r.name.toLowerCase())) return true;
        return false;
      });
    },
    [allResidents]
  );

  const handleSuccess = useCallback(
    (data: CameraScanSuccessData) => {
      onScanSuccess(data);
      resetModal();
    },
    [onScanSuccess]
  );

  const resetModal = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    stop();
    setCapturedImage(null);
    setScannedData(null);
    setQrDetecting(false);
    setLocalError(null);
    clearError();
    setMode('qr');
  }, [stop, clearError]);

  const handleClose = useCallback(() => {
    resetModal();
    onClose();
  }, [resetModal, onClose]);

  // Ligar stream ao <video>
  useEffect(() => {
    if (!stream || !videoRef.current) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream]);

  // Não solicitar câmera ao abrir: mobile exige gesto direto (clique) para getUserMedia.
  // Cleanup ao fechar.
  useEffect(() => {
    if (!isOpen) {
      resetModal();
      return;
    }
    if (!mobile) return;
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mobile]);

  // Listener nativo no botão "Ativar câmera": getUserMedia precisa ser acionado por gesto real.
  // React onClick pode quebrar o user gesture em alguns mobile browsers.
  const showActivate = Boolean(
    isOpen && mobile && !stream && !capturedImage && status === 'idle' && !displayError
  );
  useEffect(() => {
    if (!showActivate) return;
    const btn = activateButtonRef.current;
    if (!btn) return;
    const handler = () => {
      requestAccessSync();
    };
    btn.addEventListener('click', handler);
    return () => btn.removeEventListener('click', handler);
  }, [showActivate, requestAccessSync]);

  // QR scan loop (apenas quando stream pronto e modo qr)
  useEffect(() => {
    if (status !== 'ready' || mode !== 'qr' || capturedImage || scannedData) return;
    scanIntervalRef.current = window.setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h || w < 50 || h < 50) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);
      detectQRFromImageData(imageData).then((qrData) => {
        if (!qrData) return;
        if (scanIntervalRef.current) {
          clearInterval(scanIntervalRef.current);
          scanIntervalRef.current = null;
        }
        setScannedData(qrData);
        stop();
        const resident = findResidentByQR(qrData);
        if (resident) {
          handleSuccess({ resident, qrData, fromMode: 'qr' });
        } else {
          handleSuccess({ qrData, fromMode: 'qr' });
        }
      });
    }, 250);
    return () => {
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [status, mode, capturedImage, scannedData, findResidentByQR, handleSuccess, stop]);

  const capturePhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !stream) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);
    setScannedData(null);
    setQrDetecting(true);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    stop();

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    detectQRFromImageData(imageData)
      .then((qrData) => {
        if (qrData) setScannedData(qrData);
      })
      .catch(() => {})
      .finally(() => setQrDetecting(false));
  }, [stream, stop]);

  const handleConfirmPhoto = useCallback(() => {
    if (!capturedImage) return;
    const resident = scannedData ? findResidentByQR(scannedData) : undefined;
    const base = { image: capturedImage, fromMode: 'photo' as const };
    if (resident && scannedData) {
      handleSuccess({ ...base, resident, qrData: scannedData });
    } else if (scannedData) {
      handleSuccess({ ...base, qrData: scannedData });
    } else {
      handleSuccess(base);
    }
  }, [capturedImage, scannedData, findResidentByQR, handleSuccess]);

  const handleRetry = useCallback(() => {
    setLocalError(null);
    clearError();
    stop();
    requestAccessSync();
  }, [stop, requestAccessSync, clearError]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file?.type.startsWith('image/')) {
        setLocalError('Selecione um arquivo de imagem.');
        return;
      }
      setLocalError(null);
      clearError();
      setScannedData(null);
      setQrDetecting(true);
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        setCapturedImage(dataUrl);
        const img = new Image();
        img.onload = () => {
          const canvas = canvasRef.current;
          if (!canvas) {
            setQrDetecting(false);
            return;
          }
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setQrDetecting(false);
            return;
          }
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          detectQRFromImageData(imageData)
            .then((qr) => {
              if (qr) setScannedData(qr);
            })
            .catch(() => {})
            .finally(() => setQrDetecting(false));
        };
        img.onerror = () => setQrDetecting(false);
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [clearError]
  );

  if (!isOpen) return null;

  // Desktop: sem câmera, apenas mensagem
  if (!mobile) {
    return (
      <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={handleClose} />
        <div
          className="relative w-full max-w-md bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 p-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="p-4 rounded-full bg-amber-500/10 border border-amber-500/30">
              <Camera className="w-12 h-12 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Câmera apenas no celular
              </h3>
              <p className="text-sm mt-2 opacity-70" style={{ color: 'var(--text-secondary)' }}>
                Registro por câmera (foto e QR Code) está disponível apenas no celular. No computador, use o registro manual.
              </p>
            </div>
            <button
              onClick={handleClose}
              className="px-8 py-3 rounded-full font-black uppercase text-sm bg-[var(--text-primary)] text-[var(--bg-color)] hover:opacity-90 transition-opacity"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Mobile: modal com câmera
  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl" onClick={handleClose} />
      <div
        className="relative w-full max-w-full sm:max-w-2xl max-h-[95vh] bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in duration-300 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 sm:p-6 border-b border-[var(--border-color)] flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {mode === 'qr' ? 'Escanear QR Code' : 'Capturar Foto'}
            </h3>
            <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'qr' ? 'Aponte para o QR code da encomenda' : 'Tire uma foto da encomenda'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-3 rounded-2xl hover:bg-[var(--border-color)] transition-colors"
            style={{ color: 'var(--text-primary)' }}
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </header>

        <div className="p-4 flex-1 min-h-0 overflow-y-auto flex flex-col gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { setMode('qr'); setCapturedImage(null); setScannedData(null); setLocalError(null); }}
              className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'qr'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'qr' ? { color: 'var(--text-primary)' } : undefined}
            >
              <QrCode className="w-4 h-4 inline mr-2 align-middle" />
              QR Code
            </button>
            <button
              type="button"
              onClick={() => { setMode('photo'); setScannedData(null); setLocalError(null); }}
              className={`flex-1 px-4 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'photo'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'photo' ? { color: 'var(--text-primary)' } : undefined}
            >
              <ImageIcon className="w-4 h-4 inline mr-2 align-middle" />
              Foto
            </button>
          </div>

          {displayError && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs font-bold text-red-400">{displayError}</p>
                  <p className="text-xs mt-2 opacity-80" style={{ color: 'var(--text-secondary)' }}>
                    Use <strong>Enviar imagem</strong> para anexar uma foto do seu dispositivo ou <strong>Tentar novamente</strong> para acessar a câmera.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={status === 'requesting'}
                  className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 rounded-xl text-xs font-black uppercase disabled:opacity-50 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {status === 'requesting' ? 'Solicitando…' : 'Tentar novamente'}
                </button>
                <label className="inline-flex items-center justify-center gap-2 px-4 py-3 bg-[var(--text-primary)] rounded-xl cursor-pointer hover:opacity-90 transition-opacity">
                  <Upload className="w-4 h-4" style={{ color: 'var(--bg-color)' }} />
                  <span className="text-xs font-black uppercase" style={{ color: 'var(--bg-color)' }}>
                    Enviar imagem
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}

          <div
            className="relative bg-black rounded-2xl overflow-hidden flex-1 min-h-[220px] flex items-center justify-center"
            style={{ maxHeight: 'min(50vh, 400px)' }}
          >
            <canvas ref={canvasRef} className="hidden" />
            {!stream && !capturedImage && status === 'idle' && !displayError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                <p className="text-sm text-center text-white/80">
                  Toque em <strong>Ativar câmera</strong> para escanear QR Code ou tirar foto. O navegador vai pedir permissão.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                  <button
                    ref={activateButtonRef}
                    type="button"
                    className="flex-1 py-4 px-6 rounded-2xl bg-white text-black text-sm font-black uppercase flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all"
                  >
                    <Camera className="w-5 h-5" />
                    Ativar câmera
                  </button>
                  <label className="flex-1 py-4 px-6 rounded-2xl border-2 border-dashed border-white/40 text-white/80 text-sm font-bold uppercase flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 hover:border-white/60 transition-all">
                    <Upload className="w-5 h-5" />
                    Enviar imagem
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : capturedImage ? (
              <div className="relative w-full h-full flex flex-col">
                <img
                  src={capturedImage}
                  alt="Preview"
                  className="w-full h-auto object-contain flex-1"
                />
                {scannedData && (
                  <div className="absolute top-2 left-2 right-2 p-3 bg-green-500/90 rounded-xl">
                    <p className="text-xs font-bold text-white">QR: {scannedData.slice(0, 40)}…</p>
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setCapturedImage(null); setScannedData(null); setQrDetecting(false); requestAccessSync(); }}
                    className="flex-1 py-3 rounded-xl bg-[var(--glass-bg)] border border-[var(--border-color)] text-xs font-black uppercase"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <RotateCcw className="w-4 h-4 inline mr-2" />
                    Tirar outra
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmPhoto}
                    disabled={qrDetecting}
                    className="flex-1 py-3 rounded-xl bg-green-500 text-white text-xs font-black uppercase flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {qrDetecting ? 'Analisando QR…' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {status === 'requesting' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10">
                    <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <p className="text-sm font-bold text-white">Solicitando permissão da câmera…</p>
                    <p className="text-xs text-white/60">Habilite o acesso se o navegador pedir.</p>
                  </div>
                )}
                {status === 'ready' && stream && (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                    {mode === 'qr' && !scannedData && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div className="w-56 h-56 border-2 border-green-500/60 rounded-2xl" />
                        <span className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-black/70 rounded-lg text-xs font-bold text-white">
                          Apontando para o QR code…
                        </span>
                      </div>
                    )}
                  </>
                )}
                {status === 'error' && !displayError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/70">
                    <AlertCircle className="w-10 h-10" />
                    <p className="text-sm font-bold">Câmera indisponível</p>
                  </div>
                )}
              </>
            )}
          </div>

          {!capturedImage && status === 'ready' && mode === 'photo' && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-8 py-4 bg-white text-black rounded-full text-sm font-black uppercase shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center gap-2"
              >
                <Camera className="w-5 h-5" />
                Capturar foto
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraScanModal;
