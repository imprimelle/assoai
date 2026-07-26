
import React, { useState, useEffect } from "react";
import { CahierDesChargesData, MaterialItem, Enseigne } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  X,
  Image as ImageIcon,
  Wrench,
  AlertCircle,
  Pencil,
  Eye,
  Check,
} from "lucide-react";
import AddressPicker from "../shared/AddressPicker";
import StatusLine from "@/components/ui/StatusLine";
import MaterialTable from "./shared/MaterialTable";
import EnseigneFilter from "./shared/EnseigneFilter";
import ImageUpload from "./shared/ImageUpload";
import type { CahierStatus } from "@/types";
import { getStatusLineState } from "@/utils/status-utils";
import { useProductBom } from "@/hooks/useProductBom";
import type { ProductBomItem } from "@/types/productBom";

const DEFAULT_SECTIONS = ["Découpe", "Éclairage", "Outillage", "Métal", "Vinyl"];

interface CahierDesChargesTemplateProps {
  data: CahierDesChargesData;
  isEditable?: boolean;
  onChange?: (data: CahierDesChargesData) => void;
  onSave?: (data: CahierDesChargesData) => void;
}

// ─────── Carte dashboard cliquable ───────
const DashboardCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}> = ({ icon, title, children, onClick, className }) => {
  const interactive = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-lg p-3 flex items-start gap-2.5 border border-gray-100 ${
        interactive ? "cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all" : ""
      } ${className || ""}`}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick!(); } } : undefined}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{title}</p>
        {children}
      </div>
    </div>
  );
};

// ── ID de dialogue possible ──
type DialogId = "statut" | "commande" | "enseignes" | "equipe" | "livraison" | null;

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
  const [dashboardOpen, setDashboardOpen] = useState(true); // ouvert par défaut pour montrer les cartes
  const [dialog, setDialog] = useState<DialogId>(null);

  // Pour le dialogue enseigne : quelle enseigne est affichée en détail
  const [dialogEnseigneIdx, setDialogEnseigneIdx] = useState<number | null>(null);

  // ── 🆕 Détection écarts BOM ──
  const [showBomDeviationDialog, setShowBomDeviationDialog] = useState(false);
  const [bomDeviations, setBomDeviations] = useState<Array<{
    section: string;
    material_name: string;
    material_id?: string;
    enseigne: string;
  }>>([]);
  const [bomUpdateProductId, setBomUpdateProductId] = useState<string | null>(null);

  // Récupérer tous les product_id des enseignes
  const allProductIds = (data.enseignes || []).flatMap(
    (e) => (e.produits || []).map((p) => p.id)
  );
  // Prendre le premier product_id (on suppose qu'un CDC a un produit principal)
  const primaryProductId = allProductIds[0] || null;

  // Charger la BOM si on a un product_id
  const { items: bomItems } = useProductBom(
    data.statut === "Brouillon" ? undefined : primaryProductId || undefined
  );

  // Détecter les écarts BOM après sauvegarde
  const detectBomDeviations = () => {
    if (!primaryProductId || bomItems.length === 0) return;
    
    const deviations: typeof bomDeviations = [];
    const bomMaterialIds = new Set(bomItems.map((b) => b.material_id).filter(Boolean));
    
    for (const enseigne of data.enseignes || []) {
      const sections = enseigne.materiauxSections || {};
      for (const [section, items] of Object.entries(sections)) {
        for (const item of items) {
          // Si le matériau a un material_id qui n'est pas dans la BOM
          if (item.material_id && !bomMaterialIds.has(item.material_id)) {
            deviations.push({
              section,
              material_name: item.nom,
              material_id: item.material_id,
              enseigne: enseigne.nom,
            });
          }
        }
      }
    }
    
    if (deviations.length > 0) {
      setBomDeviations(deviations);
      setBomUpdateProductId(primaryProductId);
      setShowBomDeviationDialog(true);
    }
  };

  // Ajouter les matériaux manquants à la BOM
  const handleAddToBom = async () => {
    if (!bomUpdateProductId || bomDeviations.length === 0) return;
    
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const items = bomDeviations.map((d, i) => ({
        product_id: bomUpdateProductId,
        section: d.section,
        material_id: d.material_id || null,
        material_name: d.material_name,
        unite: "unité",
        ordre: bomItems.length + i,
      }));
      
      const { error } = await supabase.from("product_bom").insert(items);
      if (error) throw error;
      
      setShowBomDeviationDialog(false);
      setBomDeviations([]);
    } catch (err) {
      console.error("Erreur ajout BOM:", err);
    }
  };

  const CAHIER_STATUSES: CahierStatus[] = [
    "Brouillon",
    "infographie",
    "demande",
    "Payé",
    "Livré",
  ];

  // Migration legacy → enseignes
  const migrateToNewFormat = (oldData: CahierDesChargesData): CahierDesChargesData => {
    if (oldData.enseignes && oldData.enseignes.length > 0) return oldData;
    const defaultEnseigne: Enseigne = {
      id: "enseigne-default",
      nom: "Enseigne principale",
      produits: [],
      details: {
        image_url: oldData.image_url,
        dimensions: oldData.dimensions || { largeur: 0, hauteur: 0 },
        technique: oldData.technique || { type_structure: "", method_fabrication: "" },
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
    handleChange({ equipe: [...data.equipe, { id: `eq-${Date.now()}`, nom: "", role: "" }] });
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

  // ── Matériaux (vue globale) ──
  const mutateSelectedEnseigneSections = (
    mutator: (sections: Record<string, MaterialItem[]>) => Record<string, MaterialItem[]>,
  ) => {
    if (selectedEnseigneFilter === "all") return;
    const idx = (data.enseignes || []).findIndex((e) => e.id === selectedEnseigneFilter);
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
        { id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random()}`, nom: "", quantite: 1, unite: "", section },
      ],
    }));
  };
  const addGlobalItemFromCatalog = (section: string, preset: Partial<MaterialItem>) => {
    mutateSelectedEnseigneSections((sections) => ({
      ...sections,
      [section]: [...(sections[section] || []), { id: crypto.randomUUID?.() || `mat-${Date.now()}-${Math.random()}`, nom: "", quantite: 1, unite: "", section, ...preset }],
    }));
  };
  const deleteGlobalItem = (section: string, idx: number) => {
    mutateSelectedEnseigneSections((sections) => {
      const arr = [...(sections[section] || [])];
      arr.splice(idx, 1);
      return { ...sections, [section]: arr };
    });
  };
  const changeGlobalItem = (section: string, idx: number, changes: Partial<MaterialItem>) => {
    mutateSelectedEnseigneSections((sections) => {
      const arr = [...(sections[section] || [])];
      arr[idx] = { ...arr[idx], ...changes };
      return { ...sections, [section]: arr };
    });
  };
  const globalMaterialsEditable = isEditMode && selectedEnseigneFilter !== "all";

  // ── Matériaux filtrés ──
  const getFilteredMaterials = () => {
    const flatten = (items: MaterialItem[]): MaterialItem[] => {
      const result: MaterialItem[] = [];
      for (const item of items) {
        // 🆕 Si c'est un groupe, ne pas ajouter l'item parent, juste ses enfants
        if (item.groupe_enfants && item.groupe_enfants.length > 0) {
          result.push(...item.groupe_enfants);
        } else {
          result.push(item);
        }
      }
      return result;
    };

    if (selectedEnseigneFilter === "all") {
      const allMaterials: Record<string, MaterialItem[]> = {};
      data.enseignes?.forEach((enseigne) => {
        if (enseigne.materiauxSections) {
          Object.entries(enseigne.materiauxSections).forEach(([section, items]) => {
            if (!allMaterials[section]) allMaterials[section] = [];
            allMaterials[section].push(...flatten(items));
          });
        }
      });
      return allMaterials;
    }
    const sel = data.enseignes?.find((e) => e.id === selectedEnseigneFilter);
    const sections = sel?.materiauxSections || {};
    const result: Record<string, MaterialItem[]> = {};
    for (const [section, items] of Object.entries(sections)) {
      result[section] = flatten(items);
    }
    return result;
  };
  const filteredMaterials = getFilteredMaterials();
  const existingSections = Object.keys(filteredMaterials).filter((k) => (filteredMaterials[k] || []).length > 0);
  const orderedKnown = DEFAULT_SECTIONS.filter((s) => existingSections.includes(s));
  const orderedUnknown = existingSections.filter((s) => !DEFAULT_SECTIONS.includes(s));
  const nonVides = [...orderedKnown, ...orderedUnknown];

  // ── Enseigne sélectionnée (pour l'image bannière) ──
  const selectedEnseigne =
    selectedEnseigneFilter !== "all" ? data.enseignes?.find((e) => e.id === selectedEnseigneFilter) : null;
  const enseignesCount = (data.enseignes || []).length;
  const equipeCount = data.equipe.length;
  const hasDeliveryAddr = !!data.deliveryAddress?.label || !!data.deliveryAddress?.lat;
  const totalMateriaux = nonVides.reduce((sum, k) => sum + (filteredMaterials[k] || []).length, 0);

  // Enseigne affichée dans le dialogue détail
  const dialogEnseigne = dialogEnseigneIdx != null ? (data.enseignes || [])[dialogEnseigneIdx] : null;

  return (
    <div className="w-full py-4 sm:py-6 space-y-4">
      {/* ========== HEADER ========== */}
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <div className="bg-blue-100 p-2 rounded-full mr-3">
            <FileSpreadsheet className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Cahier des charges</h2>
            {data.cdcNumero && (
              <p className="font-semibold mt-1 text-sm text-brand-orange">N° {data.cdcNumero}</p>
            )}
            <p className="font-medium mt-1 text-md text-gray-600">{data.titre}</p>
          </div>
        </div>
        {/* 🆕 Bouton Modifier / Aperçu */}
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setIsEditMode(!isEditMode)}>
            {isEditMode ? <><Eye size={16} className="mr-1" /> Aperçu</> : <><Pencil size={16} className="mr-1" /> Modifier</>}
          </Button>
          {isEditMode && (
            <Button variant="default" size="sm" onClick={(e) => { e.preventDefault(); onSave?.(data); }}>
              <Check size={16} className="mr-1" /> Enregistrer
            </Button>
          )}
        </div>
      </div>

      {/* ========== DASHBOARD COLLAPSIBLE ========== */}
      <div className="mb-4 border rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => setDashboardOpen(!dashboardOpen)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <StatusLine
              label={data.statut ?? "Brouillon"}
              status={getStatusLineState((data.statut as CahierStatus) ?? "Brouillon")}
            />
            <span className="text-sm text-gray-500 truncate">
              {enseignesCount} enseigne{enseignesCount !== 1 ? "s" : ""}
              {" · "}{equipeCount} membre{equipeCount !== 1 ? "s" : ""}
              {hasDeliveryAddr ? " · lieu défini" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            <span className="text-xs text-gray-400">{dashboardOpen ? "Fermer" : "Informations"}</span>
            {dashboardOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {dashboardOpen && (
          <div className="px-4 pb-4 border-t bg-gray-50/50">
            {data.description && <p className="text-sm text-gray-500 pt-3 pb-1">{data.description}</p>}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3">
              {/* ── Statut ── */}
              <DashboardCard icon={<Info size={14} className="text-blue-600" />} title="Statut" onClick={() => setDialog("statut")}>
                <p className="text-sm font-semibold">{data.statut ?? "Brouillon"}</p>
              </DashboardCard>

              {/* ── Commande ── */}
              <DashboardCard icon={<FileText size={14} className="text-indigo-600" />} title="Commande" onClick={() => setDialog("commande")}>
                <p className="text-sm font-semibold">{data.commande_id || "—"}</p>
              </DashboardCard>

              {/* ── Enseignes (avec miniatures) ── */}
              <DashboardCard icon={<Store size={14} className="text-purple-600" />} title="Enseignes" onClick={() => setDialog("enseignes")}>
                <p className="text-sm font-semibold">
                  {enseignesCount} enseigne{enseignesCount !== 1 ? "s" : ""}
                </p>
                {/* Galerie miniature des enseignes */}
                <div className="flex gap-1.5 mt-1.5 flex-wrap -ml-0.5">
                  {(data.enseignes || []).map((e) => (
                    <div key={e.id} className="relative group">
                      {e.details?.image_url ? (
                        <img
                          src={e.details.image_url}
                          alt={e.nom}
                          className="w-10 h-10 rounded-md object-cover border border-gray-200 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center">
                          <ImageIcon size={14} className="text-gray-400" />
                        </div>
                      )}
                      <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-gray-800 text-white rounded px-1 py-px opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                        {e.nom}
                      </span>
                    </div>
                  ))}
                </div>
              </DashboardCard>

              {/* ── Équipe ── */}
              <DashboardCard icon={<Users size={14} className="text-green-600" />} title="Équipe" onClick={() => setDialog("equipe")}>
                <p className="text-sm font-semibold">
                  {equipeCount} membre{equipeCount !== 1 ? "s" : ""}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {data.equipe.map((m) => (
                    <span key={m.id} className="text-[10px] bg-gray-100 rounded px-1.5 py-0.5 truncate max-w-[80px]">
                      {m.nom || "—"}
                    </span>
                  ))}
                </div>
              </DashboardCard>

              {/* ── Livraison ── */}
              <DashboardCard icon={<MapPin size={14} className="text-amber-600" />} title="Livraison" onClick={() => setDialog("livraison")}>
                {hasDeliveryAddr ? (
                  <p className="text-sm font-semibold truncate">{data.deliveryAddress!.label || "Adresse définie"}</p>
                ) : (
                  <p className="text-sm text-gray-400">Non définie</p>
                )}
              </DashboardCard>

              {/* ── Dimensions (enseigne sélectionnée) ── */}
              {selectedEnseigne && (
                <DashboardCard icon={<Ruler size={14} className="text-teal-600" />} title="Dimensions">
                  <p className="text-sm font-semibold">
                    L: {selectedEnseigne.details?.dimensions?.largeur || "—"} m · H: {selectedEnseigne.details?.dimensions?.hauteur || "—"} m
                  </p>
                  {selectedEnseigne.details?.technique?.type_structure && (
                    <p className="text-[10px] text-gray-500 truncate">{selectedEnseigne.details.technique.type_structure}</p>
                  )}
                </DashboardCard>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
                            DIALOGUES DÉTAIL
      ========================================================= */}

      {/* ── Dialogue STATUT ── */}
      <Dialog open={dialog === "statut"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Statut du CDC</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <StatusLine label={data.statut ?? "Brouillon"} status={getStatusLineState((data.statut as CahierStatus) ?? "Brouillon")} />
            {isEditMode && (
              <div>
                <Label className="text-xs">Modifier le statut</Label>
                <select
                  value={data.statut || "Brouillon"}
                  onChange={(e) => handleChange({ statut: e.target.value as CahierStatus })}
                  className="mt-1 w-full text-sm border rounded px-2 py-1.5"
                >
                  {CAHIER_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue COMMANDE ── */}
      <Dialog open={dialog === "commande"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Commande liée</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">ID commande</Label>
            <Input value={data.commande_id} disabled className="h-10" />
            <p className="text-xs text-gray-400">Identifiant de la commande associée à ce cahier des charges.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue ENSEIGNES ── */}
      <Dialog open={dialog === "enseignes"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enseignes</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {dialogEnseigneIdx != null && dialogEnseigne ? (
              /* Vue détail d'une enseigne */
              <div className="space-y-4">
                <button
                  onClick={() => setDialogEnseigneIdx(null)}
                  className="text-xs text-brand-orange hover:underline"
                >
                  ← Retour à la liste
                </button>

                {/* Image */}
                <div className="flex justify-center">
                  {dialogEnseigne.details?.image_url ? (
                    <img
                      src={dialogEnseigne.details.image_url}
                      alt={dialogEnseigne.nom}
                      className="max-h-48 rounded-lg object-contain border border-gray-200"
                    />
                  ) : (
                    <div className="h-32 w-full bg-gray-100 rounded-lg flex items-center justify-center">
                      <ImageIcon className="h-10 w-10 text-gray-300" />
                    </div>
                  )}
                  {isEditMode && (
                    <div className="mt-2 w-full">
                      <ImageUpload
                        imageUrl={dialogEnseigne.details?.image_url || ""}
                        onChange={(url) => updateEnseigne(dialogEnseigneIdx, { details: { ...dialogEnseigne.details, image_url: url } })}
                        isEditable={true}
                      />
                    </div>
                  )}
                </div>

                {/* Nom */}
                <div>
                  <Label className="text-xs">Nom</Label>
                  {isEditMode ? (
                    <Input
                      value={dialogEnseigne.nom}
                      onChange={(e) => updateEnseigne(dialogEnseigneIdx, { nom: e.target.value })}
                      className="h-10"
                    />
                  ) : (
                    <p className="text-sm font-semibold">{dialogEnseigne.nom}</p>
                  )}
                </div>

                {/* Dimensions */}
                <div>
                  <Label className="text-xs">Dimensions (m)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <div>
                      <Label className="text-[10px] text-gray-500">Largeur</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={dialogEnseigne.details?.dimensions?.largeur ?? 0}
                          onChange={(e) =>
                            updateEnseigne(dialogEnseigneIdx, {
                              details: {
                                ...dialogEnseigne.details,
                                dimensions: { ...dialogEnseigne.details?.dimensions, largeur: Number(e.target.value) },
                              },
                            })
                          }
                          className="h-9"
                        />
                      ) : (
                        <p className="text-sm">{dialogEnseigne.details?.dimensions?.largeur || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Hauteur</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={dialogEnseigne.details?.dimensions?.hauteur ?? 0}
                          onChange={(e) =>
                            updateEnseigne(dialogEnseigneIdx, {
                              details: {
                                ...dialogEnseigne.details,
                                dimensions: { ...dialogEnseigne.details?.dimensions, hauteur: Number(e.target.value) },
                              },
                            })
                          }
                          className="h-9"
                        />
                      ) : (
                        <p className="text-sm">{dialogEnseigne.details?.dimensions?.hauteur || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Profondeur</Label>
                      {isEditMode ? (
                        <Input
                          type="number"
                          value={dialogEnseigne.details?.dimensions?.profondeur ?? 0}
                          onChange={(e) =>
                            updateEnseigne(dialogEnseigneIdx, {
                              details: {
                                ...dialogEnseigne.details,
                                dimensions: { ...dialogEnseigne.details?.dimensions, profondeur: Number(e.target.value) },
                              },
                            })
                          }
                          className="h-9"
                        />
                      ) : (
                        <p className="text-sm">{dialogEnseigne.details?.dimensions?.profondeur || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Technique */}
                <div className="space-y-2">
                  <Label className="text-xs">Structure</Label>
                  {isEditMode ? (
                    <Input
                      value={dialogEnseigne.details?.technique?.type_structure || ""}
                      onChange={(e) =>
                        updateEnseigne(dialogEnseigneIdx, {
                          details: {
                            ...dialogEnseigne.details,
                            technique: { ...dialogEnseigne.details?.technique, type_structure: e.target.value },
                          },
                        })
                      }
                      className="h-9"
                      placeholder="Type de structure"
                    />
                  ) : (
                    <p className="text-sm">{dialogEnseigne.details?.technique?.type_structure || "—"}</p>
                  )}
                  <Label className="text-xs">Méthode de fabrication</Label>
                  {isEditMode ? (
                    <Textarea
                      value={dialogEnseigne.details?.technique?.method_fabrication || ""}
                      onChange={(e) =>
                        updateEnseigne(dialogEnseigneIdx, {
                          details: {
                            ...dialogEnseigne.details,
                            technique: { ...dialogEnseigne.details?.technique, method_fabrication: e.target.value },
                          },
                        })
                      }
                      rows={2}
                      className="text-sm"
                    />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{dialogEnseigne.details?.technique?.method_fabrication || "—"}</p>
                  )}
                </div>

                {/* Matériaux de cette enseigne */}
                <div>
                  <Label className="text-xs mb-1 block">
                    Matériaux : {dialogEnseigne.materiauxSections ? Object.values(dialogEnseigne.materiauxSections).flat().length : 0} item(s)
                  </Label>
                  <p className="text-xs text-gray-400">
                    Utilisez la section Matériaux ci-dessous en filtrant sur cette enseigne pour les modifier.
                  </p>
                </div>

                {/* Actions */}
                {isEditMode && (
                  <div className="flex justify-between pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        removeEnseigne(dialogEnseigneIdx);
                        setDialogEnseigneIdx(null);
                      }}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <Trash2 size={14} className="mr-1" /> Supprimer
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              /* Liste des enseignes */
              <div className="space-y-3">
                {(data.enseignes || []).map((enseigne, idx) => (
                  <div
                    key={enseigne.id}
                    onClick={() => setDialogEnseigneIdx(idx)}
                    className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                  >
                    {enseigne.details?.image_url ? (
                      <img
                        src={enseigne.details.image_url}
                        alt={enseigne.nom}
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                        <Store size={18} className="text-gray-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{enseigne.nom}</p>
                      <p className="text-[10px] text-gray-500">
                        {enseigne.materiauxSections
                          ? `${Object.values(enseigne.materiauxSections).flat().length} matériau(x)`
                          : "0 matériau"}
                        {enseigne.details?.dimensions?.largeur
                          ? ` · ${enseigne.details.dimensions.largeur}×${enseigne.details.dimensions.hauteur} m`
                          : ""}
                      </p>
                    </div>
                    <ChevronDown size={16} className="text-gray-400 -rotate-90 flex-shrink-0" />
                  </div>
                ))}

                {isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addEnseigne}
                    className="flex items-center text-brand-orange border-brand-orange hover:bg-brand-orange hover:text-white text-xs"
                  >
                    <PlusCircle className="h-3 w-3 mr-1" /> Ajouter une enseigne
                  </Button>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialog(null); setDialogEnseigneIdx(null); }}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue ÉQUIPE ── */}
      <Dialog open={dialog === "equipe"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Équipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {data.equipe.map((membre, index) => (
              <div key={membre.id} className="flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Input
                      value={membre.nom}
                      onChange={(e) => handleEquipeMembreChange(index, "nom", e.target.value)}
                      className="h-9 text-sm flex-1"
                      placeholder="Nom"
                    />
                    <Input
                      value={membre.role}
                      onChange={(e) => handleEquipeMembreChange(index, "role", e.target.value)}
                      className="h-9 text-sm w-24"
                      placeholder="Rôle"
                    />
                    <Button variant="ghost" size="sm" onClick={() => removeEquipeMembre(index)} className="text-red-500 h-9 w-9 p-0">
                      <Trash2 size={14} />
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-between w-full py-1">
                    <span className="text-sm font-medium">{membre.nom}</span>
                    <span className="text-xs text-gray-500">{membre.role}</span>
                  </div>
                )}
              </div>
            ))}
            {isEditMode && (
              <Button variant="outline" size="sm" onClick={addEquipeMembre} className="text-xs text-brand-orange">
                <PlusCircle className="h-3 w-3 mr-1" /> Ajouter un membre
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialogue LIVRAISON ── */}
      <Dialog open={dialog === "livraison"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adresse de livraison</DialogTitle>
          </DialogHeader>
          <AddressPicker
            value={data.deliveryAddress}
            onChange={(addr) => handleChange({ deliveryAddress: addr })}
            isEditable={isEditMode}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== MATÉRIAUX (toujours visible, en pleine surface) ========== */}
      <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 flex-wrap gap-2">
          <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            📦 Matériaux
            {nonVides.length > 0 && (
              <span className="inline-block bg-white text-gray-500 text-xs font-normal px-1.5 py-0.5 rounded-full">
                {totalMateriaux} matériau{totalMateriaux !== 1 ? "x" : ""}
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
                {selectedEnseigne.details?.dimensions?.largeur && nonVides.length ? " · " : ""}
                {nonVides.length > 0 ? `${totalMateriaux} matériau${totalMateriaux !== 1 ? "x" : ""}` : ""}
              </p>
            </div>
          </div>
        )}

        <div className="p-4">
          {isEditMode && selectedEnseigneFilter === "all" && (
            <p className="mb-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              ℹ️ Sélectionnez une enseigne précise ci-dessus pour modifier ses matériaux ici. La vue « Tous » agrège toutes les enseignes (lecture seule).
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
                : `Aucun matériau pour cette enseigne.${isEditMode ? " Sélectionnez « Tous » ou ajoutez-en via le bouton ci-dessous." : ""}`}
            </p>
          )}
        </div>
      </div>

      {isEditMode && (
        <div className="flex justify-end">
          <Button onClick={(e) => { e.preventDefault(); onSave?.(data); detectBomDeviations(); }} className="px-6">
            Enregistrer
          </Button>
        </div>
      )}

      {/* === 🆕 DIALOGUE ÉCARTS BOM === */}
      <Dialog open={showBomDeviationDialog} onOpenChange={setShowBomDeviationDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-brand-orange" />
              Nomenclature enrichie
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Le CDC contient{" "}
              <strong>{bomDeviations.length} matériau{bomDeviations.length > 1 ? "x" : ""}</strong>{" "}
              absent{bomDeviations.length > 1 ? "s" : ""} de la nomenclature du produit.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 max-h-48 overflow-y-auto">
              {bomDeviations.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>{d.material_name}</strong>
                    <span className="text-gray-500 ml-1">({d.section})</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => setShowBomDeviationDialog(false)}
            >
              Ignorer
            </Button>
            <Button
              onClick={handleAddToBom}
              className="bg-brand-orange hover:bg-orange-600 text-white gap-2"
            >
              <Wrench className="h-4 w-4" />
              Mettre à jour la nomenclature
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CahierDesChargesTemplate;
