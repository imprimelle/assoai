// src/pages/CdcBuilder.tsx
// Page d'assemblage du CDC Builder — accordéons d'enseignes + tableaux matériaux + footer Brico.
// v2: accordéons collapsibles (comme EnseigneSection) au lieu d'onglets slidables.
// Chaque enseigne est visible avec son propre CdcBuilderTable.

import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  Trash2,
  Plus,
  Pencil,
  Image as ImageIcon,
  LayoutGrid,
} from "lucide-react";
import EnseigneDialog from "@/components/cdc-builder/EnseigneDialog";
import CdcBuilderTable, {
  sectionsToRows,
} from "@/components/cdc-builder/CdcBuilderTable";
import CdcBuilderFooter from "@/components/cdc-builder/CdcBuilderFooter";
import {
  createEmptyEnseigne,
  type CdcBuilderState,
  type CdcBuilderEnseigne,
} from "@/types/cdcBuilder";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { User } from "@/types/user";

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
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  // Synchroniser avec le toggle global "Tout replier/déplier"
  useEffect(() => {
    setIsOpen(defaultOpen);
  }, [defaultOpen]);

  return (
    <div className="border border-gray-200 rounded-lg bg-white mb-4 overflow-hidden shadow-sm">
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
            <a
              href={enseigne.image_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                         hover:shadow-md hover:scale-105 transition-all duration-200 group"
              title="Voir l'image en grand"
            >
              <img
                src={enseigne.image_url}
                alt={enseigne.nom}
                className="w-full h-full object-cover"
              />
            </a>
          ) : (
            <div className="shrink-0 w-10 h-10 rounded-lg bg-gray-100 border border-gray-200
                            flex items-center justify-center">
              <ImageIcon size={16} className="text-gray-400" />
            </div>
          )}
          <span className="text-lg">🏷️</span>
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
          />
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

const CdcBuilder: React.FC<CdcBuilderProps> = ({
  user,
  persistentSessionId,
}) => {
  const emptyEnseigne = createEmptyEnseigne();

  const [state, setState] = useState<CdcBuilderState>({
    projectName: "",
    cdcNumero: "",
    commandeId: "",
    enseignes: [emptyEnseigne],
    activeEnseigneIndex: 0,
    materiauxByEnseigne: { [emptyEnseigne.id]: {} },
    equipe: [],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEnseigne, setEditingEnseigne] = useState<
    CdcBuilderEnseigne | undefined
  >();
  // Tous les accordéons ouverts par défaut au début
  const [allOpen, setAllOpen] = useState(true);
  // Vue consolidée (toutes enseignes groupées par section)
  const [showConsolidated, setShowConsolidated] = useState(false);

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

  const cellInput =
    "h-8 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900">🏗️ CDC Builder</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Construisez votre cahier des charges manuellement
          </p>

          {/* Infos projet */}
          <div className="flex flex-wrap gap-3 mt-3">
            <input
              placeholder="Nom du projet..."
              value={state.projectName}
              onChange={(e) =>
                setState({ ...state, projectName: e.target.value })
              }
              className={`${cellInput} w-56`}
            />
            <input
              placeholder="CDC-YYYY-NNN"
              value={state.cdcNumero}
              onChange={(e) =>
                setState({ ...state, cdcNumero: e.target.value })
              }
              className={`${cellInput} w-40`}
            />
            <input
              placeholder="CMD-YYYY-NNN"
              value={state.commandeId}
              onChange={(e) =>
                setState({ ...state, commandeId: e.target.value })
              }
              className={`${cellInput} w-40`}
            />
          </div>
        </div>

        {/* Barre d'actions enseignes */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-gray-600">
            📋 {state.enseignes.length} enseigne{state.enseignes.length > 1 ? "s" : ""}
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle Vue d'ensemble */}
            <button
              type="button"
              onClick={() => setShowConsolidated((p) => !p)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors border
                ${showConsolidated
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              title={showConsolidated ? "Vue par enseigne" : "Vue consolidée par section"}
            >
              <LayoutGrid size={14} />
              {showConsolidated ? "Par enseigne" : "Tout"}
            </button>
            {!showConsolidated && (
              <button
                type="button"
                onClick={() => setAllOpen((p) => !p)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                {allOpen ? "Tout replier" : "Tout déplier"}
              </button>
            )}
            <button
              type="button"
              onClick={handleAddEnseigne}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium
                         bg-indigo-600 text-white rounded-lg hover:bg-indigo-700
                         transition-colors shadow-sm"
            >
              <Plus size={16} />
              Ajouter une enseigne
            </button>
          </div>
        </div>

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
                  />
                );
              })}
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
        />
      </div>
    </div>
  );
};

export default CdcBuilder;
