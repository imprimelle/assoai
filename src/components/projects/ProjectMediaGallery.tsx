import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ImagePlus, X, Trash2, Download, Eye, Loader2,
  Camera, FileText, Package, Headphones, Video,
  Image as ImageIcon, Upload, Filter,
} from 'lucide-react';
import { useProjectMedia } from '@/hooks/useProjectMedia';
import type { MediaType, MediaSource, ProjectMedia } from '@/types/project-media';

interface ProjectMediaGalleryProps {
  projectId: string;
  taskId?: string | null;
}

const TYPE_ICONS: Record<MediaType, React.ReactNode> = {
  photo: <Camera className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  produit: <Package className="h-3.5 w-3.5" />,
  audio: <Headphones className="h-3.5 w-3.5" />,
  video: <Video className="h-3.5 w-3.5" />,
};

const TYPE_LABELS: Record<MediaType, string> = {
  photo: 'Photos',
  document: 'Documents',
  produit: 'Produits',
  audio: 'Audio',
  video: 'Vidéo',
};

const SOURCE_LABELS: Record<MediaSource, string> = {
  upload: 'Upload',
  whatsapp: 'WhatsApp',
  agent: 'Agent IA',
  chat: 'Chat',
};

const SOURCE_COLORS: Record<MediaSource, string> = {
  upload: 'bg-blue-100 text-blue-700',
  whatsapp: 'bg-green-100 text-green-700',
  agent: 'bg-purple-100 text-purple-700',
  chat: 'bg-orange-100 text-orange-700',
};

const ALL_TYPES: MediaType[] = ['photo', 'document', 'produit', 'audio', 'video'];

function isImageUrl(url: string): boolean {
  const ext = url.split('.').pop()?.toLowerCase()?.split('?')[0] || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
}

