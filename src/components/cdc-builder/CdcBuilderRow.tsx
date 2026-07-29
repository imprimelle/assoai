// src/components/cdc-builder/CdcBuilderRow.tsx
// Ligne éditable inline du tableau CDC Builder — 3 colonnes adaptatives par section.
// v10: selectionMode pour checkbox visible sans swipe, badge groupe amélioré.

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Trash2, Plus, Check, Layers, Eye, ChevronRight } from "lucide-react";
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
const SWIPE_REVEAL = 48;
const SWIPE_THRESHOLD = 30;
const SWIPE_MAX = 80;

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
  // --- Swipe selection ---
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  // 🆕 Dissocier un enfant du groupe
  onDissocierEnfant?: (enfantIndex: number) => void;
  // 🆕 Scroll sync — seule la ligne active peut avoir scrollLeft > 0
  isActive?: boolean;
  onActivate?: () => void;
  // 🆕 Mode sélection explicite — checkbox visible sans swipe
  selectionMode?: boolean;
  // 🆕 Ouvrir l'aperçu feuille au niveau page
  onOpenPreview?: () => void;
}

// ── Composant pour fermer les swipes au clic extérieur ──
/** Écoute mousedown sur document et appelle onClose si le clic est hors de rowRef */
const ClickOutsideCloser: React.FC<{
  rowRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}> = ({ rowRef, onClose }) => {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ne pas fermer si le clic est sur un bouton d'action swipe (checkbox, dissocier)
      if (target.closest('[data-swipe-check]')) return;
      // Ne pas fermer si le clic est à l'intérieur de la row
      if (rowRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler, true); // capture phase
    return () => document.removeEventListener('mousedown', handler, true);
  }, [rowRef, onClose]);
  return null;
};

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
  onDissocierEnfant,
  isActive = false,
  onActivate,
  selectionMode = false,
  onOpenPreview,
}) => {
  const { section, item } = row;
  const [expanded, setExpanded] = useState(false);
  const isGroup = !!(item.groupe_enfants && item.groupe_enfants.length > 0);
  const enfantCount = item.groupe_enfants?.length || 0;

  // 🆕 Scroll sync — ref sur le conteneur scrollable
  const scrollRef = useRef<HTMLDivElement>(null);

  // 🆕 Scroll sync pour les lignes enfants
  const enfantScrollRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 🆕 Reset scroll quand la ligne perd l'activité (parent + enfants)
  useEffect(() => {
    if (!isActive) {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
      enfantScrollRefs.current.forEach((el) => { el.scrollLeft = 0; });
    }
  }, [isActive]);

  // 🆕 Swipe par enfant (dissocier)
  // 🔴 Fix stale closure : useRef pour la position courante
  const [childSwipes, setChildSwipes] = useState<Record<string, number>>({});
  const childSwipesRef = useRef<Record<string, number>>({});
  const [childNoAnim, setChildNoAnim] = useState(false);
  const childTouchStart = useRef(0);
  const childIsSwiping = useRef(false);
  const childCurrentId = useRef<string | null>(null);

  // 🆕 Scroll sync enfants — seule la ligne enfant active garde son scroll
  const [activeEnfantId, setActiveEnfantId] = useState<string | null>(null);
  useEffect(() => {
    enfantScrollRefs.current.forEach((el, id) => {
      if (id !== activeEnfantId) {
        el.scrollLeft = 0;
      }
    });
  }, [activeEnfantId]);

  // --- Swipe state (sélection) — désactivé en selectionMode ---
  // 🔴 Fix stale closure : useRef pour la position courante, useState pour le rendu seul
  const [swipeX, setSwipeX] = useState(0);
  const swipeXRef = useRef(0);
  const [noAnim, setNoAnim] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwipingRef = useRef(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (selectionMode || !selectable || isGroup || disabled) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, [selectable, isGroup, disabled, selectionMode]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (selectionMode || !selectable || isGroup || disabled) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);
    if (!isSwipingRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > dy * 0.7) {
        isSwipingRef.current = true;
      } else {
        return;
      }
    }
    e.preventDefault();
    const current = swipeXRef.current;
    let next: number;
    if (current < 0) {
      next = Math.max(-SWIPE_MAX, Math.min(0, current + dx * 0.4));
    } else if (dx < 0) {
      next = Math.max(dx, -SWIPE_MAX);
    } else {
      next = current;
    }
    swipeXRef.current = next;
    setSwipeX(next);
    touchStartX.current = e.touches[0].clientX;
  }, [selectable, isGroup, disabled, selectionMode]);

  const handleTouchEnd = useCallback(() => {
    if (!isSwipingRef.current) return;
    isSwipingRef.current = false;
    const current = swipeXRef.current;
    if (current < -SWIPE_THRESHOLD) {
      swipeXRef.current = -SWIPE_REVEAL;
      setSwipeX(-SWIPE_REVEAL);
    } else {
      swipeXRef.current = 0;
      setNoAnim(true);
      setSwipeX(0);
    }
  }, []);

  // Réactiver l'animation après un reset
  useEffect(() => {
    if (noAnim && swipeX === 0) {
      const t = setTimeout(() => setNoAnim(false), 50);
      return () => clearTimeout(t);
    }
  }, [noAnim, swipeX]);

  const handleCheckClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect?.();
  }, [onToggleSelect]);

  // 🆕 Clic sur la ligne en mode sélection = toggle
  const handleRowClick = useCallback((e: React.MouseEvent) => {
    if (!selectionMode || !selectable) return;
    const target = e.target as HTMLElement;
    // Ne pas toggle si clic sur un bouton, input, select ou le MaterialCell (qui gère déjà)
    if (target.closest('button, input, select, [data-no-select]')) return;
    onToggleSelect?.();
  }, [selectionMode, selectable, onToggleSelect]);

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

  // --- Handlers enfants ---
  const handleEnfantChange = (index: number, changes: Partial<MaterialItem>) => {
    const enfants = [...(item.groupe_enfants || [])];
    enfants[index] = { ...enfants[index], ...changes };
    onChangeEnfants?.(enfants);
  };

  const handleEnfantCatalog = (index: number, preset: Partial<MaterialItem>, _entry: MaterialCatalogEntry) => {
    handleEnfantChange(index, preset);
  };

  const handleEnfantNum = (
    enfant: MaterialItem,
    index: number,
    field: "quantite" | "largeur" | "hauteur",
    raw: string,
  ) => {
    if (raw === "") {
      handleEnfantChange(index, { [field]: field === "quantite" ? 1 : 0 });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    handleEnfantChange(index, { [field]: Math.max(0, parsed) });
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

  // 🆕 Rendu d'un enfant avec swipe dissocier
  const renderEnfantRow = (enfant: MaterialItem, index: number) => {
    const sX = childSwipes[enfant.id] || 0;
    const checkOp = sX < 0 ? Math.min(1, Math.abs(sX) / SWIPE_REVEAL) : 0;

    const onStart = (e: React.TouchEvent) => {
      if (disabled) return;
      childTouchStart.current = e.touches[0].clientX;
      childIsSwiping.current = false;
      childCurrentId.current = enfant.id;
    };
    const onMove = (e: React.TouchEvent) => {
      if (disabled || childCurrentId.current !== enfant.id) return;
      const dx = e.touches[0].clientX - childTouchStart.current;
      if (!childIsSwiping.current) {
        if (Math.abs(dx) > 8) childIsSwiping.current = true;
        else return;
      }
      e.preventDefault();
      const refMap = childSwipesRef.current;
      const current = refMap[enfant.id] || 0;
      let next: number;
      if (current < 0) {
        next = Math.max(-SWIPE_MAX, Math.min(0, current + dx * 0.4));
      } else if (dx < 0) {
        next = Math.max(dx, -SWIPE_MAX);
      } else {
        next = current;
      }
      childSwipesRef.current = { ...refMap, [enfant.id]: next };
      setChildSwipes(prev => ({ ...prev, [enfant.id]: next }));
      childTouchStart.current = e.touches[0].clientX;
    };
    const onEnd = () => {
      if (!childIsSwiping.current) return;
      childIsSwiping.current = false;
      const current = childSwipesRef.current[enfant.id] || 0;
      const refMap = childSwipesRef.current;
      if (current < -SWIPE_THRESHOLD) {
        childSwipesRef.current = { ...refMap, [enfant.id]: -SWIPE_REVEAL };
        setChildSwipes(prev => ({ ...prev, [enfant.id]: -SWIPE_REVEAL }));
      } else {
        childSwipesRef.current = { ...refMap, [enfant.id]: 0 };
        setChildNoAnim(true);
        setChildSwipes(prev => ({ ...prev, [enfant.id]: 0 }));
        setTimeout(() => setChildNoAnim(false), 50);
      }
    };

    return (
      <div key={enfant.id} className="py-1.5 border-b border-gray-100 last:border-b-0">
        <div
          ref={(el) => {
            if (el) enfantScrollRefs.current.set(enfant.id, el);
            else enfantScrollRefs.current.delete(enfant.id);
          }}
          onTouchStart={() => { setActiveEnfantId(enfant.id); onActivate?.(); }}
          className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 scrollbar-subtle scrollbar-hide-idle"
        >
          <div className="flex items-center gap-2 min-w-[620px] md:min-w-0 pl-3">
            <div className="w-[200px] shrink-0">
              <MaterialCell
                value={enfant.nom}
                onChange={(nom) => handleEnfantChange(index, { nom })}
                onCatalogSelect={(preset, entry) => handleEnfantCatalog(index, preset, entry)}
                onClear={() => handleEnfantChange(index, { nom: "" })}
                disabled={disabled}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-gray-300">×</span>
                <input type="number" inputMode="decimal" min={1}
                  value={enfant.quantite ?? 1}
                  onChange={(e) => handleEnfantNum(enfant, index, "quantite", e.target.value)}
                  disabled={disabled}
                  className={`${cellInput} w-[44px] text-center tabular-nums text-xs`} />
              </div>
              <div className="flex items-center gap-0.5">
                <span className="text-[10px] text-gray-300 w-2">L</span>
                <input type="number" inputMode="decimal" min={0} step={0.1}
                  value={enfant.largeur ?? ""}
                  onChange={(e) => handleEnfantNum(enfant, index, "largeur", e.target.value)}
                  disabled={disabled}
                  className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
              </div>
              {showHauteur(section) ? (
                <div className="flex items-center gap-0.5">
                  <span className="text-[10px] text-gray-300 w-2">H</span>
                  <input type="number" inputMode="decimal" min={0} step={0.1}
                    value={enfant.hauteur ?? ""}
                    onChange={(e) => handleEnfantNum(enfant, index, "hauteur", e.target.value)}
                    disabled={disabled}
                    className={`${cellInput} w-[52px] text-center tabular-nums text-xs`} />
                </div>
              ) : (
                <span className="text-gray-300 text-xs w-[52px] text-center">—</span>
              )}
              <input list={`unite-enf-${enfant.id}`} value={enfant.unite || "plaque"}
                onChange={(e) => handleEnfantChange(index, { unite: e.target.value })}
                disabled={disabled}
                className={`${cellInput} w-[72px] text-xs`} placeholder="unité" />
              <datalist id={`unite-enf-${enfant.id}`}>
                {withCurrent(UNITES, enfant.unite).map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {showEpaisseur(section) ? (
                <select value={enfant.epaisseur || ""}
                  onChange={(e) => handleEnfantChange(index, { epaisseur: e.target.value })}
                  disabled={disabled}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[110px]">
                  <option value="">Épaisseur</option>
                  {withCurrent(EPAISSEURS, enfant.epaisseur).map((ep) => <option key={ep} value={ep}>{ep}</option>)}
                </select>
              ) : (
                <span className="text-gray-300 text-sm w-[110px] text-center">—</span>
              )}
              {showCouleur(section, enfant) ? (
                <select value={enfant.couleur || ""}
                  onChange={(e) => handleEnfantChange(index, { couleur: e.target.value })}
                  disabled={disabled}
                  className="h-9 rounded-md border border-gray-200 bg-white px-2 text-sm focus:ring-2 focus:ring-indigo-500 w-[130px]">
                  <option value="">Couleur</option>
                  {withCurrent(
                    enfant.couleurs_dispo?.length ? enfant.couleurs_dispo : COULEURS,
                    enfant.couleur,
                  ).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : null}
              {!disabled && onDissocierEnfant && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onDissocierEnfant(index); }}
                  className="text-amber-500 hover:text-amber-700 p-1 transition-colors shrink-0"
                  title="Dissocier cette plaque du groupe">
                  ✂
                </button>
              )}
              {!disabled && onDeleteEnfant && (
                <button type="button" onClick={() => onDeleteEnfant(index)}
                  className="text-red-400 hover:text-red-600 p-1 transition-colors shrink-0"
                  title="Supprimer cette plaque">
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </div>
          </div>
        </div>
    );
  };

  const checkOpacity = swipeX < 0
    ? Math.min(1, Math.abs(swipeX) / SWIPE_REVEAL)
    : 0;

  return (
    <div
      ref={rowRef}
      data-highlight-key={enseigneId ? `${enseigneId}-${section}-${row.index}` : undefined}
      className={`relative overflow-hidden ${
        flashType ? `flash-${flashType}` : ""
      } ${
        selected ? "ring-2 ring-indigo-400 bg-indigo-50/60 rounded-lg" : ""
      } ${
        isGroup ? "bg-indigo-50/30 rounded-lg" : ""
      }`}
    >
      {/* Carte — contenu scrollable horizontalement */}
      <div
        ref={scrollRef}
        onTouchStart={() => onActivate?.()}
        onFocusCapture={() => onActivate?.()}
        onClick={handleRowClick}
        className={`overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0 py-2 border-b border-gray-100 last:border-b-0 scrollbar-subtle scrollbar-hide-idle ${
          selected ? "border-l-2 border-l-indigo-500" : ""
        } ${
          selectionMode && selectable ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-[620px] md:min-w-0">
          {/* 🆕 Checkbox gauche — visible en selectionMode */}
          {selectionMode && selectable && (
            <button
              type="button"
              data-no-select="true"
              onClick={handleCheckClick}
              className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected
                  ? "bg-indigo-500 border-indigo-500 text-white"
                  : "border-gray-300 bg-white hover:border-indigo-300"
              }`}
            >
              {selected && <Check size={12} />}
            </button>
          )}

          {/* Badge sélection (gauche) — affiché seulement si NON selectionMode */}
          {selected && !selectionMode && (
            <div className="shrink-0 w-5 h-5 rounded bg-indigo-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>
          )}

          {/* Badge groupe — F + nb plaques, cliquable pour l'aperçu */}
          {isGroup && (
            <button
              type="button"
              data-no-select="true"
              onClick={() => onOpenPreview?.()}
              className="shrink-0 flex items-center gap-0.5 px-1 py-0 rounded text-[10px] font-bold text-indigo-600 bg-indigo-100 hover:bg-indigo-200 transition-colors"
              title="Voir l'aperçu de la feuille"
            >
              <Eye size={10} />
              <span>F {enfantCount}</span>
            </button>
          )}

          {/* Colonne 1 : Matériau + toggle (superposé) */}
          <div className={`w-[200px] shrink-0 relative ${isGroup ? "[&_input]:pl-5" : ""}`} data-no-select="true">
            {isGroup && (
              <button
                type="button"
                data-no-select="true"
                onClick={() => setExpanded(!expanded)}
                className="absolute left-0.5 top-1/2 -translate-y-1/2 z-10 text-gray-400 hover:text-gray-600 p-0 transition-colors"
                title={expanded ? "Replier les plaques" : "Déplier les plaques"}
              >
                <ChevronRight size={14} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
              </button>
            )}
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
          </div>

          {/* Colonne 2 : Paramètres */}
          <div className="flex items-center gap-1.5 shrink-0" data-no-select="true">
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
          <div className="flex items-center gap-2 shrink-0" data-no-select="true">
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

      {/* 🆕 Overlay visuel (ne capture pas les clics) */}
      {(swipeX !== 0 || Object.values(childSwipes).some(v => v !== 0)) && (
        <div
          className="fixed inset-0 z-40 bg-black/5 pointer-events-none"
        />
      )}

      {/* 🆕 Fermer les swipes au clic extérieur (document-level) */}
      {(swipeX !== 0 || Object.values(childSwipes).some(v => v !== 0)) && (
        <ClickOutsideCloser
          rowRef={rowRef}
          onClose={() => {
            setNoAnim(true); setSwipeX(0);
            setChildNoAnim(true); setChildSwipes({});
            setTimeout(() => setChildNoAnim(false), 50);
          }}
        />
      )}

      {/* 🆕 Enfants du groupe — layout identique aux lignes normales, indentation réduite */}
      {isGroup && expanded && (
        <div className="ml-3 pl-1 border-l border-indigo-200 bg-indigo-50/10 rounded-r-lg">
          {/* Enfants */}
          {(item.groupe_enfants || []).map((enfant, i) => renderEnfantRow(enfant, i))}

          {/* + Ajouter une plaque */}
          {!disabled && onAddEnfant && (
            <button
              type="button"
              onClick={onAddEnfant}
              className="flex items-center gap-1 mt-1 mb-1 text-xs text-blue-400 hover:text-blue-600 font-medium transition-colors py-1 px-2"
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
