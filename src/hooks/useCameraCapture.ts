import { useState, useRef, useCallback, useEffect } from 'react';
import { appLogger } from '@/utils/logger';

export type CameraState = 'idle' | 'active' | 'capturing';
export type CaptureSource = 'camera' | 'file';

export interface UseCameraCaptureOptions {
  /** Taille cible pour le canvas de capture (défaut: 1920) */
  targetWidth?: number;
  /** Qualité JPEG (0-1, défaut: 0.85) */
  quality?: number;
  /** Callback appelé quand le flux caméra est prêt */
  onReady?: () => void;
  /** Callback appelé quand la capture est terminée avec le blob */
  onCapture?: (blob: Blob) => void;
}

export interface UseCameraCaptureReturn {
  /** Démarre la caméra (getUserMedia) */
  startCamera: () => Promise<void>;
  /** Capture le frame courant → Blob JPEG */
  capturePhoto: () => Promise<Blob | null>;
  /** Arrête le flux caméra */
  stopCamera: () => void;
  /** Ouvre le sélecteur de fichiers (fallback) */
  openFilePicker: (accept?: string) => void;
  /** État actuel */
  state: CameraState;
  /** Message d'erreur éventuel */
  error: string | null;
  /** Ref à attacher à l'élément <video> */
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

export function useCameraCapture(options: UseCameraCaptureOptions = {}): UseCameraCaptureReturn {
  const { targetWidth = 1920, quality = 0.85, onReady, onCapture } = options;

  const [state, setState] = useState<CameraState>('idle');
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Attacher le stream au <video> quand il est monté et que le stream est prêt
  useEffect(() => {
    if (videoRef.current && streamRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      appLogger.info('📷 Stream attaché à l\'élément vidéo');
    }
  }, [state]); // re-run quand state change (stream prêt → 'active')

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setState('idle');
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);

    // Vérifier si getUserMedia est disponible
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('getUserMedia non supporté sur ce navigateur');
      appLogger.warn('📷 getUserMedia non supporté — fallback sur input file');
      return;
    }

    // Arrêter le flux précédent si existant
    stopCamera();

    try {
      // Préférence : caméra arrière (environnement)
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      appLogger.info('📷 Demande de flux caméra (facingMode: environment)...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Attendre que la video ref soit disponible
      // (CameraCaptureUI va monter <video> avec cette ref)
      setState('active');
      onReady?.();

      appLogger.info('✅ Caméra active');
    } catch (err: any) {
      const message =
        err.name === 'NotAllowedError'
          ? 'Accès à la caméra refusé. Veuillez autoriser l\'accès dans les paramètres.'
          : err.name === 'NotFoundError'
          ? 'Aucune caméra détectée sur cet appareil.'
          : err.name === 'NotReadableError'
          ? 'Caméra déjà utilisée par une autre application.'
          : `Erreur caméra: ${err.message || 'inconnue'}`;

      setError(message);
      appLogger.error('📷 Erreur getUserMedia', { error: err.name, message: err.message });
    }
  }, [stopCamera, onReady]);

  const capturePhoto = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      appLogger.error('📷 Capture impossible — pas de flux vidéo actif');
      return null;
    }

    setState('capturing');

    try {
      // Créer ou réutiliser le canvas
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;

      const aspectRatio = video.videoHeight / video.videoWidth;
      const width = Math.min(targetWidth, video.videoWidth);
      const height = Math.round(width * aspectRatio);

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible d\'obtenir le contexte 2d');

      ctx.drawImage(video, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(
          (b) => resolve(b),
          'image/jpeg',
          quality
        );
      });

      if (blob) {
        appLogger.info(`📸 Photo capturée: ${(blob.size / 1024).toFixed(1)} Ko`);
        onCapture?.(blob);
      }

      setState('active');
      return blob;
    } catch (err: any) {
      appLogger.error('📷 Erreur capture', { error: err.message });
      setState('active');
      return null;
    }
  }, [targetWidth, quality, onCapture]);

  const openFilePicker = useCallback((accept: string = 'image/*') => {
    // Créer un input file temporaire si pas déjà créé
    if (!fileInputRef.current) {
      fileInputRef.current = document.createElement('input');
      fileInputRef.current.type = 'file';
      fileInputRef.current.style.display = 'none';
      document.body.appendChild(fileInputRef.current);
    }

    const input = fileInputRef.current;
    input.accept = accept;

    // Sur mobile, capture=environment pour ouvrir l'appareil photo
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && accept === 'image/*') {
      input.setAttribute('capture', 'environment');
    }

    // Déclencher le sélecteur
    input.click();
  }, []);

  return {
    startCamera,
    capturePhoto,
    stopCamera,
    openFilePicker,
    state,
    error,
    videoRef,
  };
}
