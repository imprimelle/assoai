// src/components/cdc-builder/CdcBuilderRow.tsx
// Ligne éditable inline du tableau CDC Builder — 3 colonnes adaptatives par section.
// v8: swipe gauche → révèle checkbox (glissement temps réel), remplace le long-press.

import React, { useState, useRef, useCallback } from "react";
import { Trash2, ChevronDown, ChevronUp, Plus, Check } from "lucide-react";
import MaterialCell from "./MaterialCell";
import {
  UNITES,
  COULEURS,
  EPAISSEURS,
  withCurrent,
} from "@/constants/materials";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// --- Règles de visibilité ---
const showHauteur = (section: string) =>
  ["Découpe", "Vinyl"].includes(section);
const showCouleur = (section: string, item: MaterialItem) =>
  ["Éclairage", "Vinyl", "Découpe"].includes(section) ||
  (item.couleurs_dispo && item.couleurs_dispo.length > 0);
const showEpaisseur = (section: string) =>
  ["Métal", "Découpe"].includes(section);

// --- Constantes swipe ---
const SWIPE_REVEAL = 48;      // px à révéler
const SWIPE_THRESHOLD = 30;    // seuil pour snap ouvert/fermé
const SWIPE_MAX = 80;          // limite max du swipe gauche

// --- Props ---
export interface CdcBuilderRowProps {
  row: FlatMaterialRow;
  defaultDimensions: { largeur: number; hauteur: number };
  onChange: (changes: Partial<MaterialItem>) => void;
  onDelete: () => void;
  onMoveToSection?: (targetSection: string, preset: Partial<MaterialItem>, entry: MaterialCatalogEntry) => void;
  disabled?: boolean;
  enseigneBadge?: { nom: string; color?: string };
  flashType?: "added" | "modified";
  enseigneId?: string;
  // --- Props groupe ---
  onChangeEnfants?: (enfants: MaterialItem[]) => void;
  onDeleteEnfant?: (enfantIndex: number) => void;
  onAddEnfant?: () => void;
  // --- 🆕 Swipe selection ---
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

const CdcBuilderRow: React.FC<CdcBuilderRowProps> = ({
  row,
  defaultDimensions,
  onChange,
  onDelete,
  onMoveToSection,
  disabled = false,
  enseigneBadge,
  flashType,
  enseigneId,
  onChangeEnfants,
  onDeleteEnfant,
  onAddEnfant,
  selectable = false,
  selected = false,
  onToggleSelect,
}) => {
  const { section, item } = row;
  const [expanded, setExpanded] = useState(false);
  const isGroup = !!(item.groupe_enfants && item.groupe_enfants.length > 0);

  // --- Swipe state ---
  const [swipeX, setSwipeX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwipingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!selectable || isGroup || disabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, [selectable, isGroup, disabled]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!selectable || isGroup || disabled) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);

