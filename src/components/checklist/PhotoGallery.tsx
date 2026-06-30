import React, { useState } from 'react';
import { X } from 'lucide-react';

interface PhotoGalleryProps {
  images: string[];
  onRemove?: (url: string) => void;
  editable?: boolean;
  maxDisplay?: number;
}

const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  images,
  onRemove,
  editable = false,
  maxDisplay = 3,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (!images || images.length === 0) return null;

  const displayed = images.slice(0, maxDisplay);
  const remaining = images.length - maxDisplay;

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goNext = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex + 1) % images.length);
    }
  };
  const goPrev = () => {
    if (lightboxIndex !== null) {
      setLightboxIndex((lightboxIndex - 1 + images.length) % images.length);
    }
  };

  return (
    <>
      <div className="flex gap-1 flex-wrap">
        {displayed.map((url, i) => (
          <div key={i} className="relative group">
            <button
              type="button"
              className="h-10 w-10 rounded overflow-hidden border border-gray-200 bg-gray-50 p-0 cursor-pointer hover:ring-2 hover:ring-brand-orange/50 transition-all"
              onClick={() => openLightbox(i)}
              aria-label={`Photo ${i + 1}`}
            >
              <img
                src={url}
                alt={`Photo ${i + 1}`}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
            {editable && onRemove && (
              <button
                type="button"
                className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(url);
                }}
                aria-label="Supprimer la photo"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            )}
          </div>
        ))}
        {remaining > 0 && (
          <button
            type="button"
            className="h-10 w-10 rounded border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-gray-100"
            onClick={() => openLightbox(maxDisplay)}
            aria-label={`${remaining} photos supplémentaires`}
          >
            +{remaining}
          </button>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          {/* Navigation prev */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 z-10"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              aria-label="Photo précédente"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          )}

          <div
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={images[lightboxIndex]}
              alt={`Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <p className="text-white text-center mt-2 text-sm">
              {lightboxIndex + 1} / {images.length}
            </p>
          </div>

          {/* Navigation next */}
          {images.length > 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 z-10"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              aria-label="Photo suivante"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          )}

          {/* Close */}
          <button
            type="button"
            className="absolute top-4 right-4 text-white bg-black/50 hover:bg-black/70 rounded-full p-2 z-10"
            onClick={closeLightbox}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </>
  );
};

export default PhotoGallery;
