
import React, { useState, useEffect } from "react";
import { CahierDesChargesData, MaterialItem, Enseigne } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FileSpreadsheet,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronUp,
  Info,
  FileText,
  Store,
  Users,
  MapPin,
  Ruler,
} from "lucide-react";
import AddressPicker from "../shared/AddressPicker";
import StatusLine from "@/components/ui/StatusLine";
import MaterialTable from "./shared/MaterialTable";
import EnseigneSection from "./shared/EnseigneSection";
import EnseigneFilter from "./shared/EnseigneFilter";
import type { CahierStatus } from "@/types";
import { getStatusLineState } from "@/utils/status-utils";
const DEFAULT_SECTIONS = ["Découpe", "Éclairage", "Outillage", "Métal", "Vinyl"];

interface CahierDesChargesTemplateProps {
  data: CahierDesChargesData;
  isEditable?: boolean;
  onChange?: (data: CahierDesChargesData) => void;
  onSave?: (data: CahierDesChargesData) => void;
}

// ─────── Petite carte du dashboard (inspirée ProjectDetail) ───────
const DashboardCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ icon, title, children, className }) => (
  <div
    className={`bg-white rounded-lg p-3 flex items-start gap-2.5 border border-gray-100 ${
      className || ""
    }`}
  >
    <span className="mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  </div>
);