    // Détecter si c'est un swipe horizontal
    if (!isSwipingRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > dy * 0.7) {
        isSwipingRef.current = true;
      } else {
        return;
      }
    }

    e.preventDefault();

    if (swipeX < 0) {
      // Déjà ouvert (gauche) → on swipe : droite pour refermer, gauche pour continuer
      setSwipeX(Math.max(-SWIPE_MAX, Math.min(0, swipeX + dx * 0.4)));
    } else if (dx < 0) {
      // Premier swipe gauche → ouvrir
      setSwipeX(Math.max(dx, -SWIPE_MAX));
    }
    touchStartX.current = e.touches[0].clientX;
  }, [selectable, isGroup, disabled, swipeX]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;
    isSwipingRef.current = false;

    if (swipeX < -SWIPE_THRESHOLD) {
      setSwipeX(-SWIPE_REVEAL); // snap ouvert
    } else {
      setSwipeX(0); // snap fermé
    }
  }, [swipeX]);

  const handleCheckClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.();
  }, [onToggleSelect]);

  const handleNum = (
    field: "quantite" | "largeur" | "hauteur",
    raw: string,
  ) => {
    if (raw === "") {
      onChange({ [field]: field === "quantite" ? 1 : 0 });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChange({ [field]: Math.max(0, parsed) });
  };

  const handleCatalogSelect = (preset: Partial<MaterialItem>, entry: MaterialCatalogEntry) => {
    if (entry.categorie && entry.categorie !== section && onMoveToSection) {
      onMoveToSection(entry.categorie, preset, entry);
    } else {
      onChange(preset);
    }
  };

  const handleEnfantNum = (
    enfant: MaterialItem,
    field: "quantite" | "largeur" | "hauteur",
    raw: string,
  ) => {
    const enfants = [...(item.groupe_enfants || [])];
    const idx = enfants.findIndex(e => e.id === enfant.id);
    if (idx < 0) return;
    if (raw === "") {
      enfants[idx] = { ...enfants[idx], [field]: field === "quantite" ? 1 : 0 };
    } else {
      const parsed = Number(raw);
      if (Number.isNaN(parsed)) return;
      enfants[idx] = { ...enfants[idx], [field]: Math.max(0, parsed) };
    }
    onChangeEnfants?.(enfants);
  };

  const cellInput =
    "h-9 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  const surfaceChute = (): number => {
    if (!isGroup) return 0;
    const feuilleSurface = (item.largeur || 0) * (item.hauteur || 0);
    const occupee = (item.groupe_enfants || []).reduce((sum, e) => {
      return sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1);
    }, 0);
    return Math.max(0, feuilleSurface - occupee);
  };

  const renderEnfantRow = (enfant: MaterialItem, index: number) => (
    <div key={enfant.id} className="flex items-center gap-2 py-1.5 border-b border-indigo-100 last:border-b-0">
      <div className="w-[180px] shrink-0">
        <input
          type="text"
          value={enfant.nom}
          onChange={(e) => {
            const enfants = [...(item.groupe_enfants || [])];
            enfants[index] = { ...enfants[index], nom: e.target.value };
            onChangeEnfants?.(enfants);
          }}
          disabled={disabled}
          className={`${cellInput} w-full text-xs`}
          placeholder="Nom plaque"
        />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-gray-300">×</span>
          <input type="number" inputMode="decimal" min={1}
            value={enfant.quantite ?? 1}
            onChange={(e) => handleEnfantNum(enfant, "quantite", e.target.value)}
            disabled={disabled}
            className={`${cellInput} w-[44px] text-center tabular-nums text-xs`} />
        </div>
        <div className="flex items-center gap-0.5">
          <span className="text-[10px] text-gray-300 w-2">L</span>
          <input type="number" inputMode="decimal" min={0} step={0.1}
            value={enfant.largeur ?? ""}
            onChange={(e) => handleEnfantNum(enfant, "largeur", e.target.value)}
            disabled={disabled}
            className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
        </div>
        {showHauteur(section) ? (
          <div className="flex items-center gap-0.5">
            <span className="text-[10px] text-gray-300 w-2">H</span>
            <input type="number" inputMode="decimal" min={0} step={0.1}
              value={enfant.hauteur ?? ""}
              onChange={(e) => handleEnfantNum(enfant, "hauteur", e.target.value)}
              disabled={disabled}
              className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
          </div>
        ) : (
          <span className="text-gray-300 text-xs w-[52px] text-center">—</span>
        )}
        <span className="text-[10px] text-gray-400 w-12 text-center">{enfant.unite || "plaque"}</span>
      </div>
      <span className="text-[10px] text-indigo-500 w-16 text-right tabular-nums">
        {enfant.largeur && enfant.hauteur
          ? ((enfant.largeur * enfant.hauteur * (enfant.quantite || 1)).toFixed(2) + " m²")
          : "—"}
      </span>
      {!disabled && onDeleteEnfant && (
        <button type="button" onClick={() => onDeleteEnfant(index)}
          className="text-red-300 hover:text-red-500 p-0.5 transition-colors shrink-0"
          title="Retirer cette plaque du groupe">
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );

  // Opacité de la checkbox : proportionnelle au swipe
  const checkOpacity = swipeX < 0
    ? Math.min(1, Math.abs(swipeX) / SWIPE_REVEAL)
    : 0;

  return (
    <div
      data-highlight-key={enseigneId ? `${enseigneId}-${section}-${row.index}` : undefined}
      className={`relative overflow-hidden ${
        flashType ? `flash-${flashType}` : ""
      } ${
        selected ? "ring-2 ring-indigo-400 bg-indigo-50/60 rounded-lg" : ""
      }`}
    >
      {/* 🆕 Fond swipe — checkbox à droite, révélée au swipe gauche */}
      {selectable && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center bg-indigo-50 rounded-r-lg"
          style={{
            width: SWIPE_REVEAL,
            opacity: checkOpacity,
            transition: "opacity 0.15s",
          }}
        >
          <button
            type="button"
            onClick={handleCheckClick}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              selected
                ? "bg-indigo-500 border-indigo-500 text-white"
                : "border-gray-300 bg-white text-transparent"
            }`}
          >
            {selected && <Check size={14} />}
          </button>
        </div>
      )}

      {/* Carte swipeable */}
      <div
        onTouchStart={selectable ? handleTouchStart : undefined}
        onTouchMove={selectable ? handleTouchMove : undefined}
        onTouchEnd={selectable ? handleTouchEnd : undefined}
        style={{ transform: `translateX(${swipeX}px)` }}
        className={`transition-transform duration-200 overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 py-2 border-b border-gray-100 last:border-b-0 scrollbar-subtle ${
          isGroup ? "border-l-2 border-l-indigo-300" : ""
        } ${
          selected ? "border-l-2 border-l-indigo-500" : ""
        }`}
      >
        <div className="flex items-center gap-2 min-w-[620px] md:min-w-0">
          {/* Badge sélection (gauche) */}
          {selected && (
            <div className="shrink-0 w-5 h-5 rounded bg-indigo-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}

          {/* Chevron dropdown pour les groupes */}
          {isGroup && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="text-indigo-400 hover:text-indigo-600 p-0.5 transition-colors shrink-0"
              title={expanded ? "Replier le groupe" : "Déplier le groupe"}
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}

          {/* Colonne 1 : Matériau */}
          <div className="w-[200px] shrink-0">
            {enseigneBadge && (
              <span
                className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium mb-1 truncate max-w-full"
                style={{
                  backgroundColor: enseigneBadge.color ? `${enseigneBadge.color}20` : '#EEF2FF',
                  color: enseigneBadge.color || '#4F46E5',
                  border: `1px solid ${enseigneBadge.color ? `${enseigneBadge.color}40` : '#C7D2FE'}`,
                }}
                title={enseigneBadge.nom}
              >
                🏷️ {enseigneBadge.nom}
              </span>
            )}
            <MaterialCell
              value={item.nom}
              onChange={(nom) => onChange({ nom })}
              onCatalogSelect={handleCatalogSelect}
              onClear={() => onChange({ nom: "" })}
              disabled={disabled}
            />
            {isGroup && (
              <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-indigo-100 text-indigo-600">
                📐 Groupe · {(item.groupe_enfants || []).length} plaque{(item.groupe_enfants || []).length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Colonne 2 : Paramètres */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-gray-300">×</span>
              <input type="number" inputMode="decimal" min={1}
                value={item.quantite ?? 1}
                onChange={(e) => handleNum("quantite", e.target.value)}
                disabled={disabled}
                className={`${cellInput} w-[44px] text-center tabular-nums text-xs`} />
            </div>
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] text-gray-300 w-2">L</span>
              <input type="number" inputMode="decimal" min={0} step={0.1}
                value={item.largeur ?? ""} placeholder={isGroup ? "Feuille L" : String(defaultDimensions.largeur)}
                onChange={(e) => handleNum("largeur", e.target.value)}
                disabled={disabled}
                className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
            </div>
            {showHauteur(section) ? (
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-gray-300 w-2">H</span>
                <input type="number" inputMode="decimal" min={0} step={0.1}
                  value={item.hauteur ?? ""} placeholder={isGroup ? "Feuille H" : String(defaultDimensions.hauteur)}
                  onChange={(e) => handleNum("hauteur", e.target.value)}
                  disabled={disabled}
                  className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
              </div>
            ) : (
              <span className="text-gray-300 text-xs w-[52px] text-center">—</span>
            )}
            <input list={`unite-cdc-${item.id}`} value={item.unite || ""}
              onChange={(e) => onChange({ unite: e.target.value })}
              disabled={disabled}
              className={`${cellInput} w-[72px] text-xs`} placeholder="unité" />
            <datalist id={`unite-cdc-${item.id}`}>
              {withCurrent(UNITES, item.unite).map((u) => <option key={u} value={u} />)}
            </datalist>
          </div>

          {/* Colonne 3 : Détails */}
          <div className="flex items-center gap-2 shrink-0">
            {showEpaisseur(section) ? (
              <select value={item.epaisseur || ""}
                onChange={(e) => onChange({ epaisseur: e.target.value })}
                disabled={disabled}
                className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[110px]">
                <option value="">Épaisseur</option>
                {withCurrent(EPAISSEURS, item.epaisseur).map((ep) => <option key={ep} value={ep}>{ep}</option>)}
              </select>
            ) : (
              <span className="text-gray-300 text-sm w-[110px] text-center">—</span>
            )}
            {showCouleur(section, item) ? (
              <select value={item.couleur || ""}
                onChange={(e) => onChange({ couleur: e.target.value })}
                disabled={disabled}
                className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[130px]">
                <option value="">Couleur</option>
                {withCurrent(
                  item.couleurs_dispo?.length ? item.couleurs_dispo : COULEURS,
                  item.couleur,
                ).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : null}
            {!disabled && (
              <button type="button" onClick={onDelete}
                className="text-red-400 hover:text-red-600 p-1 transition-colors shrink-0"
                title="Supprimer cette ligne">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Enfants du groupe (dépliés) */}
      {isGroup && expanded && (
        <div className="ml-7 mt-2 pl-3 border-l-2 border-indigo-200 bg-indigo-50/30 rounded-r-lg">
          <div className="flex items-center gap-4 text-[10px] text-gray-500 mb-1.5 pt-1">
            <span>Surface feuille : <strong className="text-indigo-600">{((item.largeur || 0) * (item.hauteur || 0)).toFixed(2)} m²</strong></span>
            <span>Surface utilisée : <strong className="text-indigo-600">{(item.groupe_enfants || []).reduce((s, e) => s + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1), 0).toFixed(2)} m²</strong></span>
            <span>Chute : <strong className={surfaceChute() > 0 ? "text-amber-600" : "text-green-600"}>{surfaceChute().toFixed(2)} m²</strong></span>
          </div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-gray-400 mb-1">
            <span className="w-[180px] shrink-0">Plaque</span>
            <span className="w-[44px] text-center">Qté</span>
            <span className="w-[52px] text-center">L (m)</span>
            <span className="w-[52px] text-center">H (m)</span>
            <span className="w-12 text-center">Unité</span>
            <span className="w-16 text-right">Surface</span>
          </div>
          {(item.groupe_enfants || []).map((enfant, i) => renderEnfantRow(enfant, i))}
          {!disabled && onAddEnfant && (
            <button
              type="button"
              onClick={onAddEnfant}
              className="flex items-center gap-1 mt-1.5 mb-1 text-xs text-indigo-400 hover:text-indigo-600 font-medium transition-colors py-1"
            >
              <Plus size={12} />
              Ajouter une plaque
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CdcBuilderRow;
