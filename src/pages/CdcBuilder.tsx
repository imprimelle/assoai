// src/pages/CdcBuilder.tsx
// Page d'assemblage du CDC Builder — accordéons d'enseignes + tableaux matériaux + footer Brico.
// v2: accordéons collapsibles (comme EnseigneSection) au lieu d'onglets slidables.
// Chaque enseigne est visible avec son propre CdcBuilderTable.

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  Trash2,
  Plus,
  Pencil,
  Image as ImageIcon,
  LayoutGrid,
  Download,
  Upload,
  X,
  ArrowLeft,
  Eye,
  Save,
  Check,
  AlertCircle,
  Loader2,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { ClipboardCheck, ShoppingCart, Hammer, Wrench, CheckCircle } from "lucide-react";
import EnseigneDialog from "@/components/cdc-builder/EnseigneDialog";
import CdcBuilderTable, {
  sectionsToRows,
} from "@/components/cdc-builder/CdcBuilderTable";
import CdcBuilderFooter from "@/components/cdc-builder/CdcBuilderFooter";
import CdcBuilderHeader from "@/components/cdc-builder/CdcBuilderHeader";
import SheetPreview from "@/components/cdc-builder/SheetPreview";
import { shelfPack, packStats } from "@/lib/shelfPacker";
import {
  createEmptyEnseigne,
  type CdcBuilderState,
  type CdcBuilderEnseigne,
  type HighlightMap,
  type FeuillePlacement,
} from "@/types/cdcBuilder";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { User } from "@/types/user";
import { useCdcBuilderLoader } from "@/hooks/useCdcBuilderLoader";
import type { ProjectOption as HeaderProjectOption } from "@/components/cdc-builder/CdcBuilderHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CdcBuilderProps {
  user: User;
  persistentSessionId: string;
}

// ── Section enseigne individuelle (accordéon) ──

interface EnseigneAccordionProps {
  enseigne: CdcBuilderEnseigne;
  rows: FlatMaterialRow[];
  defaultOpen?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  canDelete?: boolean;
  onRowsChange: (rows: FlatMaterialRow[]) => void;
  onUpdateEnseigne: (changes: Partial<CdcBuilderEnseigne>) => void;
  highlights?: HighlightMap;
  /** 🆕 Handler direct de dissociation (bypass FlatMaterialRow) */
  onDissocierEnfant?: (section: string, groupItemId: string, enfantIndex: number) => void;
  /** 🆕 Régénérer les matériaux de cette enseigne via Brico */
  onRegenerate?: () => void;
  /** 🆕 Ouvrir l'aperçu feuille au niveau page */
  onOpenPreview?: (section: string, groupIndex: number) => void;
}

const SWIPE_CARD_REVEAL = 140; // largeur pour 3 boutons
const SWIPE_CARD_THRESHOLD = 60;

