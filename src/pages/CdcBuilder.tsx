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
  Save,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";
import EnseigneDialog from "@/components/cdc-builder/EnseigneDialog";
import CdcBuilderTable, {
  sectionsToRows,
} from "@/components/cdc-builder/CdcBuilderTable";
import CdcBuilderFooter from "@/components/cdc-builder/CdcBuilderFooter";
import CdcBuilderHeader from "@/components/cdc-builder/CdcBuilderHeader";
import {
  createEmptyEnseigne,
  type CdcBuilderState,
  type CdcBuilderEnseigne,
  type HighlightMap,
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
  isChatActive: boolean;
  defaultOpen?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetChatActive: () => void;
  onRowsChange: (rows: FlatMaterialRow[]) => void;
  onUpdateEnseigne: (changes: Partial<CdcBuilderEnseigne>) => void;
  highlights?: HighlightMap;
}

const EnseigneAccordion: React.FC<EnseigneAccordionProps> = ({
  enseigne,
  rows,
  isChatActive,
  defaultOpen = false,
  onEdit,
  onDelete,
  onSetChatActive,
  onRowsChange,
  onUpdateEnseigne,
  highlights,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [imageModalOpen, setImageModalOpen] = useState(false);

  // Synchroniser avec le toggle global "Tout replier/déplier"
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  const handleDownloadImage = () => {
    if (!enseigne.image_url) return;
    const a = document.createElement("a");
    a.href = enseigne.image_url;
    a.download = `${enseigne.nom.replace(/\\s+/g, "_")}.jpg`;
    a.click();
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-gray-50 mb-4 overflow-hidden shadow-sm">
      {/* Header cliquable */}
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex justify-between items-center w-full p-4 text-left
                   bg-gradient-to-r from-indigo-50 to-indigo-100
                   hover:from-indigo-100 hover:to-indigo-150 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Miniature de l'enseigne */}
          {enseigne.image_url ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImageModalOpen(true);
              }}
              className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                         hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
              title="Voir l'image"
            >
              <img
                src={enseigne.image_url}
                alt={enseigne.nom}
                className="w-full h-full object-cover"
              />
            </button>
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
              {isChatActive && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500 text-white font-medium shrink-0">
                  Chat
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {enseigne.dimensions.largeur}×{enseigne.dimensions.hauteur}
              {enseigne.dimensions.profondeur ? `×${enseigne.dimensions.profondeur}` : ""} cm
              {enseigne.technique.type_structure
                ? ` · ${enseigne.technique.type_structure}`
                : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-white/50 rounded transition-colors"
            title="Éditer cette enseigne"
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-white/50 rounded transition-colors"
            title="Supprimer cette enseigne"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </button>

      {/* Contenu dépliable */}
      {isOpen && (
        <div className="p-4 pt-3">
          {/* Lien chat */}
          {!isChatActive && (
            <div className="mb-3">
              <button
                type="button"
                onClick={onSetChatActive}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
              >
                💬 Définir comme enseigne active pour le chat Brico
              </button>
            </div>
          )}

          {/* Tableau matériaux */}
          <CdcBuilderTable
            rows={rows}
            defaultDimensions={enseigne.dimensions}
            onRowsChange={onRowsChange}
            enseigneNom={enseigne.nom}
            highlights={highlights}
          />
        </div>
      )}
      {/* Modal image */}
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
    statut: "Brouillon",
    enseignes: state.enseignes.map((ens) => ({
      id: ens.id,
      nom: ens.nom,
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

/** Génère un nouveau numéro CDC (CDC-YYYY-NNN) */
function generateCdcNumero(): string {
  const year = new Date().getFullYear();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `CDC-${year}-${seq}`;
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
        .select("id, name")
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

        const hasCommande = msgs?.some(
          (m: any) =>
            m.template_type === "commande" &&
            ["Validée", "Confirmée", "En cours"].includes(
              m.template_data?.data?.statut,
            ),
        );
        const hasCdc = msgs?.some(
          (m: any) => m.template_type === "cahier_des_charges",
        );

        enriched.push({
          id: p.id,
          name: p.name,
          hasCommande: !!hasCommande,
          hasCdc: !!hasCdc,
        });
      }

      return enriched;
    },
    staleTime: 30_000,
  });

  // État initial par défaut
  const emptyEnseigne = createEmptyEnseigne();

  const [state, setState] = useState<CdcBuilderState>({
    projectName: "",
    cdcNumero: generateCdcNumero(),
    commandeId: "",
    enseignes: [emptyEnseigne],
    activeEnseigneIndex: 0,
    materiauxByEnseigne: { [emptyEnseigne.id]: {} },
    equipe: [],
  });

  // Appliquer les données chargées du loader quand elles arrivent
  useEffect(() => {
    if (loaderResult?.initialState) {
      setState(loaderResult.initialState);
    }
  }, [loaderResult?.initialState]);

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
  // Tous les accordéons ouverts par défaut au début
  const [allOpen, setAllOpen] = useState(true);
  // Vue consolidée (toutes enseignes groupées par section)
  const [showConsolidated, setShowConsolidated] = useState(false);
  // Highlights temporaires après action Brico (flash animation)
  const [highlights, setHighlights] = useState<HighlightMap>({});
  // État de sauvegarde Supabase
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  // Compteur de modifications non sauvegardées
  const [changeCount, setChangeCount] = useState(0);
  const prevStateHash = useRef("");

  // Suivre les modifications du state (hors savedMessageId)
  useEffect(() => {
    const { savedMessageId, ...trackable } = state as any;
    const hash = JSON.stringify(trackable);
    if (prevStateHash.current && prevStateHash.current !== hash) {
      setChangeCount((c) => c + 1);
    }
    prevStateHash.current = hash;
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
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CdcBuilderState;
        if (parsed.enseignes?.length) {
          setState(parsed);
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

  // Enseigne active pour le chat Brico
  const activeEnseigne = state.enseignes[state.activeEnseigneIndex];
  const setActiveEnseigne = (index: number) =>
    setState((prev) => ({ ...prev, activeEnseigneIndex: index }));

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
          // Si connu → garder l'enseigne. Sinon (nouvelle row) → enseigne active.
          return enseigneId ? enseigneId === ens.id : ens.id === activeEnseigne?.id;
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
    [state, activeEnseigne, consolidatedData.itemToEnseigneId],
  );

  const handleHeaderChange = useCallback(
    (changes: Partial<{
      projectName: string;
      cdcNumero: string;
      commandeId: string;
      deliveryAddress: CdcBuilderState["deliveryAddress"];
    }>) => {
      setState((prev) => ({ ...prev, ...changes }));
    },
    [],
  );

  // ── Sauvegarde vers Supabase ──
  const handleSaveCdc = useCallback(async () => {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setSaveError("");

    const payload = buildCdcPayload(state);
    const templateData = { data: payload, version: (state as any)._version || 1 };

    try {
      const projectId = searchParams.get("projectId") || searchParams.get("cdcId")
        ? (loaderResult?.project?.id || null)
        : null;

      if (state.savedMessageId) {
        // UPDATE existant
        const { error } = await supabase
          .from("messages")
          .update({
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
      setChangeCount(0);
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err: any) {
      setSaveStatus("error");
      setSaveError(err.message || "Échec de la sauvegarde");
      setTimeout(() => setSaveStatus("idle"), 4000);
    }
  }, [state, saveStatus, persistentSessionId, searchParams, loaderResult?.project]);

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

        {/* Barre de retour vers la liste */}
        <div className="flex items-center mb-3">
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
        </div>

        {/* Header — toujours visible, compact */}
        <CdcBuilderHeader
          data={{
            projectName: state.projectName,
            cdcNumero: state.cdcNumero,
            commandeId: state.commandeId,
            deliveryAddress: state.deliveryAddress,
          }}
          onChange={handleHeaderChange}
          project={
            loaderResult?.project
              ? {
                  ...loaderResult.project,
                  hasCommande:
                    availableProjects?.find(
                      (p) => p.id === loaderResult.project?.id,
                    )?.hasCommande || false,
                  hasCdc:
                    availableProjects?.find(
                      (p) => p.id === loaderResult.project?.id,
                    )?.hasCdc || false,
                }
              : null
          }
          availableProjects={availableProjects || []}
          loadingProjects={projectsLoading}
          onSelectProject={handleSelectProject}
          onUnlinkProject={() => {
            setSearchParams({});
            const ens = createEmptyEnseigne();
            const newState: CdcBuilderState = {
              projectName: "",
              cdcNumero: generateCdcNumero(),
              commandeId: "",
              enseignes: [ens],
              activeEnseigneIndex: 0,
              materiauxByEnseigne: { [ens.id]: {} },
              equipe: [],
            };
            setState(newState);
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
                    isChatActive={index === state.activeEnseigneIndex}
                    defaultOpen={allOpen}
                    onEdit={() => handleEditEnseigne(enseigne)}
                    onDelete={() => handleDeleteEnseigne(enseigne)}
                    onSetChatActive={() => setActiveEnseigne(index)}
                    onRowsChange={(newRows) =>
                      handleRowsChange(enseigne.id, newRows)
                    }
                    onUpdateEnseigne={(changes) =>
                      handleUpdateEnseigne(enseigne.id, changes)
                    }
                    highlights={highlights}
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

        {/* Footer Brico */}
        <CdcBuilderFooter
          state={state}
          onStateChange={setState}
          user={user}
          persistentSessionId={persistentSessionId}
          onHighlightsChange={setHighlights}
          showConsolidated={showConsolidated}
          onToggleConsolidated={() => setShowConsolidated((p) => !p)}
          allOpen={allOpen}
          onToggleAllOpen={() => setAllOpen((p) => !p)}
          onSave={handleSaveCdc}
          saving={saveStatus === "saving"}
          changeCount={changeCount}
        />
      </div>
    </div>
  );
};

export default CdcBuilder;
