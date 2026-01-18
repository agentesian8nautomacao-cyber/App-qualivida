import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, QrCode, Image as ImageIcon, CheckCircle2, AlertCircle, RotateCcw, RotateCw } from 'lucide-react';
import { Resident } from '../../types';

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: { resident?: Resident; qrData?: string; image?: string }) => void;
  allResidents: Resident[];
}

// Função para carregar jsQR dinamicamente
const loadJSQR = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).jsQR) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Erro ao carregar jsQR'));
    document.head.appendChild(script);
  });
};

// Função para detectar QR code usando jsQR
const detectQRCode = async (imageData: ImageData): Promise<string | null> => {
  try {
    await loadJSQR();
    const code = (window as any).jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });
    return code ? code.data : null;
  } catch (error) {
    console.error('Erro ao detectar QR code:', error);
    return null;
  }
};

const CameraScanModal: React.FC<CameraScanModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  allResidents
}) => {
  const [mode, setMode] = useState<'qr' | 'photo'>('qr');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen && mode === 'qr') {
      startCamera();
    } else {
      stopCamera();
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, mode, facingMode]);

  const startCamera = async () => {
    try {
      setError(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }

      if (mode === 'qr') {
        startQRScanning();
      }
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  const startQRScanning = () => {
    setIsScanning(true);
    scanIntervalRef.current = window.setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        if (context && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);

          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          detectQRCode(imageData).then((qrData) => {
            if (qrData) {
              setScannedData(qrData);
              setIsScanning(false);
              stopCamera();
              
              // Tentar encontrar morador pelo QR code
              const resident = findResidentByQR(qrData);
              if (resident) {
                handleSuccess({ resident, qrData });
              } else {
                handleSuccess({ qrData });
              }
            }
          });
        }
      }
    }, 300);
  };

  const findResidentByQR = (qrData: string): Resident | undefined => {
    // Formato esperado: JSON com dados do morador ou simplesmente unidade/nome
    try {
      const data = JSON.parse(qrData);
      if (data.unit) {
        return allResidents.find(r => r.unit === data.unit || r.id === data.id);
      }
    } catch {
      // Se não for JSON, tentar buscar por unidade direto no QR code
      const resident = allResidents.find(r => 
        qrData.includes(r.unit) || 
        qrData.includes(r.name) ||
        r.unit === qrData
      );
      return resident;
    }
    return undefined;
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        setCapturedImage(imageDataUrl);
        stopCamera();

        // Tentar detectar QR code na foto capturada
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        detectQRCode(imageData).then((qrData) => {
          if (qrData) {
            setScannedData(qrData);
            const resident = findResidentByQR(qrData);
            if (resident) {
              handleSuccess({ resident, qrData, image: imageDataUrl });
            } else {
              handleSuccess({ qrData, image: imageDataUrl });
            }
          }
        });
      }
    }
  };

  const handleSuccess = (data: { resident?: Resident; qrData?: string; image?: string }) => {
    onScanSuccess(data);
    resetModal();
  };

  const resetModal = () => {
    stopCamera();
    setCapturedImage(null);
    setScannedData(null);
    setError(null);
    setMode('qr');
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/95 backdrop-blur-2xl" 
        onClick={handleClose}
      />
      <div className="relative w-full max-w-4xl bg-[var(--sidebar-bg)] border border-[var(--border-color)] rounded-[48px] shadow-2xl overflow-hidden animate-in zoom-in duration-500">
        {/* Header */}
        <div className="p-6 border-b border-[var(--border-color)] flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>
              {mode === 'qr' ? 'Escanear QR Code' : 'Capturar Foto'}
            </h3>
            <p className="text-xs opacity-40 mt-1" style={{ color: 'var(--text-secondary)' }}>
              {mode === 'qr' ? 'Aponte a câmera para o QR code da encomenda' : 'Tire uma foto da encomenda'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-3 rounded-2xl hover:bg-[var(--border-color)] transition-all"
            style={{ color: 'var(--text-primary)' }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6">
          {/* Modos */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                setMode('qr');
                setCapturedImage(null);
              }}
              className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'qr'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'qr' ? { color: 'var(--text-primary)' } : {}}
            >
              <QrCode className="w-4 h-4 inline mr-2" />
              QR Code
            </button>
            <button
              onClick={() => {
                setMode('photo');
                setScannedData(null);
              }}
              className={`flex-1 px-6 py-3 rounded-xl text-xs font-black uppercase transition-all border ${
                mode === 'photo'
                  ? 'bg-[var(--text-primary)] text-[var(--bg-color)] border-[var(--text-primary)]'
                  : 'bg-[var(--glass-bg)] border-[var(--border-color)]'
              }`}
              style={mode !== 'photo' ? { color: 'var(--text-primary)' } : {}}
            >
              <ImageIcon className="w-4 h-4 inline mr-2" />
              Foto
            </button>
          </div>

          {/* Erro */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <p className="text-xs font-bold text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Área da câmera/foto */}
          <div className="relative bg-black rounded-2xl overflow-hidden" style={{ minHeight: '400px' }}>
            {capturedImage ? (
              // Foto capturada
              <div className="relative">
                <img 
                  src={capturedImage} 
                  alt="Foto capturada" 
                  className="w-full h-auto max-h-[500px] object-contain"
                />
                {scannedData && (
                  <div className="absolute top-4 left-4 right-4 p-4 bg-green-500/90 backdrop-blur-md rounded-xl">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-white" />
                      <p className="text-sm font-black text-white">QR Code detectado: {scannedData.substring(0, 50)}...</p>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 flex gap-3">
                  <button
                    onClick={() => {
                      setCapturedImage(null);
                      startCamera();
                    }}
                    className="flex-1 px-6 py-3 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-xl text-xs font-black uppercase"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <RotateCcw className="w-4 h-4 inline mr-2" />
                    Tirar Outra
                  </button>
                  <button
                    onClick={() => handleSuccess({ image: capturedImage, qrData: scannedData || undefined })}
                    className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl text-xs font-black uppercase"
                  >
                    <CheckCircle2 className="w-4 h-4 inline mr-2" />
                    Confirmar
                  </button>
                </div>
              </div>
            ) : (
              // Câmera ao vivo
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto max-h-[500px] object-contain"
                />
                {isScanning && mode === 'qr' && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-green-500 rounded-2xl animate-pulse" />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/70 backdrop-blur-md rounded-xl">
                      <p className="text-xs font-black text-white uppercase">Buscando QR Code...</p>
                    </div>
                  </div>
                )}
                {scannedData && (
                  <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 backdrop-blur-sm">
                    <div className="bg-green-500/90 backdrop-blur-md p-8 rounded-2xl text-center">
                      <CheckCircle2 className="w-16 h-16 text-white mx-auto mb-4" />
                      <p className="text-lg font-black text-white mb-2">QR Code Detectado!</p>
                      <p className="text-xs text-white/80">{scannedData.substring(0, 50)}...</p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Canvas oculto para processamento */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Controles */}
          {!capturedImage && !scannedData && (
            <div className="mt-6 flex justify-center gap-4">
              {mode === 'photo' && (
                <button
                  onClick={capturePhoto}
                  className="px-8 py-4 bg-white text-black rounded-full text-sm font-black uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Capturar Foto
                </button>
              )}
              <button
                onClick={toggleCamera}
                className="px-6 py-4 bg-[var(--glass-bg)] border border-[var(--border-color)] rounded-full text-xs font-black uppercase hover:bg-[var(--border-color)] transition-all"
                style={{ color: 'var(--text-primary)' }}
              >
                <RotateCw className="w-4 h-4 inline mr-2" />
                {facingMode === 'user' ? 'Câmera Frontal' : 'Câmera Traseira'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraScanModal;