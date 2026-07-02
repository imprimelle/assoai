import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { appLogger } from '@/utils/logger';
import CameraCaptureUI from '@/components/shared/CameraCaptureUI';

interface PhotoUploadButtonProps {
  projectId: string;
  taskId?: string;
  itemId: string;
  onUploaded: (url: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

const PhotoUploadButton: React.FC<PhotoUploadButtonProps> = ({
  projectId,
  taskId,
  itemId,
  onUploaded,
  disabled = false,
  size = 'md',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showCameraUI, setShowCameraUI] = useState(false);

  const uploadFile = async (fileOrBlob: File | Blob, filename = `photo-${Date.now()}.jpg`) => {
    try {
      setIsUploading(true);

      const fileExt = filename.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `projects/${projectId}/checklists/${itemId}/${fileName}`;

      // Convertir Blob en File si nécessaire
      const file = fileOrBlob instanceof File ? fileOrBlob : new File([fileOrBlob], fileName, { type: 'image/jpeg' });

      appLogger.info('📤 Upload photo checklist', {
        fileName,
        fileSize: file.size,
      });

      const { error: uploadErr } = await supabase.storage
        .from('project-media')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage.from('project-media').getPublicUrl(filePath);

      appLogger.info('✅ Photo uploadée', { publicUrl });
      
      // 🔄 Insérer dans la galerie unifiée project_media
      try {
        await supabase.from('project_media').insert({
          project_id: projectId,
          url: publicUrl,
          type: 'photo',
          source: 'upload',
          task_id: taskId || null,
          checklist_item_id: itemId,
          label: file.name,
          created_by: 'intervenant',
        });
      } catch (mediaErr) {
        appLogger.error('⚠️ project_media insert failed (non-bloquant)', mediaErr);
      }

      onUploaded(publicUrl);
    } catch (err) {
      appLogger.error('❌ Erreur upload photo', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file, file.name);
  };

  const handleCameraCapture = (blob: Blob) => {
    uploadFile(blob);
    // On garde la caméra ouverte pour permettre plusieurs photos
  };

  const handleCameraFileSelect = (file: File) => {
    uploadFile(file, file.name);
    setShowCameraUI(false);
  };

  const handleCameraClick = () => {
    // Priorité : ouvrir CameraCaptureUI (getUserMedia natif)
    setShowCameraUI(true);
  };

  const dimensions = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`${dimensions} rounded-full hover:bg-brand-orange/10 text-muted-foreground hover:text-brand-orange transition-colors shrink-0`}
        onClick={handleCameraClick}
        disabled={disabled || isUploading}
        aria-label="Prendre une photo"
        title="Prendre une photo"
      >
        {isUploading ? (
          <Loader2 className={`${iconSize} animate-spin`} />
        ) : (
          <Camera className={iconSize} />
        )}
      </Button>

      {/* Caméra native getUserMedia (prioritaire) */}
      <CameraCaptureUI
        open={showCameraUI}
        onCapture={handleCameraCapture}
        onClose={() => setShowCameraUI(false)}
        onFileSelect={handleCameraFileSelect}
      />

      {/* Fallback : input file classique (utilisé via CameraCaptureUI en mode fallback) */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
      />
    </>
  );
};

export default PhotoUploadButton;
