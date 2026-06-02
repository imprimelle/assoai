
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  ImagePlus,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  FileText,
} from "lucide-react";
import type { ImageUploadFieldProps } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import { appLogger } from "@/utils/logger";

// Export the component directly, not as a named export
const ImageUpload: React.FC<ImageUploadFieldProps> = ({
  imageUrl,
  onChange,
  label = "Fichier",
  placeholder = "Ajouter un fichier",
  isEditable = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);

  const fileExtension = imageUrl?.split(".").pop()?.toLowerCase() || "";
  const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(
    fileExtension
  );

  // Mapping extensions to background classes
  const extColors: Record<string, string> = {
    ai: "bg-yellow-500",
    dwg: "bg-blue-500",
    eps: "bg-green-500",
    txt: "bg-gray-600",
    doc: "bg-blue-700",
    docx: "bg-blue-700",
    xls: "bg-green-700",
    xlsx: "bg-green-700",
    default: "bg-gray-400",
  };
  const getBgClass = (ext: string) => extColors[ext] || extColors.default;

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploading(true);
      setUploadError(false);

      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `public/${fileName}`;

      appLogger.info("📤 Upload du fichier vers Supabase", {
        fileName,
        fileType: file.type,
        fileSize: file.size,
      });

      const { error: uploadErr } = await supabase.storage
        .from("images")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);

      onChange(publicUrl);
    } catch (err) {
      appLogger.error("❌ Erreur lors de l'upload du fichier", err);
      setUploadError(true);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-gray-500 uppercase">
        {label}
      </Label>

      <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
        {/* Preview area */}
        {!uploadError && imageUrl ? (
          isImage ? (
            <button
              type="button"
              className="relative h-16 w-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
              aria-label="Aperçu de l'image"
            >
              <img
                src={imageUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            </button>
          ) : fileExtension === "pdf" ? (
            <button
              type="button"
              className="h-16 w-16 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 p-0 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
              aria-label="Aperçu du PDF"
            >
              <object
                data={imageUrl}
                type="application/pdf"
                className="h-full w-full pointer-events-none"
              >
                <div className="pointer-events-none flex items-center justify-center h-full w-full bg-gray-100">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </object>
            </button>
          ) : (
            <button
              type="button"
              className={`h-16 w-16 rounded-lg flex items-center justify-center text-white font-bold text-xs flex-shrink-0 ${getBgClass(
                fileExtension
              )}`}
              onClick={(e) => {
                e.stopPropagation();
                window.open(imageUrl, "_blank");
              }}
              aria-label={`Ouvrir le fichier .${fileExtension}`}
            >
              .{fileExtension.toUpperCase()}
            </button>
          )
        ) : uploadError ? (
          <div className="h-16 w-16 rounded-lg border border-red-300 flex flex-col items-center justify-center bg-red-50 flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            <span className="text-xs text-red-500 mt-1">Erreur</span>
          </div>
        ) : (
          <div className="h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 flex-shrink-0">
            <ImageIcon className="h-8 w-8 text-gray-400" />
          </div>
        )}

        {/* Upload button */}
        {isEditable && (
          <div className="flex-1 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="relative overflow-hidden w-full text-xs sm:text-sm h-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> 
                  <span className="hidden sm:inline">Upload en cours...</span>
                  <span className="sm:hidden">Upload...</span>
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate">
                    {imageUrl && !uploadError ? "Changer le fichier" : placeholder}
                  </span>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="*/*"
                onChange={handleFileChange}
              />
            </Button>
          </div>
        )}
      </div>

      {/* Fullscreen preview for images and PDFs */}
      {showPreview && !uploadError && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full h-full max-w-[90vw] max-h-[90vh] bg-white rounded-lg overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {isImage ? (
              <img
                src={imageUrl}
                alt="Full preview"
                className="w-full h-auto"
              />
            ) : fileExtension === "pdf" ? (
              <iframe
                src={imageUrl}
                className="w-full h-full min-h-[500px]"
              />
            ) : null}
          </div>

          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-70 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(false);
            }}
            aria-label="Fermer l'aperçu"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
};

// Export the component as default
export default ImageUpload;