const ProjectMediaGallery: React.FC<ProjectMediaGalleryProps> = ({ projectId, taskId }) => {
  const { media, isLoading, uploadMedia, deleteMedia } = useProjectMedia(projectId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<MediaType | 'all'>('all');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);

  // Filtrage
  const filtered = media.filter(m => {
    if (taskId && m.task_id !== taskId) return false;
    if (selectedType !== 'all' && m.type !== selectedType) return false;
    return true;
  });

  const displayedImages = filtered.filter(m => isImageUrl(m.url));

  // Comptage par type
  const typeCounts = ALL_TYPES.reduce((acc, t) => {
    acc[t] = media.filter(m => m.type === t).length;
    return acc;
  }, {} as Record<MediaType, number>);

  // Upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      // Déterminer le type MIME
      let type: MediaType = 'photo';
      if (file.type.startsWith('image/')) type = 'photo';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';
      else if (file.type.includes('pdf') || file.type.includes('document')) type = 'document';
      else type = 'document';

      try {
        await uploadMedia.mutateAsync({
          file,
          project_id: projectId,
          type,
          source: 'upload',
          task_id: taskId || null,
          label: file.name,
          created_by: 'user',
        });
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    // Simuler l'upload via l'input
    const dt = new DataTransfer();
    files.forEach(f => dt.items.add(f));
    if (fileInputRef.current) {
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxUrl(displayedImages[index].url);
  };

  const goNext = () => {
    const next = (lightboxIndex + 1) % displayedImages.length;
    setLightboxIndex(next);
    setLightboxUrl(displayedImages[next].url);
  };

  const goPrev = () => {
    const prev = (lightboxIndex - 1 + displayedImages.length) % displayedImages.length;
    setLightboxIndex(prev);
    setLightboxUrl(displayedImages[prev].url);
  };

  const handleDelete = async (mediaId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Supprimer ce média ?')) {
      await deleteMedia.mutateAsync(mediaId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barre d'actions : upload + compteurs */}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMedia.isPending}
        >
          {uploadMedia.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="h-4 w-4" />
          )}
          Ajouter des médias
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={handleFileChange}
        />

        {/* Compteurs par type */}
        <div className="flex gap-2 flex-wrap">
          {ALL_TYPES.map(t => typeCounts[t] > 0 && (
            <Badge
              key={t}
              variant="secondary"
              className={`text-xs gap-1 cursor-pointer transition-opacity ${
                selectedType === t ? 'ring-2 ring-brand-orange opacity-100' :
                selectedType !== 'all' ? 'opacity-40' : 'opacity-80'
              }`}
              onClick={() => setSelectedType(selectedType === t ? 'all' : t)}
            >
              {TYPE_ICONS[t]}
              {TYPE_LABELS[t]} ({typeCounts[t]})
            </Badge>
          ))}
          {selectedType !== 'all' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs text-muted-foreground"
              onClick={() => setSelectedType('all')}
            >
              <X className="h-3 w-3 mr-1" /> Tout
            </Button>
          )}
        </div>
      </div>

      {/* Zone de drop */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? 'border-brand-orange bg-brand-orange/5'
            : 'border-gray-200 hover:border-gray-300'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Upload className="h-10 w-10" />
            <div>
              <p className="font-medium text-sm">Aucun média pour ce projet</p>
              <p className="text-xs mt-1">
                Glissez-déposez des fichiers ici ou cliquez sur "Ajouter des médias"
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {filtered.map((m, index) => (
              <MediaCard
                key={m.id}
                media={m}
                isImage={isImageUrl(m.url)}
                onClick={() => {
                  const imgIdx = displayedImages.findIndex(d => d.id === m.id);
                  if (imgIdx >= 0) openLightbox(imgIdx);
                  else window.open(m.url, '_blank');
                }}
                onDelete={(e) => handleDelete(m.id, e)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-95 flex items-center justify-center"
          onClick={() => setLightboxUrl(null)}
        >
          {/* Nav prev */}
          {displayedImages.length > 1 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-3 z-10"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}

          <div className="max-w-[95vw] max-h-[95vh]" onClick={(e) => e.stopPropagation()}>
            {isImageUrl(lightboxUrl) ? (
              <img
                src={lightboxUrl}
                alt="Aperçu"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            ) : (
              <iframe src={lightboxUrl} className="w-[90vw] h-[85vh] rounded-lg bg-white" />
            )}
            <p className="text-white text-center mt-3 text-sm">
              {displayedImages.findIndex(d => d.url === lightboxUrl) + 1} / {displayedImages.length}
            </p>
          </div>

          {/* Nav next */}
          {displayedImages.length > 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-3 z-10"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>

          {/* Download */}
          <a
            href={lightboxUrl}
            download
            className="absolute bottom-4 right-4 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="h-5 w-5" />
          </a>
        </div>
      )}
    </div>
  );
};

// Carte individuelle de média
const MediaCard: React.FC<{
  media: ProjectMedia;
  isImage: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}> = ({ media, isImage, onClick, onDelete }) => (
  <div
    className="group relative bg-white rounded-lg border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
    onClick={onClick}
  >
    {/* Aperçu */}
    <div className="aspect-square bg-gray-50 flex items-center justify-center overflow-hidden">
      {isImage ? (
        <img
          src={media.url}
          alt={media.label || 'Média'}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 text-muted-foreground">
          {TYPE_ICONS[media.type]}
          <span className="text-[10px] uppercase font-medium">{media.type}</span>
        </div>
      )}
    </div>

    {/* Overlay au hover */}
    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full bg-white/90 hover:bg-white"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          className="h-8 w-8 rounded-full bg-white/90 hover:bg-red-50 hover:text-red-500"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>

    {/* Badge source + label */}
    <div className="p-1.5 space-y-1">
      <div className="flex items-center gap-1">
        <Badge className={`text-[10px] px-1 py-0 ${SOURCE_COLORS[media.source]}`}>
          {SOURCE_LABELS[media.source]}
        </Badge>
        {media.task_id && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            Tâche
          </Badge>
        )}
      </div>
      {media.label && (
        <p className="text-[11px] text-gray-600 leading-tight line-clamp-2">{media.label}</p>
      )}
    </div>
  </div>
);

export { ProjectMediaGallery };