const EnseigneAccordion: React.FC<EnseigneAccordionProps> = ({
  enseigne,
  rows,
  defaultOpen = false,
  onEdit,
  onDelete,
  canDelete = true,
  onRowsChange,
  onUpdateEnseigne,
  highlights,
  onDissocierEnfant,
  onRegenerate,
  onOpenPreview,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // 🆕 Swipe card state
  const [cardSwipeX, setCardSwipeX] = useState(0);
  const cardSwipeRef = useRef(0);
  const [cardNoAnim, setCardNoAnim] = useState(false);
  const cardTouchStart = useRef(0);
  const cardIsSwiping = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Synchroniser avec le toggle global "Tout replier/déplier"
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  // 🆕 Reset animation après snap fermé
  useEffect(() => {
    if (cardNoAnim && cardSwipeX === 0) {
      const t = setTimeout(() => setCardNoAnim(false), 50);
      return () => clearTimeout(t);
    }
  }, [cardNoAnim, cardSwipeX]);

  // 🆕 Fermer le swipe au clic extérieur
  useEffect(() => {
    if (cardSwipeX === 0) return;
    const handler = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      cardSwipeRef.current = 0;
      setCardNoAnim(true);
      setCardSwipeX(0);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [cardSwipeX]);

  const handleCardTouchStart = (e: React.TouchEvent) => {
    // Swipe désactivé quand l'accordéon est ouvert
    if (isOpen) return;
    // Ignorer les touches sur des boutons (image, toggle, actions)
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    cardTouchStart.current = e.touches[0].clientX;
    cardIsSwiping.current = false;
  };
  const handleCardTouchMove = (e: React.TouchEvent) => {
    if (isOpen) return;
    const dx = e.touches[0].clientX - cardTouchStart.current;
    if (!cardIsSwiping.current) {
      if (Math.abs(dx) > 8) cardIsSwiping.current = true;
      else return;
    }
    e.preventDefault();
    const current = cardSwipeRef.current;
    let next: number;
    if (current < 0) {
      next = Math.max(-SWIPE_CARD_REVEAL - 20, Math.min(0, current + dx * 0.4));
    } else if (dx < 0) {
      next = Math.max(dx, -SWIPE_CARD_REVEAL - 20);
    } else {
      next = current;
    }
    cardSwipeRef.current = next;
    setCardSwipeX(next);
    cardTouchStart.current = e.touches[0].clientX;
  };
  const handleCardTouchEnd = () => {
    if (!cardIsSwiping.current) return;
    cardIsSwiping.current = false;
    const current = cardSwipeRef.current;
    if (current < -SWIPE_CARD_THRESHOLD) {
      cardSwipeRef.current = -SWIPE_CARD_REVEAL;
      setCardSwipeX(-SWIPE_CARD_REVEAL);
    } else {
      cardSwipeRef.current = 0;
      setCardNoAnim(true);
      setCardSwipeX(0);
    }
  };

  const handleDownloadImage = () => {
    if (!enseigne.image_url) return;
    const a = document.createElement("a");
    a.href = enseigne.image_url;
    a.download = `${enseigne.nom.replace(/\\s+/g, "_")}.jpg`;
    a.click();
  };

  return (
    <div
      ref={cardRef}
      data-enseigne-accordion="true"
      onTouchStart={handleCardTouchStart}
      onTouchMove={handleCardTouchMove}
      onTouchEnd={handleCardTouchEnd}
      className="border border-gray-200 rounded-lg bg-gray-50 mb-4 overflow-hidden shadow-sm relative"
    >
      {/* 🆕 Fond des boutons swipe — révélé à droite */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center gap-0.5 bg-gray-100 rounded-r-lg z-40 ${
          cardSwipeX < 0 ? "pointer-events-auto" : "pointer-events-none"
        }`}
        style={{
          width: SWIPE_CARD_REVEAL,
          opacity: cardSwipeX < 0 ? Math.min(1, Math.abs(cardSwipeX) / SWIPE_CARD_REVEAL) : 0,
          transition: "opacity 0.15s",
        }}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRegenerate?.(); }}
          className="flex flex-col items-center justify-center w-[44px] h-full text-emerald-600 hover:bg-emerald-50 transition-colors"
          title="Régénérer les matériaux"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="flex flex-col items-center justify-center w-[44px] h-full text-indigo-500 hover:bg-indigo-50 transition-colors"
          title="Éditer cette enseigne"
        >
          <Pencil size={16} />
        </button>
        {canDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="flex flex-col items-center justify-center w-[44px] h-full text-red-500 hover:bg-red-50 transition-colors"
          title="Supprimer cette enseigne"
        >
          <Trash2 size={16} />
        </button>
        )}
      </div>

      {/* Carte swipeable */}
      <div
        style={{ transform: `translateX(${cardSwipeX}px)` }}
        className={`${!cardNoAnim ? 'transition-transform duration-200' : ''} bg-gray-50`}
      >
      {/* Header cliquable */}
      <button
        type="button"
        data-toggle-accordion="true"
        onClick={() => setIsOpen((p) => !p)}
        className="flex justify-between items-center w-full p-4 text-left
                   bg-gradient-to-r from-indigo-50 to-indigo-100
                   hover:from-indigo-100 hover:to-indigo-150 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Miniature de l'enseigne */}
          {enseigne.image_url ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setImageModalOpen(true);
              }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setImageModalOpen(true); } }}
              className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                         hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
              title="Voir l'image"
            >
              <img
                src={enseigne.image_url}
                alt={enseigne.nom}
                className="w-full h-full object-cover"
              />
            </span>
          ) : (
            <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 border border-gray-200
                            flex items-center justify-center">
              <ImageIcon size={16} className="text-gray-400" />
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-800 truncate">
                {enseigne.nom}
              </h3>
              {enseigne.quantite > 1 && (
                <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[11px] font-semibold">
                  ×{enseigne.quantite}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {enseigne.dimensions.largeur}×{enseigne.dimensions.hauteur}
              {enseigne.dimensions.profondeur ? `×${enseigne.dimensions.profondeur}` : ""} cm
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {rows.length} matériau{rows.length > 1 ? "x" : ""}
            </p>
          </div>
        </div>

        {/* 🆕 Chevron simple (plus de boutons visibles) */}
        <ChevronDown
          size={18}
          className={`text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Contenu dépliable */}
      {isOpen && (
        <div data-accordion-content="true" className="p-4 pt-3">
          {/* Tableau matériaux */}
          <CdcBuilderTable
            rows={rows}
            defaultDimensions={enseigne.dimensions}
            onRowsChange={onRowsChange}
            enseigneNom={enseigne.nom}
            highlights={highlights}
            enseigneId={enseigne.id}
            onDissocierEnfant={onDissocierEnfant}
            onOpenPreview={onOpenPreview}
          />
        </div>
      )}
      </div>{/* fin swipeable */}
      {/* Modal image — en dehors du div swipeable (transform) pour que fixed fonctionne sur le viewport */}
      {imageModalOpen && enseigne.image_url && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4"
          onClick={() => setImageModalOpen(false)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Barre d'actions */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <span className="text-sm font-medium text-gray-700 truncate max-w-[60%]">
                {enseigne.nom}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Télécharger"
                >
                  <Download size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageModalOpen(false);
                    onEdit();
                  }}
                  className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                  title="Changer l'image"
                >
                  <Upload size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateEnseigne({ image_url: "" } as Partial<CdcBuilderEnseigne>);
                    setImageModalOpen(false);
                  }}
                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer l'image"
                >
                  <Trash2 size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setImageModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-2"
                  title="Fermer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            {/* Image */}
            <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-gray-900/5">
              <img
                src={enseigne.image_url}
                alt={enseigne.nom}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Page principale ──

const ENSEIGNE_COLORS = [
  "#4F46E5", // indigo
  "#0891B2", // cyan
  "#059669", // emerald
  "#D97706", // amber
  "#DC2626", // red
  "#7C3AED", // violet
  "#DB2777", // pink
  "#2563EB", // blue
];

const LS_KEY = "assoai-cdc-builder-state";

/** Transforme CdcBuilderState → CahierDesChargesData pour persistance Supabase */
function buildCdcPayload(state: CdcBuilderState) {
  return {
    titre: `Cahier des Charges — ${state.projectName || "Sans titre"}`,
    cdcNumero: state.cdcNumero,
    commande_id: state.commandeId,
    statut: state.statut || "Brouillon",
    enseignes: state.enseignes.map((ens) => ({
      id: ens.id,
      nom: ens.nom,
      quantite: ens.quantite,
      produits: ens.produits,
      details: {
        image_url: ens.image_url,
        dimensions: ens.dimensions,
        technique: ens.technique,
      },
      materiauxSections: state.materiauxByEnseigne[ens.id] || {},
    })),
    equipe: state.equipe,
    deliveryAddress: state.deliveryAddress,
    version: 1,
    is_latest: true,
  };
}

/** Génère un nouveau numéro CDC via le RPC Supabase */
async function fetchCdcNumero(): Promise<string> {
  try {
    const { data, error } = await supabase.rpc('next_document_number', { p_doc_type: 'cahier_des_charges' });
    if (error) throw error;
    return String(data);
  } catch {
    // Fallback si RPC indisponible
    const year = new Date().getFullYear();
    return `CDC-${year}-TMP`;
  }
}

const CdcBuilder: React.FC<CdcBuilderProps> = ({
  user,
  persistentSessionId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("projectId");
  const cdcId = searchParams.get("cdcId");

  // Charger les données initiales si un projet ou un CDC est spécifié
  const { data: loaderResult, isLoading: isLoaderLoading } =
    useCdcBuilderLoader({ projectId, cdcId });

  // Liste des projets disponibles pour le sélecteur
  const { data: availableProjects, isLoading: projectsLoading } = useQuery<
    HeaderProjectOption[]
  >({
    queryKey: ["cdcBuilderProjects"],
    queryFn: async () => {
      const { data: projects, error } = await supabase
        .from("projects")
        .select("id, name, phase, status")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error || !projects) return [];

      // Pour chaque projet, vérifier s'il a une commande validée et/ou un CDC
      const enriched: HeaderProjectOption[] = [];
      for (const p of projects) {
        const { data: msgs } = await supabase
          .from("messages")
          .select("template_type, template_data")
          .eq("project_id", p.id)
          .not("template_data", "is", null);

        const commandeMsg = msgs?.find(
          (m: any) =>
            m.template_type === "commande" &&
            ["Validée", "Confirmée", "En cours"].includes(
              m.template_data?.data?.statut,
            ),
        );
        const cdcMsg = msgs?.find(
          (m: any) => m.template_type === "cahier_des_charges",
        );

        enriched.push({
          id: p.id,
          name: p.name,
          hasCommande: !!commandeMsg,
          hasCdc: !!cdcMsg,
          commandeId: commandeMsg?.template_data?.data?.commandeNumero || undefined,
          cdcNumero: cdcMsg?.template_data?.data?.cdcNumero || undefined,
          phase: (p as any).phase || undefined,
          status: (p as any).status || undefined,
        });
      }

      return enriched;
    },
    staleTime: 30_000,
  });

  // État initial par défaut — vide, sans enseigne
  const [state, setState] = useState<CdcBuilderState>({
    projectName: "",
    cdcNumero: "", // sera rempli par le RPC au mount
    commandeId: "",
    statut: "Brouillon",
    enseignes: [],
    materiauxByEnseigne: {},
    equipe: [],
  });

  // Appliquer les données chargées du loader quand elles arrivent
  useEffect(() => {
    if (loaderResult?.initialState) {
      const migrated = migrateGroupDimensionsToCm(loaderResult.initialState);
      setState(migrated);
      // 🆕 Reset compteur après chargement initial
      const { savedMessageId, ...trackable } = migrated as any;
      lastSavedHashRef.current = JSON.stringify(trackable);
      setChangeCount(0);
      // 🆕 Reset historique undo
      historyRef.current = [JSON.parse(JSON.stringify(migrated))];
      historyIndexRef.current = 0;
      lastCapturedRef.current = JSON.stringify(migrated);
    }
  }, [loaderResult?.initialState]);

  // 🆕 Migration groupes m→cm pour les CDC existants
  const migrateGroupDimensionsToCm = (st: CdcBuilderState): CdcBuilderState => {
    let migrated = false;
    const newMateriaux: Record<string, Record<string, MaterialItem[]>> = {};
    for (const [ensId, sections] of Object.entries(st.materiauxByEnseigne)) {
      newMateriaux[ensId] = {};
      for (const [section, items] of Object.entries(sections)) {
        newMateriaux[ensId][section] = items.map((item) => {
          if (!item.groupe_enfants?.length) return item;
          // Détection: si groupe_largeur < 100 et > 0 → en mètres → convertir
          const gl = item.groupe_largeur ?? 0;
          const gh = item.groupe_hauteur ?? 0;
          if ((gl > 0 && gl < 100) || (gh > 0 && gh < 100)) {
            migrated = true;
            console.log(`[migration cm] ${item.nom}: ${gl}×${gh}m → ${gl*100}×${gh*100}cm`);
            return {
              ...item,
              largeur: (item.largeur ?? 0) * 100,
              hauteur: (item.hauteur ?? 0) * 100,
              groupe_largeur: gl * 100,
              groupe_hauteur: gh * 100,
              groupe_enfants: item.groupe_enfants.map((e) => ({
                ...e,
                largeur: (e.largeur ?? 0) * 100,
                hauteur: (e.hauteur ?? 0) * 100,
              })),
            };
          }
          return item;
        });
      }
    }
    if (migrated) {
      return { ...st, materiauxByEnseigne: newMateriaux };
    }
    return st;
  };

  // 🆕 Récupérer le numéro CDC via le RPC (comme tous les documents)
  useEffect(() => {
    if (!state.cdcNumero && !loaderResult?.initialState) {
      fetchCdcNumero().then(num => setState(prev => ({ ...prev, cdcNumero: num })));
    }
  }, [state.cdcNumero, loaderResult?.initialState]);

  // Sélection de projet → naviguer avec le paramètre
  const handleSelectProject = useCallback(
    (newProjectId: string) => {
      setSearchParams({ projectId: newProjectId });
    },
    [setSearchParams],
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnseigne, setEditingEnseigne] = useState<
    CdcBuilderEnseigne | undefined
  >();
  // Tous les accordéons repliés par défaut
  const [allOpen, setAllOpen] = useState(false);
  // Vue consolidée (toutes enseignes groupées par section)
  const [showConsolidated, setShowConsolidated] = useState(false);
  // Highlights temporaires après action Brico (flash animation)
  const [highlights, setHighlights] = useState<HighlightMap>({});
  // Ref pour éviter de clear pendant l'application séquentielle
  const highlightsTimestampRef = useRef(0);

  // 🆕 Régénération enseigne — déclenche un envoi auto dans le footer Brico
  const [regenerateEnseigneId, setRegenerateEnseigneId] = useState<string | null>(null);
  const [regenerateMessage, setRegenerateMessage] = useState<string>("");

  // 🆕 Dialogue de confirmation pour la régénération
  const [regenerateDialogOpen, setRegenerateDialogOpen] = useState(false);
  const [regenerateTarget, setRegenerateTarget] = useState<CdcBuilderEnseigne | null>(null);
  const [regenerateInput, setRegenerateInput] = useState("");

  // 🆕 Aperçu feuille au niveau page — { enseigneId, section, groupIndex }
  const [previewState, setPreviewState] = useState<{
    enseigneId: string;
    section: string;
    groupIndex: number;
  } | null>(null);

  // 🆕 Recalculer le placement 2D — opère directement sur le state de la page
  const handleRepackPageLevel = useCallback(() => {
    if (!previewState) return;
    const { enseigneId, section, groupIndex } = previewState;

    const sections = state.materiauxByEnseigne[enseigneId];
    if (!sections) return;
    const items = sections[section];
    if (!items || groupIndex >= items.length) return;

    const groupItem = items[groupIndex];
    if (!groupItem.groupe_enfants) return;

    const feuilleL = groupItem.groupe_largeur || groupItem.largeur || 0;
    const feuilleH = groupItem.groupe_hauteur || groupItem.hauteur || 0;
    if (feuilleL <= 0 || feuilleH <= 0) return;

    const plaques = (groupItem.groupe_enfants || []).filter((e) => e.nom !== "Chute");
    if (plaques.length === 0) return;

    try {
      const plaquesInput = plaques.map((e) => ({
        id: e.id,
        largeur: (e.largeur || 0) / 100,
        hauteur: (e.hauteur || 0) / 100,
        nom: e.nom || "Sans nom",
        quantite: e.quantite || 1,
      }));

      const packResult = shelfPack(plaquesInput, feuilleL / 100, feuilleH / 100, true);
      const stats = packStats(packResult, feuilleL / 100, feuilleH / 100);

      const groupePlacements: FeuillePlacement[] = packResult.sheets.map((sheet, i) => ({
        feuille_index: i,
        placements: sheet.placements,
        chutes: sheet.chutes,
      }));

      const newItems = [...items];
      newItems[groupIndex] = {
        ...groupItem,
        quantite: stats.nbFeuilles || 1,
        groupe_nb_feuilles_requis: stats.nbFeuilles || 1,
        groupe_placements: groupePlacements,
      };

      const newSections = { ...sections, [section]: newItems };
      setState({
        ...state,
        materiauxByEnseigne: {
          ...state.materiauxByEnseigne,
          [enseigneId]: newSections,
        },
      });
    } catch (err) {
      console.error("[handleRepackPageLevel] Erreur:", err);
    }
  }, [previewState, state]);

  // 🆕 Recalcul automatique à l'ouverture de l'aperçu
  const autoRepackRef = useRef(false);
  useEffect(() => {
    if (!previewState) { autoRepackRef.current = false; return; }
    if (autoRepackRef.current) return;
    const { enseigneId, section, groupIndex } = previewState;
    const groupItem = state.materiauxByEnseigne[enseigneId]?.[section]?.[groupIndex];
    if (!groupItem?.groupe_enfants?.length) return;
    if (!groupItem.groupe_placements || groupItem.groupe_placements.length === 0) {
      autoRepackRef.current = true;
      const t = setTimeout(() => {
        handleRepackPageLevel();
        autoRepackRef.current = false;
      }, 50);
      return () => clearTimeout(t);
    }
  }, [previewState, state.materiauxByEnseigne, handleRepackPageLevel]);

  // 🆕 Undo/Redo — historique d'états (max 20 snapshots)
  const MAX_HISTORY = 20;
  const historyRef = useRef<CdcBuilderState[]>([]);
  const historyIndexRef = useRef(-1);
  const isUndoRedoRef = useRef(false); // évite de ré-enregistrer pendant undo/redo

  /** Pousse l'état courant dans l'historique (avant modification) */
  const pushHistory = useCallback((currentState: CdcBuilderState) => {
    if (isUndoRedoRef.current) return;
    // Ignorer si identique au dernier snapshot
    const last = historyRef.current[historyIndexRef.current];
    if (last && JSON.stringify(last) === JSON.stringify(currentState)) return;

    // Tronquer le futur (si on a fait undo puis nouvelle modif)
    const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHistory.push(JSON.parse(JSON.stringify(currentState))); // deep clone
    // Garder max MAX_HISTORY entrées
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    historyRef.current = newHistory;
    historyIndexRef.current = newHistory.length - 1;
  }, []);

  // Enregistrer l'état initial dans l'historique au premier chargement
  useEffect(() => {
    if (state.enseignes.length > 0 && historyRef.current.length === 0) {
      historyRef.current = [JSON.parse(JSON.stringify(state))];
      historyIndexRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaderResult?.initialState]);

  // 🆕 Raccourcis clavier Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignorer si focus dans un input/textarea/contenteditable (sauf footer chat)
      const tag = (e.target as HTMLElement).tagName;
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || isEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          // Redo : Ctrl+Shift+Z
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            isUndoRedoRef.current = true;
            setState(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
            setTimeout(() => { isUndoRedoRef.current = false; }, 100);
          }
        } else {
          // Undo : Ctrl+Z
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            isUndoRedoRef.current = true;
            setState(JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current])));
            setTimeout(() => { isUndoRedoRef.current = false; }, 100);
          }
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /** 🆕 Capture automatique dans l'historique — debounce 800ms */
  const lastCapturedRef = useRef("");
  useEffect(() => {
    if (isUndoRedoRef.current) return;
    const serialized = JSON.stringify(state);
    if (serialized === lastCapturedRef.current) return;

    const timer = setTimeout(() => {
      if (isUndoRedoRef.current) return;
      const current = JSON.stringify(state);
      if (current === lastCapturedRef.current) return;
      pushHistory(state);
      lastCapturedRef.current = current;
    }, 800);
    return () => clearTimeout(timer);
  }, [state, pushHistory]);

  // Mettre à jour le timestamp quand les highlights changent
  useEffect(() => {
    if (Object.keys(highlights).length > 0) {
      highlightsTimestampRef.current = Date.now();
    }
  }, [highlights]);

  // Clear les highlights quand l'utilisateur interagit avec un champ
  useEffect(() => {
    if (Object.keys(highlights).length === 0) return;

    const handleInteraction = (e: MouseEvent) => {
      // Ne pas clear pendant l'application séquentielle (600ms de buffer)
      if (Date.now() - highlightsTimestampRef.current < 600) return;

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        setHighlights({});
      }
    };

    document.addEventListener("mousedown", handleInteraction, true);
    return () =>
      document.removeEventListener("mousedown", handleInteraction, true);
  }, [highlights]);
  // État de sauvegarde Supabase
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  // Dialogue de vérification
  const [showVerifDialog, setShowVerifDialog] = useState(false);
  const [verifNotes, setVerifNotes] = useState("");
  // Dialogue de transition (fabriquer / installer / terminer)
  const [transitionTarget, setTransitionTarget] = useState<{
    title: string;
    label: string;
    targetStatut: string;
  } | null>(null);
  const [transitionNotes, setTransitionNotes] = useState("");
  // 🆕 Compteur : nombre de modifs non sauvegardées
  const [changeCount, setChangeCount] = useState(0);
  const lastSavedHashRef = useRef("");

  // 🆕 isDirty : true si state ≠ dernier état sauvegardé
  const isDirty = useMemo(() => {
    const { savedMessageId, ...trackable } = state as any;
    return JSON.stringify(trackable) !== lastSavedHashRef.current;
  }, [state]);

  // 🆕 Compteur incrémental : incrémente à chaque modif non sauvegardée
  useEffect(() => {
    if (isDirty) {
      setChangeCount((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Persistance localStorage (debounce 500ms) ──
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(state));
      } catch {
        // localStorage plein → ignorer silencieusement
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state]);

  // Restauration depuis localStorage au mount (si pas de loader result)
  useEffect(() => {
    if (loaderResult?.initialState) return; // Le loader a priorité

    // 🔴 Nouveau CDC (ni projectId ni cdcId) → restaurer depuis localStorage si existant
    if (!projectId && !cdcId) {
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as CdcBuilderState;
          if (parsed.enseignes?.length) {
            parsed.enseignes = parsed.enseignes.map((ens: any) => ({
              ...ens,
              quantite: ens.quantite || 1,
            }));
            // 🆕 Migration dimensions groupe m→cm
            const migrated = migrateGroupDimensionsToCm(parsed);
            setState(migrated);
            const { savedMessageId, ...trackable } = migrated as any;
            lastSavedHashRef.current = JSON.stringify(trackable);
            setChangeCount(0);
            return; // ✅ Restauré → ne pas supprimer
          }
        }
        // Pas de saved state → vraiment nouveau CDC, nettoyer
        localStorage.removeItem(LS_KEY);
        // ⚠️ Ne PAS supprimer assoai-cdc-draft-id — préserver l'identité chat entre rechargements
      } catch {}
      return;
    }

    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CdcBuilderState;
        if (parsed.enseignes?.length) {
          // 🆕 Migration : ajouter quantite=1 aux enseignes qui n'en ont pas
          parsed.enseignes = parsed.enseignes.map((ens: any) => ({
            ...ens,
            quantite: ens.quantite || 1,
          }));
          // 🆕 Migration dimensions groupe m→cm
          const migrated = migrateGroupDimensionsToCm(parsed);
          setState(migrated);
          // 🆕 Reset compteur après restauration localStorage
          const { savedMessageId, ...trackable } = migrated as any;
          lastSavedHashRef.current = JSON.stringify(trackable);
          setChangeCount(0);
        }
      }
    } catch {
      // Données corrompues → ignorer
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nettoyage localStorage quand le state est chargé depuis le loader
  useEffect(() => {
    if (loaderResult?.initialState) {
      try {
        localStorage.removeItem(LS_KEY);
      } catch {}
    }
  }, [loaderResult?.initialState]);

  // --- Handlers enseigne ---

  const handleAddEnseigne = useCallback(() => {
    setEditingEnseigne(undefined);
    setDialogOpen(true);
  }, []);

  const handleEditEnseigne = useCallback(
    (enseigne: CdcBuilderEnseigne) => {
      setEditingEnseigne(enseigne);
      setDialogOpen(true);
    },
    [],
  );

  const handleSaveEnseigne = useCallback(
    (enseigne: CdcBuilderEnseigne) => {
      if (editingEnseigne) {
        // Mode édition — remplacer dans le tableau
        const idx = state.enseignes.findIndex((e) => e.id === editingEnseigne.id);
        if (idx >= 0) {
          const newEnseignes = [...state.enseignes];
          newEnseignes[idx] = enseigne;
          setState({ ...state, enseignes: newEnseignes });
        }
      } else {
        // Mode création
        setState({
          ...state,
          enseignes: [...state.enseignes, enseigne],
          materiauxByEnseigne: {
            ...state.materiauxByEnseigne,
            [enseigne.id]: {},
          },
        });
      }
      setDialogOpen(false);
    },
    [editingEnseigne, state],
  );

  const handleDeleteEnseigne = useCallback(
    (enseigne: CdcBuilderEnseigne) => {
      if (state.enseignes.length <= 1) return;
      const newEnseignes = state.enseignes.filter((e) => e.id !== enseigne.id);
      const newMateriaux = { ...state.materiauxByEnseigne };
      delete newMateriaux[enseigne.id];
      setState({
        ...state,
        enseignes: newEnseignes,
        materiauxByEnseigne: newMateriaux,
      });
    },
    [state],
  );

  const handleUpdateEnseigne = useCallback(
    (enseigneId: string, changes: Partial<CdcBuilderEnseigne>) => {
      const newEnseignes = state.enseignes.map((e) =>
        e.id === enseigneId ? { ...e, ...changes } : e,
      );
      setState({ ...state, enseignes: newEnseignes });
    },
    [state],
  );

  // --- Handlers matériaux ---

  const handleRowsChange = useCallback(
    (enseigneId: string, newRows: FlatMaterialRow[]) => {
      const newSections: Record<string, MaterialItem[]> = {};
      for (const row of newRows) {
        if (!newSections[row.section]) newSections[row.section] = [];
        newSections[row.section].push(row.item);
      }
      setState({
        ...state,
        materiauxByEnseigne: {
          ...state.materiauxByEnseigne,
          [enseigneId]: newSections,
        },
      });
    },
    [state],
  );

  // 🆕 Dissociation directe — travaille sur materiauxByEnseigne, pas sur FlatMaterialRow[]
  const handleDissocierDirect = useCallback(
    (enseigneId: string, section: string, groupItemId: string, enfantIndex: number) => {
      setState((prev) => {
        const enseigneSections = prev.materiauxByEnseigne[enseigneId] || {};
        const sectionItems = [...(enseigneSections[section] || [])];

        // Trouver le groupe
        const groupIdx = sectionItems.findIndex((item) => item.id === groupItemId);
        if (groupIdx === -1) return prev;

        const groupItem = sectionItems[groupIdx];
        const enfants = groupItem.groupe_enfants || [];
        if (enfantIndex < 0 || enfantIndex >= enfants.length) return prev;

        const enfant = { ...enfants[enfantIndex], id: crypto.randomUUID?.() || `pla-${Date.now()}` };
        const newEnfants = enfants.filter((_, i) => i !== enfantIndex);

        if (newEnfants.length === 0) {
          // Plus d'enfant → supprimer le groupe, insérer l'enfant à sa place
          sectionItems.splice(groupIdx, 1, enfant);
        } else {
          // Garder le groupe avec enfants réduits
          sectionItems[groupIdx] = { ...groupItem, groupe_enfants: newEnfants };
          // Insérer l'enfant juste après le groupe
          sectionItems.splice(groupIdx + 1, 0, enfant);
        }

        return {
          ...prev,
          materiauxByEnseigne: {
            ...prev.materiauxByEnseigne,
            [enseigneId]: {
              ...enseigneSections,
              [section]: sectionItems,
            },
          },
        };
      });
    },
    [],
  );

  // --- Vue consolidée : toutes enseignes groupées par section ---
  const consolidatedData = useMemo(() => {
    const allRows: FlatMaterialRow[] = [];
    const meta: Record<string, { enseigneBadge: { nom: string; color: string } }> = {};
    const itemToEnseigneId = new Map<string, string>();

    state.enseignes.forEach((ens, ensIdx) => {
      const sections = state.materiauxByEnseigne[ens.id] || {};
      const color = ENSEIGNE_COLORS[ensIdx % ENSEIGNE_COLORS.length];
      const rows = sectionsToRows(sections);
      for (const row of rows) {
        const key = `${row.section}-${row.item.id}`;
        allRows.push(row);
        meta[key] = { enseigneBadge: { nom: ens.nom, color } };
        itemToEnseigneId.set(row.item.id, ens.id);
      }
    });

    return { rows: allRows, meta, itemToEnseigneId };
  }, [state.enseignes, state.materiauxByEnseigne]);

  // 🆕 Données du groupe pour le SheetPreview au niveau page
  const previewGroupData = useMemo(() => {
    if (!previewState) return null;
    const { enseigneId, section, groupIndex } = previewState;
    const sections = state.materiauxByEnseigne[enseigneId];
    if (!sections) return null;
    const items = sections[section];
    if (!items || groupIndex >= items.length) return null;
    const groupItem = items[groupIndex];
    if (!groupItem.groupe_enfants) return null;
    return {
      groupItem,
      feuilleL: groupItem.groupe_largeur || groupItem.largeur || 0,
      feuilleH: groupItem.groupe_hauteur || groupItem.hauteur || 0,
      nomMateriau: groupItem.nom,
      feuilles: groupItem.groupe_placements || [],
      hasPlacements: !!(groupItem.groupe_placements && groupItem.groupe_placements.length > 0),
    };
  }, [previewState, state.materiauxByEnseigne]);

  // Handler pour la vue consolidée : dispatcher les changements vers la bonne enseigne
  const handleConsolidatedChange = useCallback(
    (newRows: FlatMaterialRow[]) => {
      const prevItemToEnseigne = consolidatedData.itemToEnseigneId;
      const newMateriaux: Record<string, Record<string, MaterialItem[]>> = {};

      // Initialiser toutes les enseignes avec des sections vides
      for (const ens of state.enseignes) {
        newMateriaux[ens.id] = {};
      }

      for (const ens of state.enseignes) {
        // Filtrer les rows qui appartiennent à cette enseigne
        const ensRows = newRows.filter((r) => {
          const enseigneId = prevItemToEnseigne.get(r.item.id);
          // Si connu → garder l'enseigne. Sinon (nouvelle row) → première enseigne.
          return enseigneId ? enseigneId === ens.id : ens.id === state.enseignes[0]?.id;
        });

        if (ensRows.length > 0) {
          newMateriaux[ens.id] = rowsToSections(ensRows);
        }
      }

      setState({
        ...state,
        materiauxByEnseigne: newMateriaux,
      });
    },
    [state, consolidatedData.itemToEnseigneId],
  );

  const handleHeaderChange = useCallback(
    (changes: Partial<{
      projectName: string;
      cdcNumero: string;
      commandeId: string;
      statut: string;
      deliveryAddress: { label: string; lat: number; lng: number };
    }>) => {
      setState((prev) => ({ ...prev, ...changes }));
    },
    [],
  );

  // ── Handler vérification ──
  const handleSetVerification = useCallback(() => {
    setState((prev) => ({ ...prev, statut: "vérification" }));
    setShowVerifDialog(false);
    setVerifNotes("");
  }, []);

  // ── Handler transition générique (fabriquer / installer / terminer) ──
  const handleTransition = useCallback(() => {
    if (!transitionTarget) return;
    setState((prev) => ({ ...prev, statut: transitionTarget.targetStatut }));
    setTransitionTarget(null);
    setTransitionNotes("");
  }, [transitionTarget]);

  // ── Sauvegarde vers Supabase ──
  const handleSaveCdc = useCallback(async () => {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveError("");

    const payload = buildCdcPayload(state);
    const templateData = { data: payload, version: (state as any)._version || 1 };

    try {
      // 🆕 project_id depuis le loader (source de vérité) — peut être null (CDC sans projet)
      const projectId = loaderResult?.project?.id || null;

      if (state.savedMessageId) {
        // UPDATE existant
        const { error } = await supabase
          .from("messages")
          .update({
            user_id: user.id,          // 🆕 obligatoire (NOT NULL)
            sender: "user",            // 🆕 obligatoire (CHECK constraint)
            project_id: projectId,     // 🆕 mettre à jour le lien projet si changé
            template_data: templateData,
            timestamp: new Date().toISOString(),
          })
          .eq("id", state.savedMessageId);

        if (error) throw error;
      } else {
        // INSERT nouveau
        const { data, error } = await supabase
          .from("messages")
          .insert({
            user_id: user.id,          // 🆕 obligatoire (NOT NULL)
            sender: "user",            // 🆕 obligatoire (CHECK constraint)
            project_id: projectId,
            template_type: "cahier_des_charges",
            template_data: templateData,
            timestamp: new Date().toISOString(),
            session_id: persistentSessionId,
          })
          .select("id")
          .single();

        if (error) throw error;
        if (data) {
          setState((prev) => ({ ...prev, savedMessageId: data.id }));
        }
      }

      setSaveStatus("saved");
      // 🆕 Reset compteur après sauvegarde
      const { savedMessageId: _, ...trackable } = state as any;
      lastSavedHashRef.current = JSON.stringify(trackable);
      setChangeCount(0);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      setSaveStatus("error");
      setSaveError(err.message || "Échec de la sauvegarde");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [state, saveStatus, persistentSessionId, searchParams, loaderResult?.project]);

  // 🆕 Identité stable du CDC pour la persistance du chat — survit aux navigations
  // et aux rechargements. Change uniquement quand on passe à un CDC différent.
  const chatIdentity = useMemo(() => {
    // CDC sauvegardé : Supabase message ID (stable, permanent)
    if (state.savedMessageId) return state.savedMessageId;
    // CDC chargé via URL cdcId
    if (cdcId) return cdcId;
    // CDC chargé via projet (pas encore sauvegardé comme CDC)
    if (projectId) return `project-${projectId}`;
    // Nouveau CDC : identité persistante via localStorage (survit aux rechargements)
    const DRAFT_KEY = "assoai-cdc-draft-id";
    const stored = localStorage.getItem(DRAFT_KEY);
    if (stored) return stored;
    const newId = `draft-${crypto.randomUUID()}`;
    localStorage.setItem(DRAFT_KEY, newId);
    return newId;
  }, [state.savedMessageId, cdcId, projectId]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* Toast de statut sauvegarde */}
        {saveStatus !== "idle" && (
          <div
            className={`fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 toast-enter ${
              saveStatus === "saving"
                ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
                : saveStatus === "saved"
                  ? "bg-green-100 text-green-700 border border-green-200"
                  : "bg-red-100 text-red-700 border border-red-200"
            }`}
          >
            {saveStatus === "saving" && <Loader2 size={14} className="animate-spin" />}
            {saveStatus === "saved" && <Check size={14} />}
            {saveStatus === "error" && <AlertCircle size={14} />}
            {saveStatus === "saving"
              ? "Sauvegarde en cours…"
              : saveStatus === "saved"
                ? "✅ CDC sauvegardé !"
                : `❌ ${saveError || "Erreur"}`}
          </div>
        )}

        {/* Barre de retour vers la liste + aperçu + vérification */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => navigate("/cdc-liste")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600
                       transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-indigo-50"
            title="Retour à la liste des CDC"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Liste des CDC</span>
          </button>
          <div className="flex items-center gap-1.5">
            {/* Boutons de statut — visibles uniquement quand un projet est attaché */}
            {loaderResult?.project?.id && (<>
            {/* Bouton Vérifier — gris, ouvre le dialogue, si Brouillon ou Terminé */}
            {!["vérification", "achat", "fabrication", "installation"].includes((state.statut || "").toLowerCase()) && (
              <button
                type="button"
                onClick={() => setShowVerifDialog(true)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                           hover:bg-gray-100 border border-gray-200
                           transition-colors px-3 py-1.5 rounded-lg"
                title="Ouvrir la vérification"
              >
                <ClipboardCheck className="h-4 w-4" />
                <span>Vérifier</span>
              </button>
            )}
            {/* Bouton Achat — si statut = vérification */}
            {(state.statut || "").toLowerCase() === "vérification" && (
              <button
                type="button"
                onClick={() => setTransitionTarget({ title: "Passer en achat", label: "Achat", targetStatut: "achat" })}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                           hover:bg-gray-100 border border-gray-200
                           transition-colors px-3 py-1.5 rounded-lg"
                title="Passer en achat"
              >
                <ShoppingCart className="h-4 w-4" />
                <span>Achat</span>
              </button>
            )}
            {/* Bouton Fabriquer — si statut = achat */}
            {(state.statut || "").toLowerCase() === "achat" && (
              <button
                type="button"
                onClick={() => setTransitionTarget({ title: "Lancer la fabrication", label: "Fabrication", targetStatut: "fabrication" })}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                           hover:bg-gray-100 border border-gray-200
                           transition-colors px-3 py-1.5 rounded-lg"
                title="Lancer la fabrication"
              >
                <Hammer className="h-4 w-4" />
                <span>Fabriquer</span>
              </button>
            )}
            {/* Bouton Installer — si statut = fabrication */}
            {(state.statut || "").toLowerCase() === "fabrication" && (
              <button
                type="button"
                onClick={() => setTransitionTarget({ title: "Lancer l'installation", label: "Installation", targetStatut: "installation" })}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                           hover:bg-gray-100 border border-gray-200
                           transition-colors px-3 py-1.5 rounded-lg"
                title="Lancer l'installation"
              >
                <Wrench className="h-4 w-4" />
                <span>Installer</span>
              </button>
            )}
            {/* Bouton Terminé — si statut = installation */}
            {(state.statut || "").toLowerCase() === "installation" && (
              <button
                type="button"
                onClick={() => setTransitionTarget({ title: "Marquer comme terminé", label: "Terminé", targetStatut: "terminé" })}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700
                           hover:bg-gray-100 border border-gray-200
                           transition-colors px-3 py-1.5 rounded-lg"
                title="Marquer comme terminé"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Terminé</span>
              </button>
            )}
            </>)}
            {state.savedMessageId && (
              <button
                type="button"
                onClick={() => window.open(`/public/doc/${state.savedMessageId}`, "_blank")}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600
                           transition-colors px-2 py-1 rounded-lg hover:bg-indigo-50"
                title="Aperçu du CDC"
              >
                <Eye className="h-4 w-4" />
                <span>Aperçu</span>
              </button>
            )}
          </div>
        </div>

        {/* Header — toujours visible, compact */}
        <CdcBuilderHeader
          data={{
            projectName: state.projectName,
            cdcNumero: state.cdcNumero,
            commandeId: state.commandeId,
            statut: state.statut || "Brouillon",
            deliveryAddress: state.deliveryAddress,
          }}
          onChange={handleHeaderChange}
          project={
            loaderResult?.project
              ? (() => {
                  const enriched = availableProjects?.find(
                    (p) => p.id === loaderResult.project?.id,
                  );
                  return {
                    ...loaderResult.project,
                    hasCommande: enriched?.hasCommande || false,
                    hasCdc: enriched?.hasCdc || false,
                    commandeId: enriched?.commandeId || state.commandeId,
                    cdcNumero: enriched?.cdcNumero || state.cdcNumero,
                    phase: enriched?.phase,
                    status: enriched?.status,
                  };
                })()
              : null
          }
          availableProjects={availableProjects || []}
          loadingProjects={projectsLoading}
          onSelectProject={handleSelectProject}
          enseigneCount={state.enseignes.length}
          onUnlinkProject={() => {
            // 🆕 Confirmation avant de perdre tout le travail
            if (!window.confirm("Délier le projet ? Tout le travail non sauvegardé sera perdu.")) return;
            setSearchParams({});
            const ens = createEmptyEnseigne();
            const newState: CdcBuilderState = {
              projectName: "",
              cdcNumero: "",
              commandeId: "",
              statut: "Brouillon",
              enseignes: [ens],
              materiauxByEnseigne: { [ens.id]: {} },
              equipe: [],
            };
            setState(newState);
            // 🆕 Reset historique undo
            historyRef.current = [JSON.parse(JSON.stringify(newState))];
            historyIndexRef.current = 0;
            lastCapturedRef.current = JSON.stringify(newState);
            fetchCdcNumero().then(num => setState(prev => ({ ...prev, cdcNumero: num })));
            try { localStorage.removeItem(LS_KEY); } catch {}
          }}
        />

        {/* Vue consolidée : toutes enseignes groupées par section */}
        {showConsolidated ? (
          <div className="pb-24">
            {state.enseignes.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                Aucune enseigne. Cliquez sur « + Ajouter une enseigne » pour commencer.
              </div>
            ) : consolidatedData.rows.length === 0 ? (
              <div className="text-center text-gray-400 py-12">
                Aucun matériau. Ouvrez une enseigne pour ajouter des matériaux.
              </div>
            ) : (
              <CdcBuilderTable
                rows={consolidatedData.rows}
                defaultDimensions={{ largeur: 200, hauteur: 100 }}
                onRowsChange={handleConsolidatedChange}
                enseigneNom="Toutes les enseignes"
                rowMeta={consolidatedData.meta}
                highlights={highlights}
              />
            )}
          </div>
        ) : (
          <>
            {/* Accordéons des enseignes */}
            <div className="pb-24">
              {state.enseignes.map((enseigne, index) => {
                const materiauxSections =
                  state.materiauxByEnseigne[enseigne.id] || {};
                const rows: FlatMaterialRow[] = sectionsToRows(materiauxSections);

                return (
                  <EnseigneAccordion
                    key={enseigne.id}
                    enseigne={enseigne}
                    rows={rows}
                    defaultOpen={allOpen}
                    onEdit={() => handleEditEnseigne(enseigne)}
                    onDelete={() => handleDeleteEnseigne(enseigne)}
                    canDelete={state.enseignes.length > 1}
                    onRowsChange={(newRows) =>
                      handleRowsChange(enseigne.id, newRows)
                    }
                    onUpdateEnseigne={(changes) =>
                      handleUpdateEnseigne(enseigne.id, changes)
                    }
                    highlights={highlights}
                    onDissocierEnfant={(section, groupItemId, enfantIndex) =>
                      handleDissocierDirect(enseigne.id, section, groupItemId, enfantIndex)
                    }
                                        onRegenerate={() => {
                      setRegenerateTarget(enseigne);
                      setRegenerateInput("");
                      setRegenerateDialogOpen(true);
                    }}
                    onOpenPreview={(section, groupIndex) => {
                      setPreviewState({ enseigneId: enseigne.id, section, groupIndex });
                    }}
                  />
                );
              })}

              {/* Bouton Ajouter une enseigne — après le dernier bloc */}
              <button
                type="button"
                onClick={handleAddEnseigne}
                className="flex items-center gap-2 w-full mt-2 py-3 border-2 border-dashed border-gray-300
                           rounded-lg text-sm text-gray-400 hover:text-indigo-500 hover:border-indigo-300
                           hover:bg-indigo-50/30 transition-all justify-center font-medium"
              >
                <Plus size={16} />
                Ajouter une enseigne
              </button>
            </div>
          </>
        )}

        {/* Dialogue enseigne */}
        <EnseigneDialog
          open={dialogOpen}
          enseigne={editingEnseigne}
          onSave={handleSaveEnseigne}
          onClose={() => setDialogOpen(false)}
        />

        {/* 🆕 Dialogue de régénération — confirmation + précision */}
        {regenerateDialogOpen && regenerateTarget && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            onClick={() => setRegenerateDialogOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Régénérer « {regenerateTarget.nom} »
                  </h3>
                </div>
                <button
                  onClick={() => setRegenerateDialogOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              <div className="px-5 py-4">
                <p className="text-sm text-gray-500 mb-3">
                  Brico va supprimer tous les matériaux actuels de cette enseigne et les régénérer.
                  Tu peux ajouter une précision ci-dessous.
                </p>
                <textarea
                  value={regenerateInput}
                  onChange={(e) => setRegenerateInput(e.target.value)}
                  placeholder="Ex: Utilise du Forex 5mm au lieu du Plexiglass, mets des LED blanches chaudes..."
                  className="w-full h-24 px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none
                             focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400
                             placeholder:text-gray-400"
                  autoFocus
                />
              </div>

              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setRegenerateDialogOpen(false)}
                  className="flex-1 h-10 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={() => {
                    setRegenerateDialogOpen(false);
                    setRegenerateMessage(regenerateInput);
                    setRegenerateEnseigneId(regenerateTarget.id);
                  }}
                  className="flex-1 h-10 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                >
                  <RotateCcw size={14} />
                  Régénérer
                </button>
              </div>
            </div>
          </div>
        )}

        {previewGroupData && (
          <SheetPreview
            feuilleL={previewGroupData.feuilleL / 100}
            feuilleH={previewGroupData.feuilleH / 100}
            feuilles={previewGroupData.feuilles}
            nomMateriau={previewGroupData.nomMateriau}
            hasPlacements={previewGroupData.hasPlacements}
            onClose={() => setPreviewState(null)}
            onRecalculer={handleRepackPageLevel}
          />
        )}

        {/* Dialogue vérification */}
        {showVerifDialog && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            onClick={() => setShowVerifDialog(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-amber-500" />
                  <h3 className="text-base font-semibold text-gray-800">
                    Vérification du CDC
                  </h3>
                </div>
                <button
                  onClick={() => setShowVerifDialog(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Résumé */}
              <div className="px-5 py-4 space-y-3">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">N° CDC</span>
                    <span className="font-mono font-semibold text-indigo-600">{state.cdcNumero}</span>
                  </div>
                  {state.commandeId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">N° Commande</span>
                      <span className="font-mono font-semibold text-emerald-600">{state.commandeId}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Enseignes</span>
                    <span className="font-semibold text-gray-700">{state.enseignes.length}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Statut actuel</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      (state.statut || "").toLowerCase() === "terminé"
                        ? "bg-green-100 text-green-700"
                        : (state.statut || "").toLowerCase() === "vérification"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}>
                      {state.statut || "Brouillon"}
                    </span>
                  </div>
                </div>

                {/* Zone de notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Observations
                  </label>
                  <textarea
                    value={verifNotes}
                    onChange={(e) => setVerifNotes(e.target.value)}
                    placeholder="Notes de vérification (optionnel)…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
                               placeholder:text-gray-400 focus:ring-2 focus:ring-amber-500/40 focus:border-amber-400
                               outline-none resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setShowVerifDialog(false)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSetVerification}
                  className="flex-1 h-9 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 flex items-center justify-center gap-1.5"
                >
                  <ClipboardCheck className="h-4 w-4" />
                  Confirmer la vérification
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dialogue de transition (Achat / Fabriquer / Installer / Terminé) */}
        {transitionTarget && (
          <div
            className="fixed inset-0 z-[300] flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            onClick={() => setTransitionTarget(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 fade-in duration-200"
            >
              {/* En-tête */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="text-base font-semibold text-gray-800">
                  {transitionTarget.title}
                </h3>
                <button
                  onClick={() => setTransitionTarget(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Résumé */}
              <div className="px-5 py-4 space-y-3">
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">N° CDC</span>
                    <span className="font-mono font-semibold text-indigo-600">{state.cdcNumero}</span>
                  </div>
                  {state.commandeId && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">N° Commande</span>
                      <span className="font-mono font-semibold text-emerald-600">{state.commandeId}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Statut actuel</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-600">
                      {state.statut || "Brouillon"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Nouveau statut</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-100 text-green-700">
                      {transitionTarget.label}
                    </span>
                  </div>
                </div>

                {/* Zone de notes */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Observations
                  </label>
                  <textarea
                    value={transitionNotes}
                    onChange={(e) => setTransitionNotes(e.target.value)}
                    placeholder="Notes (optionnel)…"
                    rows={3}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700
                               placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400
                               outline-none resize-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button
                  onClick={() => setTransitionTarget(null)}
                  className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  Annuler
                </button>
                <button
                  onClick={handleTransition}
                  className="flex-1 h-9 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 flex items-center justify-center gap-1.5"
                >
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer Brico */}
        <CdcBuilderFooter
          chatIdentity={chatIdentity}
          state={state}
          onStateChange={setState}
          user={user}
          persistentSessionId={persistentSessionId}
          projectId={loaderResult?.project?.id || null}
          onHighlightsChange={setHighlights}
          showConsolidated={showConsolidated}
          onToggleConsolidated={() => setShowConsolidated((p) => !p)}
          allOpen={allOpen}
          onToggleAllOpen={() => setAllOpen((p) => !p)}
          onSave={handleSaveCdc}
          saving={saveStatus === "saving"}
          changeCount={changeCount}
          hasProjectWithoutCdc={
            state.enseignes.length >= 1 &&
            !Object.values(state.materiauxByEnseigne).some((sections) =>
              Object.values(sections).some((items) => items.length > 0),
            )
          }
          regenerateEnseigneId={regenerateEnseigneId}
          regenerateMessage={regenerateMessage}
          onClearRegenerate={() => { setRegenerateEnseigneId(null); setRegenerateMessage(""); }}
        />
      </div>
    </div>
  );
};

export default CdcBuilder;
