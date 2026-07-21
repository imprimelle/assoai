// src/pages/CdcBuilder.tsx
// Page d'assemblage du CDC Builder — onglets slidables + tableau matériaux + footer Brico.
// Gère l'état global CdcBuilderState et la sérialisation vers CahierDesChargesData.

import React, { useState, useCallback } from "react";
import EnseigneSlidingTabs from "@/components/cdc-builder/EnseigneSlidingTabs";
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

  const activeEnseigne = state.enseignes[state.activeEnseigneIndex];
  const materiauxSections =
    state.materiauxByEnseigne[activeEnseigne?.id] || {};
  const rows: FlatMaterialRow[] = sectionsToRows(materiauxSections);

  // --- Handlers enseigne ---

  const handleAddEnseigne = useCallback(() => {
    setEditingEnseigne(undefined);
    setDialogOpen(true);
  }, []);

  const handleEditEnseigne = useCallback((index: number) => {
    setEditingEnseigne(state.enseignes[index]);
    setDialogOpen(true);
  }, [state.enseignes]);

  const handleSaveEnseigne = useCallback(
    (enseigne: CdcBuilderEnseigne) => {
      if (editingEnseigne) {
        // Mode édition — remplacer l'enseigne existante
        const newEnseignes = [...state.enseignes];
        newEnseignes[state.activeEnseigneIndex] = enseigne;
        setState({ ...state, enseignes: newEnseignes });
      } else {
        // Mode création — ajouter + initialiser materiauxByEnseigne
        setState({
          ...state,
          enseignes: [...state.enseignes, enseigne],
          activeEnseigneIndex: state.enseignes.length,
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
    (index: number) => {
      if (state.enseignes.length <= 1) return;
      const newEnseignes = state.enseignes.filter((_, i) => i !== index);
      const deletedId = state.enseignes[index].id;
      const newMateriaux = { ...state.materiauxByEnseigne };
      delete newMateriaux[deletedId];
      setState({
        ...state,
        enseignes: newEnseignes,
        activeEnseigneIndex: Math.min(
          state.activeEnseigneIndex,
          newEnseignes.length - 1,
        ),
        materiauxByEnseigne: newMateriaux,
      });
    },
    [state],
  );

  // --- Handlers matériaux ---

  const handleRowsChange = useCallback(
    (newRows: FlatMaterialRow[]) => {
      // Reconstruire materiauxSections à partir des lignes
      const newSections: Record<string, any[]> = {};
      for (const row of newRows) {
        if (!newSections[row.section]) newSections[row.section] = [];
        newSections[row.section].push(row.item);
      }
      setState({
        ...state,
        materiauxByEnseigne: {
          ...state.materiauxByEnseigne,
          [activeEnseigne.id]: newSections,
        },
      });
    },
    [state, activeEnseigne],
  );

  // --- Handlers dimensions enseigne active ---

  const handleDimChange = useCallback(
    (field: "largeur" | "hauteur" | "profondeur", raw: string) => {
      const num = raw === "" ? 0 : Number(raw);
      if (Number.isNaN(num)) return;
      const newEnseignes = [...state.enseignes];
      newEnseignes[state.activeEnseigneIndex] = {
        ...activeEnseigne,
        dimensions: {
          ...activeEnseigne.dimensions,
          [field]: Math.max(0, num),
        },
      };
      setState({ ...state, enseignes: newEnseignes });
    },
    [state, activeEnseigne],
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

        {/* Onglets slidables */}
        <EnseigneSlidingTabs
          enseignes={state.enseignes}
          activeIndex={state.activeEnseigneIndex}
          onSelect={(i) =>
            setState({ ...state, activeEnseigneIndex: i })
          }
          onAdd={handleAddEnseigne}
          onDelete={handleDeleteEnseigne}
          onEdit={handleEditEnseigne}
        />

        {/* Dimensions inline de l'enseigne active */}
        {activeEnseigne && (
          <div className="flex items-center gap-3 mt-3 mb-4 text-sm">
            <span className="text-gray-400">📏</span>
            <label className="text-gray-500 text-xs">L</label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={activeEnseigne.dimensions.largeur || ""}
              onChange={(e) =>
                handleDimChange("largeur", e.target.value)
              }
              className={`${cellInput} w-20 text-center`}
            />
            <span className="text-xs text-gray-400">cm</span>

            <label className="text-gray-500 text-xs ml-3">H</label>
            <input
              type="number"
              inputMode="decimal"
              min={1}
              value={activeEnseigne.dimensions.hauteur || ""}
              onChange={(e) =>
                handleDimChange("hauteur", e.target.value)
              }
              className={`${cellInput} w-20 text-center`}
            />
            <span className="text-xs text-gray-400">cm</span>

            <label className="text-gray-500 text-xs ml-3">P</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              value={activeEnseigne.dimensions.profondeur || ""}
              onChange={(e) =>
                handleDimChange("profondeur", e.target.value)
              }
              className={`${cellInput} w-20 text-center`}
            />
            <span className="text-xs text-gray-400">cm</span>

            <button
              type="button"
              onClick={() => handleEditEnseigne(state.activeEnseigneIndex)}
              className="ml-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              ✏️ Éditer
            </button>
          </div>
        )}

        {/* Tableau matériaux */}
        {activeEnseigne && (
          <div className="pb-24">
            <CdcBuilderTable
              rows={rows}
              defaultDimensions={activeEnseigne.dimensions}
              onRowsChange={handleRowsChange}
              enseigneNom={activeEnseigne.nom}
            />
          </div>
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
