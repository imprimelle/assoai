
import React, { useState, useEffect } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Button } from '@/components/ui/button';
import { X, Plus, Download, Maximize2 } from "lucide-react";
import ImageUpload from '@/components/templates/shared/ImageUpload';
import { ProductVariant } from '@/types/product';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogClose,
} from "@/components/ui/dialog";

interface ImageGalleryProps {
  mainImage: string | null;
  galleryImages: string[];
  onMainImageChange: (url: string) => void;
  onAddGalleryImage: (url: string) => void;
  onRemoveGalleryImage: (index: number) => void;
  isEditable?: boolean;
  variants?: ProductVariant[]; // Added variants prop
}

const ImageGallery: React.FC<ImageGalleryProps> = ({
  mainImage,
  galleryImages,
  onMainImageChange,
  onAddGalleryImage,
  onRemoveGalleryImage,
  isEditable = false,
  variants = [], // Default to empty array
}) => {
  // Get variant images while filtering out null/undefined values
  const variantImages = variants
    .filter(variant => variant.image_url)
    .map(variant => variant.image_url as string);

  // Combine all images (without duplicates)
  const allGalleryImages = [...new Set([...galleryImages, ...variantImages])];
  
  // State for fullscreen preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Download image function
  const handleDownloadImage = async (imageUrl: string) => {
    try {
      // Create a new anchor element
      const link = document.createElement('a');
      
      // Fetch the image as a blob
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      // Create an object URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Set the anchor element's attributes for downloading
      link.href = url;
      link.download = `image-${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
      
      // Append to the document, click it, and then remove it
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  };

  // Open fullscreen preview
  const openPreview = (image: string) => {
    setPreviewImage(image);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Image principale */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Image principale</label>
        <div className="relative bg-white rounded-md shadow-sm">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            <ImageUpload
              imageUrl={mainImage || ''}
              onChange={onMainImageChange}
              isEditable={isEditable}
              label=""
              placeholder="Ajouter une image principale"
            />
            
            {mainImage && (
              <div className="absolute top-2 right-2 flex space-x-2">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                  onClick={() => openPreview(mainImage)}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                  onClick={() => handleDownloadImage(mainImage)}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Galerie d'images */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Galerie d'images</label>
        {allGalleryImages.length > 0 ? (
          <div className="bg-white rounded-md shadow-sm p-4">
            <Carousel className="w-full">
              <CarouselContent>
                {allGalleryImages.map((image, index) => (
                  <CarouselItem key={`${image}-${index}`} className="basis-1/2 md:basis-1/3 lg:basis-1/4 p-1">
                    <motion.div 
                      whileHover={{ scale: 1.05, y: -5 }}
                      transition={{ duration: 0.2 }}
                      className="relative h-40"
                    >
                      <img 
                        src={image} 
                        alt={`Gallery ${index}`} 
                        className="w-full h-full object-cover rounded-md cursor-pointer"
                        onClick={() => openPreview(image)}
                      />
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <Button
                          variant="secondary"
                          size="icon"
                          className="h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                          onClick={() => handleDownloadImage(image)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        {isEditable && galleryImages.includes(image) && (
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-6 w-6 rounded-full"
                            onClick={() => onRemoveGalleryImage(galleryImages.indexOf(image))}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      {/* Badge pour indiquer si c'est une image de variante */}
                      {variantImages.includes(image) && !galleryImages.includes(image) && (
                        <div className="absolute bottom-2 left-2 bg-brand-yellow/90 text-xs py-1 px-2 rounded-full backdrop-blur-sm">
                          Variante
                        </div>
                      )}
                    </motion.div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="-left-4 md:-left-5 bg-white shadow-md" />
              <CarouselNext className="-right-4 md:-right-5 bg-white shadow-md" />
            </Carousel>
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic bg-white rounded-md p-4 shadow-sm">Aucune image dans la galerie</div>
        )}

        {isEditable && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="pt-2 bg-white rounded-md shadow-sm"
          >
            <ImageUpload
              imageUrl=""
              onChange={onAddGalleryImage}
              isEditable={true}
              label=""
              placeholder="Ajouter à la galerie"
            />
          </motion.div>
        )}
      </div>

      {/* Modal de prévisualisation plein écran */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl p-1 bg-transparent border-0">
          <div className="relative w-full h-full">
            <DialogClose className="absolute top-2 right-2 z-10">
              <Button variant="secondary" size="icon" className="rounded-full bg-black/50 hover:bg-black/70">
                <X className="h-4 w-4 text-white" />
              </Button>
            </DialogClose>
            
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={previewImage || ''}
              alt="Full size preview"
              className="w-full h-full object-contain rounded-lg shadow-xl"
            />
            
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => previewImage && handleDownloadImage(previewImage)}
            >
              <Download className="h-4 w-4 mr-2" />
              Télécharger
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImageGallery;
