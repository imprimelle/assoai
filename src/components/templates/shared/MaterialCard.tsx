
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import ImageUpload from "./ImageUpload";
import { Trash2, ChevronDown, ChevronUp, FileText, Ruler } from "lucide-react";
import type { MaterialItem } from "@/types";
import { UNITES, COULEURS, EPAISSEURS, withCurrent } from "@/constants/materials";

interface MaterialCardProps {
  item: MaterialItem;
  onDelete: () => void;
  onChange: (changes: Partial<MaterialItem>) => void;
  isEditable?: boolean;
  sectionName?: string; // ← si on préfère passer explicitement la section
}

// Formatage léger d'un nombre pour l'affichage (résumé header, mode lecture).
const fmtNum = (n?: number) => {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  return Number(n.toFixed(2)).toLocaleString("fr-FR");
};

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

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  const handleInteractiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Saisie numérique directe (remplace les boutons +/-).
  const handleNumberChange = (
    field: "quantite" | "largeur" | "hauteur",
    raw: string
  ) => {
    if (raw === "") {
      onChange({ [field]: field === "quantite" ? 1 : 0 });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange({ [field]: Math.max(0, parsed) });
  };

  const calculateSurface = () => {
    if (item.largeur && item.hauteur) {
      return (item.largeur * item.hauteur * (item.quantite || 1)).toFixed(2);
    }
    return "0.00";
  };

  const showHauteur = ["Découpe", "Vinyl"].includes(section);
  const showCouleur =
    ["Éclairage", "Vinyl", "Découpe"].includes(section) ||
    (item.couleurs_dispo && item.couleurs_dispo.length > 0);
  const showEpaisseur = ["Métal", "Découpe"].includes(section);

  // Résumé compact affiché dans le header (mode replié).
  const dimsSummary = (() => {
    const parts: string[] = [];
    if (item.quantite) parts.push(`${fmtNum(item.quantite)} ${item.unite || ""}`.trim());
    if (item.largeur) {
      parts.push(
        showHauteur && item.hauteur
          ? `${fmtNum(item.largeur)} × ${fmtNum(item.hauteur)} m`
          : `${fmtNum(item.largeur)} m`
      );
    }
    if (item.largeur && item.hauteur) parts.push(`${calculateSurface()} m²`);
    return parts.join(" · ");
  })();

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

  // Styles partagés
  const sectionTitleCls =
    "text-[10px] font-semibold tracking-wider uppercase text-gray-400 border-b border-gray-100 pb-1";
  const numInputCls =
    "h-11 w-full text-center text-base font-medium tabular-nums";

  return (
    <div
      className={`bg-white border border-gray-200 rounded-lg transition-all duration-300 ease-in-out
        ${isCollapsed ? 'p-2' : 'p-4 space-y-5'}`}
      onClick={toggleCollapse}
    >
      {/* ===================== HEADER ===================== */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
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
              {item.material_id && (
                <span className="ml-2 inline-flex items-center text-[10px] bg-amber-100 text-amber-700 rounded-full px-1.5 py-0.5 align-middle">
                  📦 catalogue
                </span>
              )}
            </h3>
            {isCollapsed
              ? dimsSummary && (
                  <p className="text-xs text-gray-500 truncate">{dimsSummary}</p>
                )
              : (
                <p className="text-xs text-gray-500">
                  {item.reference ? `Réf. ${item.reference}` : "Sans référence"}
                </p>
              )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" className="p-1">
            {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div onClick={handleInteractiveClick} className="space-y-5">
          {/* Aperçu fichier (si présent) */}
          {item.image_url && (
            <div className="flex justify-center">
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

          {/* ===================== SECTION 1 · IDENTIFICATION ===================== */}
          <div className="space-y-3">
            <div className={sectionTitleCls}>Identification</div>

            <div>
              <Label className="text-xs font-medium text-gray-500 mb-1 block">Nom</Label>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1 block">Référence</Label>
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
                <Label className="text-xs font-medium text-gray-500 mb-1 block">Unité</Label>
                {isEditable ? (
                  <>
                    <Input
                      list={`unite-options-${item.id}`}
                      value={item.unite || ""}
                      onChange={(e) => onChange({ unite: e.target.value })}
                      className="h-10 w-full"
                      placeholder="ex: plaque, m²"
                    />
                    <datalist id={`unite-options-${item.id}`}>
                      {withCurrent(UNITES, item.unite).map((u) => (
                        <option key={u} value={u} />
                      ))}
                    </datalist>
                  </>
                ) : (
                  <div className="text-sm text-gray-900">{item.unite}</div>
                )}
              </div>
            </div>
          </div>

          {/* ===================== SECTION 2 · DIMENSIONS & QUANTITÉ ===================== */}
          <div className="space-y-3">
            <div className={sectionTitleCls}>Dimensions &amp; quantité</div>

            <div className={`grid ${showHauteur ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
              {/* Quantité */}
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1 block">Quantité</Label>
                {isEditable ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={1}
                    step={1}
                    value={item.quantite ?? 1}
                    onChange={(e) => handleNumberChange("quantite", e.target.value)}
                    className={numInputCls}
                  />
                ) : (
                  <div className="h-11 flex items-center justify-center text-base font-medium text-gray-900 tabular-nums">
                    {fmtNum(item.quantite)}
                  </div>
                )}
              </div>

              {/* Largeur */}
              <div>
                <Label className="text-xs font-medium text-gray-500 mb-1 block">
                  Largeur <span className="text-gray-400">(m)</span>
                </Label>
                {isEditable ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    value={item.largeur ?? 0}
                    onChange={(e) => handleNumberChange("largeur", e.target.value)}
                    className={numInputCls}
                  />
                ) : (
                  <div className="h-11 flex items-center justify-center text-base font-medium text-gray-900 tabular-nums">
                    {fmtNum(item.largeur)}
                  </div>
                )}
              </div>

              {/* Hauteur – uniquement Découpe & Vinyl */}
              {showHauteur && (
                <div>
                  <Label className="text-xs font-medium text-gray-500 mb-1 block">
                    Hauteur <span className="text-gray-400">(m)</span>
                  </Label>
                  {isEditable ? (
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step={0.1}
                      value={item.hauteur ?? 0}
                      onChange={(e) => handleNumberChange("hauteur", e.target.value)}
                      className={numInputCls}
                    />
                  ) : (
                    <div className="h-11 flex items-center justify-center text-base font-medium text-gray-900 tabular-nums">
                      {fmtNum(item.hauteur)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Surface calculée en badge */}
            <div className="flex items-center">
              <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium px-2.5 py-1 rounded-md">
                <Ruler size={14} />
                Surface totale : <strong>{calculateSurface()} m²</strong>
              </span>
            </div>
          </div>

          {/* ===================== SECTION 3 · CARACTÉRISTIQUES ===================== */}
          {isEditable && (showCouleur || showEpaisseur) && (
            <div className="space-y-3">
              <div className={sectionTitleCls}>Caractéristiques</div>
              <div className="grid grid-cols-2 gap-3">
                {showCouleur && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500 mb-1 block">Couleur</Label>
                    <select
                      value={item.couleur || ""}
                      onChange={(e) => onChange({ couleur: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                    >
                      <option value="">--</option>
                      {withCurrent(
                        item.couleurs_dispo && item.couleurs_dispo.length > 0
                          ? item.couleurs_dispo
                          : COULEURS,
                        item.couleur,
                      ).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {showEpaisseur && (
                  <div>
                    <Label className="text-xs font-medium text-gray-500 mb-1 block">Épaisseur</Label>
                    <select
                      value={item.epaisseur || ""}
                      onChange={(e) => onChange({ epaisseur: e.target.value })}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
                    >
                      <option value="">--</option>
                      {withCurrent(EPAISSEURS, item.epaisseur).map((ep) => (
                        <option key={ep} value={ep}>{ep}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== SECTION 4 · PIÈCE JOINTE ===================== */}
          {isEditable && (
            <div className="space-y-2">
              <div className={sectionTitleCls}>Pièce jointe</div>
              <ImageUpload
                imageUrl={item.image_url || ""}
                onChange={(url) => onChange({ image_url: url })}
                isEditable={isEditable}
              />
            </div>
          )}

          {/* ===================== ACTIONS ===================== */}
          {isEditable && (
            <div className="flex justify-end pt-1 border-t border-gray-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-red-600 hover:text-red-800 hover:bg-red-50 gap-1.5"
              >
                <Trash2 size={16} />
                Supprimer
              </Button>
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
