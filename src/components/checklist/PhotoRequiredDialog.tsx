import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Image, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

interface PhotoRequiredDialogProps {
  open: boolean;
  itemLabel: string;
  projectId: string;
  taskId?: string;
  itemId: string;
  /** Nombre total d'items qui requièrent encore une photo */
  totalPhotoItems?: number;
  onPhotoProvided: (url: string, sameForAll: boolean) => void;
  onCancel: () => void;
}

const PhotoRequiredDialog: React.FC<PhotoRequiredDialogProps> = ({
  open,
  itemLabel,
  projectId,
  taskId,
  itemId,
  totalPhotoItems = 0,
  onPhotoProvided,
  onCancel,
}) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sameForAll, setSameForAll] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');

  if (!open) return null;

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `projects/${projectId}/checklists/${itemId}/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('project-media')
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('project-media')
        .getPublicUrl(filePath);

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
      } catch { /* non-bloquant */ }

      setUploadedUrl(publicUrl);
      setUploaded(true);
    } catch (err) {
      console.error('Upload photo échoué:', err);
    } finally {
      setUploading(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
    }
  };

  const handleConfirm = () => {
    onPhotoProvided(uploadedUrl, sameForAll);
  };

  const showOtherItems = totalPhotoItems > 1;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-6 animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-xs w-full p-6 space-y-5 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Titre */}
        <div className="text-center space-y-1">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mb-2">
            <Camera className="h-7 w-7 text-amber-600" />
          </div>
          <h3 className="text-base font-bold text-gray-900">📸 Photo requise</h3>
          <p className="text-xs text-gray-500 leading-snug">
            « {itemLabel} »
          </p>
        </div>

        {/* Upload / Preview */}
        {!uploaded ? (
          <div className="flex items-center justify-center gap-6">
            {/* Appareil photo */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`
                w-20 h-20 rounded-2xl flex items-center justify-center transition-all
                ${uploading ? 'bg-brand-orange/10' : 'bg-brand-orange/10 group-hover:bg-brand-orange/20 group-active:scale-95'}
              `}>
                {uploading ? (
                  <Loader2 className="h-9 w-9 text-brand-orange animate-spin" />
                ) : (
                  <Camera className="h-9 w-9 text-brand-orange" />
                )}
              </div>
              <span className="text-xs font-medium text-gray-600">Photo</span>
            </button>

            {/* Galerie */}
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center bg-gray-100 group-hover:bg-gray-200 group-active:scale-95 transition-all">
                <Image className="h-9 w-9 text-gray-500 group-hover:text-gray-700" />
              </div>
              <span className="text-xs font-medium text-gray-600">Galerie</span>
            </button>
          </div>
        ) : (
          /* Photo chargée : preview + checkbox + confirmer */
          <div className="space-y-4">
            <div className="flex justify-center">
              <img
                src={uploadedUrl}
                alt="Aperçu"
                className="h-32 w-32 rounded-2xl object-cover border-2 border-green-200 shadow-sm"
              />
            </div>

            {/* Checkbox "Même photo" — toujours visible après upload */}
            <div
              onClick={() => setSameForAll(!sameForAll)}
              className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 active:scale-[0.98] transition-all select-none"
            >
              <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                sameForAll ? 'bg-brand-orange border-brand-orange' : 'border-gray-300'
              }`}>
                {sameForAll && <Check className="h-3 w-3 text-white" />}
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700">Même photo</p>
                <p className="text-[10px] text-muted-foreground">
                  {totalPhotoItems > 1
                    ? `Appliquer aux ${totalPhotoItems} items avec photo requise`
                    : 'Appliquer comme preuve pour cet item'}
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setUploaded(false); setUploadedUrl(''); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Recommencer
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-brand-orange text-white hover:bg-brand-orange/90 transition-colors"
              >
                Valider
              </button>
            </div>
          </div>
        )}

        {!uploaded && (
          <p className="text-[10px] text-center text-muted-foreground">
            L'item sera décoché si tu fermes
          </p>
        )}

        {/* Inputs cachés */}
        <input ref={cameraRef} type="file" className="hidden" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
        <input ref={galleryRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} />
      </div>
    </div>,
    document.body,
  );
};

export default PhotoRequiredDialog;
