import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCameraCapture, CameraState } from '@/hooks/useCameraCapture';
import { appLogger } from '@/utils/logger';

interface CameraCaptureUIProps {
  /** Si true, la modale est ouverte */
  open: boolean;
  /** Callback avec le blob capturé */
  onCapture: (blob: Blob) => void;
  /** Callback quand l'utilisateur ferme */
  onClose: () => void;
  /** Callback si l'utilisateur choisit le sélecteur de fichiers (fallback) */
  onFileSelect?: (file: File) => void;
}

const CameraCaptureUI: React.FC<CameraCaptureUIProps> = ({
  open,
  onCapture,
  onClose,
  onFileSelect,
}) => {
  const [showFallback, setShowFallback] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hasStartedRef = useRef(false);

  const {
    startCamera,
    capturePhoto,
    stopCamera,
    state,
    error,
    videoRef,
  } = useCameraCapture({
    targetWidth: 1920,
    quality: 0.85,
    onCapture: (blob) => onCapture(blob),
  });

  // Démarrer la caméra quand la modale s'ouvre
  useEffect(() => {
    if (open && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startCamera().catch(() => {
        // Si getUserMedia échoue, proposer le fallback
        setShowFallback(true);
      });
    }
    if (!open) {
      hasStartedRef.current = false;
    }

    return () => {
      if (!open) {
        stopCamera();
        hasStartedRef.current = false;
      }
    };
  }, [open, startCamera, stopCamera]);

  const handleCapture = async () => {
    await capturePhoto();
  };

  const handleClose = () => {
    stopCamera();
    hasStartedRef.current = false;
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) {
      onFileSelect(file);
    }
    // Reset pour permettre de re-sélectionner le même fichier
    e.target.value = '';
  };

  const handleRetryCamera = () => {
    setShowFallback(false);
    startCamera();
  };

  if (!open) return null;

  const isActive = state === 'active';

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] bg-black"
      >
        {/* Si erreur ou fallback → afficher l'écran de fallback */}
        {(showFallback || error) ? (
          <div className="flex flex-col items-center justify-center h-full text-white p-6">
            <div className="text-6xl mb-4">📁</div>
            <p className="text-lg font-semibold mb-2">
              {error || 'Caméra non disponible'}
            </p>
            <p className="text-sm text-gray-400 mb-6 text-center max-w-xs">
              Utilisez le sélecteur de fichiers pour choisir une photo depuis votre galerie ou prenez-en une avec l'appareil photo de votre téléphone.
            </p>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white text-black hover:bg-gray-200"
                size="lg"
              >
                📷 Choisir une photo
              </Button>
              <Button
                onClick={handleRetryCamera}
                variant="outline"
                className="w-full border-gray-600 text-white hover:bg-gray-800"
                size="lg"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Réessayer la caméra
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-white/70 hover:text-white"
              aria-label="Fermer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        ) : (
          /* Mode caméra active */
          <>
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
              <button
                onClick={handleClose}
                className="p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
                aria-label="Fermer"
              >
                <X className="h-6 w-6" />
              </button>
              <span className="text-sm text-white/60 font-medium">Prendre une photo</span>
              <div className="w-10" /> {/* Spacer */}
            </div>

            {/* Vidéo flux caméra */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Overlay de cadrage */}
            <div className="absolute inset-0 pointer-events-none border-[60px] border-black/40">
              <div className="absolute inset-0 border-2 border-dashed border-white/30 rounded-lg m-4" />
            </div>

            {/* Footer — bouton capture */}
            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center pb-10 pt-16 bg-gradient-to-t from-black/80 to-transparent">
              {/* Indicateur d'état */}
              {state === 'capturing' && (
                <span className="text-sm text-white/70 mb-3">Capture en cours...</span>
              )}

              <button
                onClick={handleCapture}
                disabled={!isActive}
                className={`
                  w-[72px] h-[72px] rounded-full border-4 border-white
                  transition-all duration-200
                  ${isActive
                    ? 'bg-white/20 hover:bg-white/40 active:scale-95 cursor-pointer'
                    : 'bg-white/5 cursor-not-allowed opacity-50'
                  }
                `}
                aria-label="Prendre une photo"
              >
                <div className={`
                  w-[56px] h-[56px] rounded-full mx-auto
                  transition-all duration-200
                  ${isActive ? 'bg-white' : 'bg-white/30'}
                `} />
              </button>

              {/* Bouton galerie (fallback) */}
              <button
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="mt-4 text-sm text-white/60 hover:text-white/90 transition-colors"
              >
                Galerie
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Indicateur de chargement initial */}
            {state === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-white/70 text-sm">Démarrage de la caméra...</span>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default CameraCaptureUI;
