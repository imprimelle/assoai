
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AmountInput } from "./AmountInput";
import ImageUpload from "./ImageUpload";
import { Trash2, Plus, Minus, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { MaterialItem } from "@/types";

interface MaterialCardProps {
  item: MaterialItem;
  onDelete: () => void;
  onChange: (changes: Partial<MaterialItem>) => void;
  isEditable?: boolean;
  sectionName?: string; // ← si on préfère passer explicitement la section
}

const MaterialCard: React.FC<MaterialCardProps> = ({
  item,
  onDelete,
  onChange,
  isEditable = false,
  sectionName
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const section = item.section || sectionName || "";

  const handleIncrement = (
    field: keyof Pick<MaterialItem, "quantite">,
    step = 1
  ) => {
    const currentValue = item[field] || 0;
    onChange({ [field]: Number((currentValue + step).toFixed(2)) });
  };

  const handleDecrement = (
    field: keyof Pick<MaterialItem, "quantite">,
    step = 1
  ) => {
    const currentValue = item[field] || 0;
    const newValue = Math.max(0, Number((currentValue - step).toFixed(2)));
    onChange({ [field]: newValue });
  };

  const handleWidthIncrement = (step = 0.1) => {
    const currentValue = item.largeur || 0;
    onChange({ largeur: Number((currentValue + step).toFixed(2)) });
  };

  const handleWidthDecrement = (step = 0.1) => {
    const currentValue = item.largeur || 0;
    const newValue = Math.max(0, Number((currentValue - step).toFixed(2)));
    onChange({ largeur: newValue });
  };

  const handleHeightIncrement = (step = 0.1) => {
    const currentValue = item.hauteur || 0;
    onChange({ hauteur: Number((currentValue + step).toFixed(2)) });
  };

  const handleHeightDecrement = (step = 0.1) => {
    const currentValue = item.hauteur || 0;
    const newValue = Math.max(0, Number((currentValue - step).toFixed(2)));
    onChange({ hauteur: newValue });
  };

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  const handleInteractiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const calculateSurface = () => {
    if (item.largeur && item.hauteur) {
      return (item.largeur * item.hauteur * (item.quantite || 1)).toFixed(2);
    }
    return "0.00";
  };

  // Fonction pour déterminer le type de fichier et appliquer la classe de couleur appropriée
  const getFileType = (url?: string) => {
    if (!url) return { isImage: false, isPdf: false, extension: "" };
    
    const fileExtension = url.split(".").pop()?.toLowerCase() || "";
    const isImage = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(fileExtension);
    const isPdf = fileExtension === "pdf";
    
    return { isImage, isPdf, extension: fileExtension };
  };

  // Obtenir les informations sur le fichier
  const fileInfo = getFileType(item.image_url);

  // Mapping d'extensions à des classes de couleur de fond
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

  return (
    <div 
      className={`bg-white border border-gray-200 rounded-lg transition-all duration-300 ease-in-out
        ${isCollapsed ? 'p-2' : 'p-4 space-y-4'}`}
      onClick={toggleCollapse}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {item.image_url && (
            <div className="h-10 w-10 rounded-md overflow-hidden flex-shrink-0">
              <img 
                src={item.image_url} 
                alt={item.nom} 
                className="h-full w-full object-cover"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 break-words whitespace-normal">
              {item.nom || "Sans nom"}
            </h3>
            {!isCollapsed && (
              <p className="text-xs text-gray-500">
                {item.reference ? `Réf. ${item.reference}` : "Sans référence"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCollapsed && (
            <span className="text-sm text-gray-500">
              {item.quantite} {item.unite}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
          >
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div onClick={handleInteractiveClick}>
          {/* Affichage de l'image/fichier pour tous les matériaux quand ils sont étendus */}
          {item.image_url && (
            <div className="mt-4 flex justify-center">
              <div className="relative">
                {fileInfo.isImage ? (
                  <button
                    type="button"
                    className="relative h-32 w-full max-w-xs rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview(true);
                    }}
                    aria-label="Aperçu de l'image"
                  >
                    <img
                      src={item.image_url}
                      alt={item.nom || "Aperçu"}
                      className="h-full w-full object-contain"
                    />
                  </button>
                ) : fileInfo.isPdf ? (
                  <button
                    type="button"
                    className="h-32 w-full max-w-xs rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview(true);
                    }}
                    aria-label="Aperçu du PDF"
                  >
                    <div className="flex items-center justify-center h-full w-full bg-gray-100">
                      <FileText className="h-12 w-12 text-gray-400" />
                      <span className="ml-2 text-sm text-gray-500">Document PDF</span>
                    </div>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`h-32 w-full max-w-xs rounded-lg flex items-center justify-center text-white font-bold ${getBgClass(
                      fileInfo.extension
                    )}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(item.image_url, "_blank");
                    }}
                    aria-label={`Ouvrir le fichier .${fileInfo.extension}`}
                  >
                    <span className="text-xl">.{fileInfo.extension.toUpperCase()}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nom sur toute la largeur */}
          <div className="mt-4">
            <Label className="text-xs font-medium text-gray-500 uppercase mb-1">
              Nom
            </Label>
            {isEditable ? (
              <Input
                value={item.nom}
                onChange={(e) => onChange({ nom: e.target.value })}
                className="h-10 w-full"
                placeholder="Nom du matériau"
              />
            ) : (
              <div className="text-sm text-gray-900">{item.nom}</div>
            )}
          </div>

          {/* Réf. & Unité côte‑à‑côte sur mobile, 3‑cols à partir de md */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {/* on réserve la 3ᵉ colonne en mobile */}
            <div className="hidden md:block" />

            <div>
              <Label className="text-xs font-medium text-gray-500 uppercase mb-1">
                Réf.
              </Label>
              {isEditable ? (
                <Input
                  value={item.reference || ""}
                  onChange={(e) => onChange({ reference: e.target.value })}
                  className="h-10 w-full"
                  placeholder="REF-001"
                />
              ) : (
                <div className="text-sm text-gray-900">{item.reference || "-"}</div>
              )}
            </div>

            <div>
              <Label className="text-xs font-medium text-gray-500 uppercase mb-1">
                Unité
              </Label>
              {isEditable ? (
                <Input
                  value={item.unite}
                  onChange={(e) => onChange({ unite: e.target.value })}
                  className="h-10 w-full"
                  placeholder="ex: kg, m²"
                />
              ) : (
                <div className="text-sm text-gray-900">{item.unite}</div>
              )}
            </div>
          </div>

          {/* GRILLE DES NOUVEAUX CHAMPS conditionnels + quantité/dimensions */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {/* Qté */}
            <div className="flex flex-col items-center space-y-1">
              <Label className="text-xs text-gray-500">Q</Label>
              <div className="flex items-center space-x-1">
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleDecrement("quantite");
                  }} className="p-1 h-8 w-8"><Minus size={14} /></Button>
                )}
                <AmountInput
                  value={item.quantite}
                  onChange={(value) => onChange({ quantite: value })}
                  isEditable={isEditable}
                  min={1}
                />
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleIncrement("quantite");
                  }} className="p-1 h-8 w-8"><Plus size={14} /></Button>
                )}
              </div>
            </div>

            {/* Largeur */}
            <div className="flex flex-col items-center space-y-1">
              <Label className="text-xs text-gray-500">L</Label>
              <div className="flex items-center space-x-1">
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleWidthDecrement();
                  }} className="p-1 h-8 w-8"><Minus size={14} /></Button>
                )}
                <AmountInput
                  value={item.largeur || 0}
                  onChange={(value) => onChange({ largeur: value })}
                  isEditable={isEditable}
                  min={0}
                  step={0.1}
                />
                {isEditable && (
                  <Button variant="outline" size="sm" onClick={(e) => {
                    e.stopPropagation();
                    handleWidthIncrement();
                  }} className="p-1 h-8 w-8"><Plus size={14} /></Button>
                )}
              </div>
            </div>

            {/* Hauteur – affichée uniquement pour Découpe et Vinyl */}
            {["Découpe", "Vinyl"].includes(section) && (
              <div className="flex flex-col items-center space-y-1">
                <Label className="text-xs text-gray-500">H</Label>
                <div className="flex items-center space-x-1">
                  {isEditable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleHeightDecrement(); }}
                      className="p-1 h-8 w-8"
                    >
                      <Minus size={14} />
                    </Button>
                  )}
                  <AmountInput
                    value={item.hauteur || 0}
                    onChange={(value) => onChange({ hauteur: value })}
                    isEditable={isEditable}
                    min={0}
                    step={0.1}
                  />
                  {isEditable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); handleHeightIncrement(); }}
                      className="p-1 h-8 w-8"
                    >
                      <Plus size={14} />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Champs conditionnels selon la section */}
          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Couleur: seulement pour Éclairage ou Vinyl */}
            {isEditable && ["Éclairage", "Vinyl", "Découpe"].includes(section) && (
              <div>
                <Label className="text-xs">Couleur</Label>
                <select
                  value={item.couleur || ""}
                  onChange={e => onChange({ couleur: e.target.value })}
                  className="w-full h-8 text-sm"
                >
                  <option value="">--</option>
                  <option value="Rouge">Rouge</option>
                  <option value="Bleu">Bleu</option>
                  <option value="Vert">Vert</option>
                  <option value="Blue ice">Blue_ice</option>
                  <option value="Blanc">Blanc</option>
                  <option value="Blanc chaud">Blanc_chaud</option>
                  <option value="orange">Orange</option>
                  <option value="Doré">Doré</option>
                  <option value="violet">violet</option>
                </select>
              </div>
            )}

            {/* Epaisseur: seulement pour Métal ou Découpe */}
            {isEditable && ["Métal", "Découpe"].includes(section) && (
              <div>
                <Label className="text-xs">Epaisseur</Label>
                <select
                  value={item.epaisseur || ""}
                  onChange={e => onChange({ epaisseur: e.target.value })}
                  className="w-full h-8 text-sm"
                >
                  <option value="">--</option>
                  <option value="1mm">3 mm</option>
                  <option value="2mm">5 mm</option>
                  <option value="5mm">8 mm</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-4">
            <div className="text-sm text-gray-600">
              Surface: {calculateSurface()} m²
            </div>

            {isEditable && (
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="text-red-600 hover:text-red-800 p-0 h-10 w-10"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            )}
          </div>

          {/* ImageUpload pour tous les matériaux */}
          {isEditable && (
            <div className="mt-4">
              <ImageUpload
                imageUrl={item.image_url || ""}
                onChange={(url) => onChange({ image_url: url })}
                isEditable={isEditable}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal de prévisualisation pour les images et PDFs */}
      {showPreview && item.image_url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
          onClick={(e) => {
            e.stopPropagation();
            setShowPreview(false);
          }}
        >
          <div
            className="w-[90vw] h-[90vh] bg-white rounded-lg overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {fileInfo.isImage ? (
              <img
                src={item.image_url}
                alt="Aperçu complet"
                className="w-full h-auto"
              />
            ) : fileInfo.isPdf ? (
              <iframe
                src={item.image_url}
                className="w-full h-full"
              />
            ) : null}
          </div>

          <button
            type="button"
            className="absolute top-5 right-5 text-white p-2 bg-black bg-opacity-50 rounded-full"
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

export default MaterialCard;
