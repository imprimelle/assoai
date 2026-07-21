// src/pages/CdcBuilder.tsx
// Page d'assemblage du CDC Builder — accordéons d'enseignes + tableaux matériaux + footer Brico.
// v2: accordéons collapsibles (comme EnseigneSection) au lieu d'onglets slidables.
// Chaque enseigne est visible avec son propre CdcBuilderTable.

import React, { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Pencil,
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
          {isOpen ? (
            <ChevronUp size={18} className="text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-400" />
          )}
        </div>
      </button>

      {/* Contenu dépliable */}
      {isOpen && (
        <div className="p-4 pt-3">
          {/* Dimensions inline */}
          <div className="flex flex-wrap items-center gap-3 mb-4 text-sm">
            <span className="text-gray-400">📏</span>
            <span className="text-xs text-gray-500">
              {enseigne.dimensions.largeur} × {enseigne.dimensions.hauteur}
              {enseigne.dimensions.profondeur ? ` × ${enseigne.dimensions.profondeur}` : ""} cm
            </span>
            {enseigne.technique.type_structure && (
              <>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-gray-500">
                  🔧 {enseigne.technique.type_structure}
                </span>
              </>
            )}
            <div className="ml-auto flex items-center gap-2">
              {!isChatActive && (
                <button
                  type="button"
                  onClick={onSetChatActive}
                  className="text-xs text-indigo-500 hover:text-indigo-700 font-medium transition-colors"
                >
                  💬 Définir pour le chat
                </button>
              )}
              <button
                type="button"
                onClick={onEdit}
                className="text-xs text-gray-500 hover:text-indigo-600 font-medium transition-colors"
              >
                ✏️ Éditer les détails
              </button>
            </div>
          </div>

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
      const newSections: Record<string, any[]> = {};
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAllOpen((p) => !p)}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              {allOpen ? "Tout replier" : "Tout déplier"}
            </button>
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
