import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';
import { appLogger } from '@/utils/logger';

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);

      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `projects/${projectId}/checklists/${itemId}/${fileName}`;

      appLogger.info('📤 Upload photo checklist', {
        fileName,
        fileSize: file.size,
        fileType: file.type,
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
      // Reset input pour permettre de ré-uploader la même photo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
        onClick={() => fileInputRef.current?.click()}
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