const CahierDesChargesTemplate: React.FC<CahierDesChargesTemplateProps> = ({
  data: initialData,
  isEditable = false,
  onChange,
  onSave,
}) => {
  const [isEditMode, setIsEditMode] = useState(isEditable);
  const [data, setData] = useState<CahierDesChargesData>({
    ...initialData,
    enseignes: initialData.enseignes || [],
    equipe: initialData.equipe || [],
  });
  const [selectedEnseigneFilter, setSelectedEnseigneFilter] = useState<string | "all">("all");
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const CAHIER_STATUSES: CahierStatus[] = [
    "Brouillon",
    "infographie",
    "demande",
    "Payé",
    "Livré",
  ];

  // Migration legacy → enseignes
  const migrateToNewFormat = (
    oldData: CahierDesChargesData,
  ): CahierDesChargesData => {
    if (oldData.enseignes && oldData.enseignes.length > 0) return oldData;
    const defaultEnseigne: Enseigne = {
      id: "enseigne-default",
      nom: "Enseigne principale",
      produits: [],
      details: {
        image_url: oldData.image_url,
        dimensions: oldData.dimensions || { largeur: 0, hauteur: 0 },
        technique: oldData.technique || {
          type_structure: "",
          method_fabrication: "",
        },
      },
      materiauxSections: oldData.materiauxSections || {},
    };
    return {
      ...oldData,
      enseignes: [defaultEnseigne],
      materiauxSections: oldData.materiauxSections,
      dimensions: oldData.dimensions,
      technique: oldData.technique,
      image_url: oldData.image_url,
    };
  };

  useEffect(() => setIsEditMode(isEditable), [isEditable]);
  useEffect(() => {
    const migratedData = migrateToNewFormat(initialData);
    setData(migratedData);
  }, [initialData]);

  const handleChange = (newData: Partial<CahierDesChargesData>) => {
    const updated = { ...data, ...newData };
    setData(updated);
    onChange?.(updated);
  };

  // ── Équipe ──
  const handleEquipeMembreChange = (index: number, field: string, value: any) => {
    const newEquipe = [...data.equipe];
    newEquipe[index] = { ...newEquipe[index], [field]: value };
    handleChange({ equipe: newEquipe });
  };
  const addEquipeMembre = () => {
    handleChange({
      equipe: [...data.equipe, { id: `eq-${Date.now()}`, nom: "", role: "" }],
    });
  };
  const removeEquipeMembre = (index: number) => {
    const newEquipe = [...data.equipe];
    newEquipe.splice(index, 1);
    handleChange({ equipe: newEquipe });
  };

  // ── Enseignes ──
  const addEnseigne = () => {
    const newEnseigne: Enseigne = {
      id: `enseigne-${Date.now()}`,
      nom: "Nouvelle enseigne",
      produits: [],
      details: {
        dimensions: { largeur: 0, hauteur: 0 },
        technique: { type_structure: "", method_fabrication: "" },
      },
      materiauxSections: {},
    };
    handleChange({ enseignes: [...(data.enseignes || []), newEnseigne] });
  };
  const updateEnseigne = (index: number, changes: Partial<Enseigne>) => {
    const newEnseignes = [...(data.enseignes || [])];
    newEnseignes[index] = { ...newEnseignes[index], ...changes };
    handleChange({ enseignes: newEnseignes });
  };
  const removeEnseigne = (index: number) => {
    const newEnseignes = [...(data.enseignes || [])];
    newEnseignes.splice(index, 1);
    handleChange({ enseignes: newEnseignes });
  };

  // ── Matériaux (vue globale, enseigne ciblée) ──
  const mutateSelectedEnseigneSections = (
    mutator: (
      sections: Record<string, MaterialItem[]>,
    ) => Record<string, MaterialItem[]>,
  ) => {
    if (selectedEnseigneFilter === "all") return;
    const idx = (data.enseignes || []).findIndex(
      (e) => e.id === selectedEnseigneFilter,
    );
    if (idx < 0) return;
    const current = data.enseignes![idx].materiauxSections || {};
    const updatedSections = mutator({ ...current });
    updateEnseigne(idx, { materiauxSections: updatedSections });
  };

  const addGlobalItem = (section: string) => {
    mutateSelectedEnseigneSections((sections) => ({
      ...sections,
      [section]: [
        ...(sections[section] || []),
        {
          id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random()}`,
          nom: "",
          quantite: 1,
          unite: "",
          section,
        },
      ],
    }));
  };
  const addGlobalItemFromCatalog = (
    section: string,
    preset: Partial<MaterialItem>,
  ) => {
    mutateSelectedEnseigneSections((sections) => ({
      ...sections,
      [section]: [
        ...(sections[section] || []),
        {
          id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random()}`,
          nom: "",
          quantite: 1,
          unite: "",
          section,
          ...preset,
        },
      ],
    }));
  };
  const deleteGlobalItem = (section: string, idx: number) => {
    mutateSelectedEnseigneSections((sections) => {
      const arr = [...(sections[section] || [])];
      arr.splice(idx, 1);
      return { ...sections, [section]: arr };
    });
  };
  const changeGlobalItem = (
    section: string,
    idx: number,
    changes: Partial<MaterialItem>,
  ) => {
    mutateSelectedEnseigneSections((sections) => {
      const arr = [...(sections[section] || [])];
      arr[idx] = { ...arr[idx], ...changes };
      return { ...sections, [section]: arr };
    });
  };
  const globalMaterialsEditable =
    isEditMode && selectedEnseigneFilter !== "all";

  // ── Matériaux filtrés ──
  const getFilteredMaterials = () => {
    if (selectedEnseigneFilter === "all") {
      const allMaterials: Record<string, MaterialItem[]> = {};
      data.enseignes?.forEach((enseigne) => {
        if (enseigne.materiauxSections) {
          Object.entries(enseigne.materiauxSections).forEach(
            ([section, items]) => {
              if (!allMaterials[section]) allMaterials[section] = [];
              allMaterials[section].push(...items);
            },
          );
        }
      });
      return allMaterials;
    }
    const selectedEnseigne = data.enseignes?.find(
      (e) => e.id === selectedEnseigneFilter,
    );
    return selectedEnseigne?.materiauxSections || {};
  };
  const filteredMaterials = getFilteredMaterials();
  const existingSections = Object.keys(filteredMaterials).filter(
    (k) => (filteredMaterials[k] || []).length > 0,
  );
  const orderedKnown = DEFAULT_SECTIONS.filter((s) =>
    existingSections.includes(s),
  );
  const orderedUnknown = existingSections.filter(
    (s) => !DEFAULT_SECTIONS.includes(s),
  );
  const nonVides = [...orderedKnown, ...orderedUnknown];

  // ── Enseigne sélectionnée (pour l'image bannière) ──
  const selectedEnseigne =
    selectedEnseigneFilter !== "all"
      ? data.enseignes?.find((e) => e.id === selectedEnseigneFilter)
      : null;
  const enseignesCount = (data.enseignes || []).length;
  const equipeCount = data.equipe.length;
  const hasDeliveryAddr =
    !!data.deliveryAddress?.label || !!data.deliveryAddress?.lat;

  return (
    <div className="w-full py-4 sm:py-6 space-y-4">
      {/* ========== HEADER ========== */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-3">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Cahier des charges
            </h2>
            {data.cdcNumero && (
              <p className="font-semibold mt-1 text-sm text-brand-orange">
                N° {data.cdcNumero}
              </p>
            )}
            <p className="font-medium mt-1 text-md text-gray-600">
              {data.titre}
            </p>
          </div>
        </div>
      </div>

      {/* ========== DASHBOARD COLLAPSIBLE (toutes les infos non-matériaux) ========== */}
      <div className="mb-4 border rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => setDashboardOpen(!dashboardOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            {/* Badge statut */}
            <StatusLine
              label={data.statut ?? "Brouillon"}
              status={getStatusLineState(
                (data.statut as CahierStatus) ?? "Brouillon",
              )}
            />
            {/* Résumé rapide */}
            <span className="text-sm text-gray-500 truncate">
              {enseignesCount} enseigne{enseignesCount !== 1 ? "s" : ""}
              {" · "}
              {equipeCount} membre{equipeCount !== 1 ? "s" : ""}
              {hasDeliveryAddr ? " · lieu défini" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs text-gray-400">
              {dashboardOpen ? "Fermer" : "Informations"}
            </span>
            {dashboardOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </div>
        </button>

        {dashboardOpen && (
          <div className="px-4 pb-4 border-t bg-gray-50/50">
            {/* Description CDC (si présente) */}
            {data.description && (
              <p className="text-sm text-gray-500 pt-3 pb-1">
                {data.description}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
              {/* ── Statut ── */}
              <DashboardCard
                icon={<Info size={14} className="text-blue-600" />}
                title="Statut"
              >
                <p className="text-sm font-semibold">
                  {data.statut ?? "Brouillon"}
                </p>
                {isEditMode && (
                  <select
                    value={data.statut || "Brouillon"}
                    onChange={(e) =>
                      handleChange({ statut: e.target.value as CahierStatus })
                    }
                    className="mt-1 w-full text-xs border rounded px-1 py-0.5"
                  >
                    {CAHIER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
              </DashboardCard>

              {/* ── Commande ── */}
              <DashboardCard
                icon={<FileText size={14} className="text-indigo-600" />}
                title="Commande"
              >
                <p className="text-sm font-semibold">
                  {data.commande_id || "—"}
                </p>
                <p className="text-[10px] text-gray-400 truncate">ID référence</p>
              </DashboardCard>

              {/* ── Enseignes ── */}
              <DashboardCard
                icon={<Store size={14} className="text-purple-600" />}
                title="Enseignes"
              >
                <p className="text-sm font-semibold">
                  {enseignesCount} enseigne{enseignesCount !== 1 ? "s" : ""}
                </p>
                <p className="text-[10px] text-gray-400 truncate">
                  {(data.enseignes || [])
                    .map((e) => e.nom)
                    .join(" · ") || "—"}
                </p>
                {/* Gestion des enseignes (ajout + liste déroulante) */}
                {isEditMode && (
                  <div className="mt-2 space-y-2">
                    {data.enseignes?.map((enseigne, index) => (
                      <EnseigneSection
                        key={enseigne.id}
                        enseigne={enseigne}
                        isEditable={isEditMode}
                        onDelete={() => removeEnseigne(index)}
                        onChange={(changes) => updateEnseigne(index, changes)}
                        defaultOpen={false}
                      />
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addEnseigne}
                      className="flex items-center text-brand-orange border-brand-orange hover:bg-brand-orange hover:text-white text-xs"
                    >
                      <PlusCircle className="h-3 w-3 mr-1" /> Ajouter une
                      enseigne
                    </Button>
                  </div>
                )}
              </DashboardCard>

              {/* ── Équipe ── */}
              <DashboardCard
                icon={<Users size={14} className="text-green-600" />}
                title="Équipe"
              >
                <p className="text-sm font-semibold">
                  {equipeCount} membre{equipeCount !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.equipe.map((m) => (
                    <span
                      key={m.id}
                      className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5 truncate max-w-[80px]"
                    >
                      {m.nom || "—"}
                    </span>
                  ))}
                </div>
                {isEditMode && (
                  <details className="mt-2">
                    <summary className="text-xs text-brand-orange cursor-pointer hover:underline">
                      Gérer l'équipe
                    </summary>
                    <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {data.equipe.map((membre, index) => (
                        <div
                          key={membre.id}
                          className="flex items-center gap-1"
                        >
                          <Input
                            value={membre.nom}
                            onChange={(e) =>
                              handleEquipeMembreChange(
                                index,
                                "nom",
                                e.target.value,
                              )
                            }
                            className="h-7 text-xs flex-1"
                            placeholder="Nom"
                          />
                          <Input
                            value={membre.role}
                            onChange={(e) =>
                              handleEquipeMembreChange(
                                index,
                                "role",
                                e.target.value,
                              )
                            }
                            className="h-7 text-xs w-20"
                            placeholder="Rôle"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeEquipeMembre(index)}
                            className="text-red-500 h-7 w-7 p-0"
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={addEquipeMembre}
                        className="text-xs text-brand-orange h-7"
                      >
                        + Ajouter
                      </Button>
                    </div>
                  </details>
                )}
              </DashboardCard>

              {/* ── Adresse de livraison ── */}
              <DashboardCard
                icon={<MapPin size={14} className="text-amber-600" />}
                title="Livraison"
              >
                {hasDeliveryAddr ? (
                  <>
                    <p className="text-sm font-semibold">
                      {data.deliveryAddress!.label || "Adresse définie"}
                    </p>
                    {isEditMode && (
                      <details className="mt-2">
                        <summary className="text-xs text-brand-orange cursor-pointer hover:underline">
                          Modifier
                        </summary>
                        <div className="mt-1">
                          <AddressPicker
                            value={data.deliveryAddress}
                            onChange={(addr) =>
                              handleChange({ deliveryAddress: addr })
                            }
                            isEditable={isEditMode}
                          />
                        </div>
                      </details>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Non définie</p>
                )}
                {isEditMode && !hasDeliveryAddr && (
                  <div className="mt-1">
                    <AddressPicker
                      value={data.deliveryAddress}
                      onChange={(addr) =>
                        handleChange({ deliveryAddress: addr })
                      }
                      isEditable={isEditMode}
                    />
                  </div>
                )}
              </DashboardCard>

              {/* ── Dimensions de l'enseigne sélectionnée ── */}
              {selectedEnseigne && (
                <DashboardCard
                  icon={<Ruler size={14} className="text-teal-600" />}
                  title="Dimensions"
                >
                  <p className="text-sm font-semibold">
                    L: {selectedEnseigne.details?.dimensions?.largeur || "—"} m · H:{" "}
                    {selectedEnseigne.details?.dimensions?.hauteur || "—"} m
                  </p>
                  {selectedEnseigne.details?.technique?.type_structure && (
                    <p className="text-[10px] text-gray-500 truncate">
                      {selectedEnseigne.details.technique.type_structure}
                    </p>
                  )}
                </DashboardCard>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== MATÉRIAUX (toujours visible, en pleine surface) ========== */}
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        {/* Barre de titre + filtre enseignes + image enseigne */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            📦 Matériaux
            {nonVides.length > 0 && (
              <span className="inline-block bg-white text-gray-500 text-xs font-normal px-1.5 py-0.5 rounded-full">
                {nonVides.reduce(
                  (sum, k) => sum + (filteredMaterials[k] || []).length,
                  0,
                )}{" "}
                matériau
                {nonVides.reduce(
                  (sum, k) => sum + (filteredMaterials[k] || []).length,
                  0,
                ) !== 1
                  ? "x"
                  : ""}
              </span>
            )}
          </span>
          <EnseigneFilter
            enseignes={data.enseignes || []}
            selectedEnseigneId={selectedEnseigneFilter}
            onFilterChange={setSelectedEnseigneFilter}
          />
        </div>

        {/* Image de l'enseigne filtrée (bannière contextuelle) */}
        {selectedEnseigne?.details?.image_url && (
          <div className="relative h-48 overflow-hidden flex items-center justify-center bg-gray-100">
            <div className="absolute inset-0">
              <img
                src={selectedEnseigne.details.image_url}
                alt={selectedEnseigne.nom}
                className="w-full h-full object-cover opacity-60"
              />
            </div>
            <div className="relative z-10 text-center px-4">
              <p className="text-lg font-semibold text-gray-800 drop-shadow-sm">
                {selectedEnseigne.nom}
              </p>
              <p className="text-xs text-gray-600">
                {selectedEnseigne.details?.dimensions?.largeur
                  ? `${selectedEnseigne.details.dimensions.largeur} × ${selectedEnseigne.details.dimensions.hauteur} m`
                  : ""}
                {selectedEnseigne.details?.dimensions?.largeur &&
                nonVides.length
                  ? " · "
                  : ""}
                {nonVides.length > 0
                  ? `${nonVides.reduce(
                      (sum, k) =>
                        sum + (filteredMaterials[k] || []).length,
                      0,
                    )} matériau${nonVides.reduce((sum, k) => sum + (filteredMaterials[k] || []).length, 0) !== 1 ? "x" : ""}`
                  : ""}
              </p>
            </div>
          </div>
        )}

        {/* Contenu tableau matériaux (toujours visible) */}
        <div className="p-4">
          {isEditMode && selectedEnseigneFilter === "all" && (
            <p className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              ℹ️ Sélectionnez une enseigne précise ci-dessus pour modifier ses
              matériaux ici. La vue « Tous » agrège toutes les enseignes
              (lecture seule).
            </p>
          )}

          {nonVides.length > 0 ? (
            <MaterialTable
              key={selectedEnseigneFilter}
              sections={filteredMaterials}
              knownCategories={DEFAULT_SECTIONS}
              isEditable={globalMaterialsEditable}
              onAddItem={addGlobalItem}
              onDeleteItem={deleteGlobalItem}
              onChangeItem={changeGlobalItem}
              onAddFromCatalog={addGlobalItemFromCatalog}
            />
          ) : (
            <p className="text-sm text-gray-500 italic py-4">
              {selectedEnseigneFilter === "all"
                ? "Aucun matériau dans toutes les enseignes."
                : `Aucun matériau pour cette enseigne.${
                    isEditMode
                      ? " Sélectionnez « Tous » ou ajoutez-en via le bouton ci-dessous."
                      : ""
                  }`}
            </p>
          )}
        </div>
      </div>

      {/* Bouton d'enregistrement */}
      {isEditMode && (
        <div className="flex justify-end">
          <Button
            onClick={(e) => {
              e.preventDefault();
              onSave?.(data);
            }}
            className="px-6"
          >
            Enregistrer
          </Button>
        </div>
      )}
    </div>
  );
};

export default CahierDesChargesTemplate;
