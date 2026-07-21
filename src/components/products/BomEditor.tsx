// src/components/products/BomEditor.tsx
// Éditeur de nomenclature structurée — remplace le Textarea ManufacturingRules.
// Tableau par section avec autocomplete catalogue, formules mathématiques, quantités fixes.

import React, { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PlusCircle,
  Trash2,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Wrench,
} from "lucide-react";
import { useProductBom } from "@/hooks/useProductBom";
import { useMaterials } from "@/hooks/useMaterials";
import {
  BOM_SECTIONS,
  type BomSection,
  type ProductBomItem,
} from "@/types/productBom";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// ============================================================
// CONSTANTES
// ============================================================
const SECTION_COLORS: Record<string, string> = {
  Découpe: "border-l-rose-400 bg-rose-50/30",
  Éclairage: "border-l-amber-400 bg-amber-50/30",
  Outillage: "border-l-emerald-400 bg-emerald-50/30",
  Métal: "border-l-slate-400 bg-slate-50/30",
  Vinyl: "border-l-purple-400 bg-purple-50/30",
};

const SECTION_DOT: Record<string, string> = {
  Découpe: "bg-rose-400",
  Éclairage: "bg-amber-400",
  Outillage: "bg-emerald-400",
  Métal: "bg-slate-400",
  Vinyl: "bg-purple-400",
};

// ============================================================
// HELPERS
// ============================================================
function autoReference(section: string, index: number): string {
  const prefix = section.slice(0, 4);
  return `[${prefix}-${index + 1}]`;
}

// ============================================================
// COMPOSANT
// ============================================================
interface BomEditorProps {
  productId: string;
  isEditable?: boolean;
}

const BomEditor: React.FC<BomEditorProps> = ({
  productId,
  isEditable = true,
}) => {
  const { items, isLoading, addItem, updateItem, deleteItem } =
    useProductBom(productId);
  const { materials } = useMaterials("", "ALL");
  const [showHelp, setShowHelp] = useState(false);
  const [newSection, setNewSection] = useState<BomSection>("Découpe");

  // Grouper par section
  const bySection = useMemo(() => {
    const map = new Map<BomSection, ProductBomItem[]>();
    for (const sec of BOM_SECTIONS) map.set(sec, []);
    for (const item of items) {
      const sec = item.section as BomSection;
      if (BOM_SECTIONS.includes(sec)) {
        map.get(sec)!.push(item);
      }
    }
    return map;
  }, [items]);

  // Index des matériaux par ID
  const materialById = useMemo(() => {
    const m = new Map<string, MaterialCatalogEntry>();
    materials.forEach((e) => m.set(e.id, e));
    return m;
  }, [materials]);

  // Filtrer les matériaux par catégorie pour le select
  const materialsByCat = useMemo(() => {
    const map = new Map<string, MaterialCatalogEntry[]>();
    const all: MaterialCatalogEntry[] = [];
    for (const mat of materials) {
      all.push(mat);
      const key = mat.categorie;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(mat);
    }
    map.set("ALL", all);
    return map;
  }, [materials]);

  // Ajouter une nouvelle ligne
  const handleAdd = useCallback(async () => {
    const sectionItems = bySection.get(newSection) || [];
    await addItem({
      section: newSection,
      material_name: "",
      unite: "unité",
      ordre: sectionItems.length,
    });
  }, [newSection, bySection, addItem]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Chargement de la nomenclature...
      </div>
    );
  }

  const totalItems = items.length;

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-brand-orange" />
          <h3 className="text-lg font-semibold text-gray-800">
            Nomenclature
          </h3>
          {totalItems > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
              {totalItems} matériau{totalItems > 1 ? "x" : ""}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs text-gray-500 gap-1"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Aide aux formules
          {showHelp ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Panneau d'aide */}
      {showHelp && (
        <div className="bg-blue-50/70 border border-blue-100 rounded-lg p-3 text-xs space-y-1.5 text-gray-700">
          <p className="font-semibold text-blue-800">
            Variables disponibles dans les formules :
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              L = largeur (m)
            </code>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              H = hauteur (m)
            </code>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              P = profondeur
            </code>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              S = L×H (surface)
            </code>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              PER = 2×(L+H)
            </code>
            <code className="bg-white px-1.5 py-0.5 rounded border border-blue-100">
              d = diamètre/rayon
            </code>
          </div>
          <p className="text-blue-700 pt-1">
            Fonctions : <code>ceil(x)</code>, <code>floor(x)</code>,{" "}
            <code>round(x)</code>
          </p>
          <p className="text-gray-500">
            Exemples : <code>ceil(L*H*150)</code> (LED),{" "}
            <code>6*(L+H)/5.8</code> (tube carré),{" "}
            <code>L*H*1.05</code> (plexiglass)
          </p>
        </div>
      )}

      {/* Barre d'ajout rapide */}
      {isEditable && (
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={newSection}
            onValueChange={(v) => setNewSection(v as BomSection)}
          >
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOM_SECTIONS.map((sec) => (
                <SelectItem key={sec} value={sec}>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${SECTION_DOT[sec]}`}
                    />
                    {sec}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAdd}
            className="gap-1.5 text-brand-orange border-orange-200 hover:bg-orange-50 h-9"
          >
            <PlusCircle className="h-4 w-4" />
            Ajouter un matériau
          </Button>
        </div>
      )}

      {/* Tableau par section */}
      {BOM_SECTIONS.map((section) => {
        const sectionItems = bySection.get(section) || [];
        if (sectionItems.length === 0 && !isEditable) return null;

        return (
          <div key={section} className="space-y-0">
            {/* En-tête de section */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-l-4 bg-gray-50/50 ${
                SECTION_COLORS[section]
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${SECTION_DOT[section]}`}
              />
              <span className="text-sm font-semibold text-gray-700">
                {section}
              </span>
              <span className="text-xs text-gray-400">
                {sectionItems.length} matériau
                {sectionItems.length !== 1 ? "x" : ""}
              </span>
            </div>

            {/* Lignes de la section */}
            <div className="border border-t-0 border-gray-200 rounded-b-lg overflow-hidden">
              {sectionItems.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-400 italic">
                  Aucun matériau dans cette section
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {sectionItems.map((item, idx) => (
                    <BomRow
                      key={item.id}
                      item={item}
                      index={idx}
                      isEditable={isEditable}
                      materials={materialsByCat.get(section) || materials}
                      onUpdate={(changes) => updateItem(item.id, changes)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* État vide */}
      {totalItems === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
          <Wrench className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Aucune nomenclature définie
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Ajoutez des matériaux section par section pour ce produit.
          </p>
        </div>
      )}
    </div>
  );
};

// ============================================================
// LIGNE BOM — éditable inline
// ============================================================
interface BomRowProps {
  item: ProductBomItem;
  index: number;
  isEditable: boolean;
  materials: MaterialCatalogEntry[];
  onUpdate: (changes: Record<string, any>) => void;
  onDelete: () => void;
}

const BomRow: React.FC<BomRowProps> = ({
  item,
  index,
  isEditable,
  materials,
  onUpdate,
  onDelete,
}) => {
  const [mode, setMode] = useState<"formule" | "fixe">(
    item.formule ? "formule" : item.quantite_fixe != null ? "fixe" : "formule"
  );
  const [showMaterialSelect, setShowMaterialSelect] = useState(false);

  // Filtrer les matériaux par recherche locale
  const [search, setSearch] = useState(item.material_name);
  const filtered = materials.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.materiau.toLowerCase().includes(q) ||
      (m.epaisseur && m.epaisseur.toLowerCase().includes(q))
    );
  });

  const handleSelectMaterial = (mat: MaterialCatalogEntry) => {
    onUpdate({
      material_id: mat.id,
      material_name: mat.materiau + (mat.epaisseur ? ` ${mat.epaisseur}` : ""),
      unite: mat.unite || "unité",
    });
    setSearch(
      mat.materiau + (mat.epaisseur ? ` ${mat.epaisseur}` : "")
    );
    setShowMaterialSelect(false);
  };

  const handleFormulaChange = (val: string) => {
    if (mode === "formule") {
      // Tenter de détecter si c'est un nombre pur
      const n = Number(val);
      if (!isNaN(n) && val.trim() !== "") {
        onUpdate({ formule: null, quantite_fixe: n });
        setMode("fixe");
      } else {
        onUpdate({ formule: val || null, quantite_fixe: null });
      }
    }
  };

  const handleQtyChange = (val: string) => {
    const n = Number(val);
    if (!isNaN(n)) {
      onUpdate({ quantite_fixe: n, formule: null });
    }
  };

  const toggleMode = () => {
    if (mode === "formule") {
      setMode("fixe");
      onUpdate({ formule: null, quantite_fixe: item.quantite_fixe ?? 1 });
    } else {
      setMode("formule");
      onUpdate({ quantite_fixe: null, formule: item.formule ?? "L*H" });
    }
  };

  return (
    <div
      style={{ gridTemplateColumns: '5fr 3fr 2fr 1fr 2fr 2fr 2fr 1fr' }}
      className="grid gap-2 px-3 py-2 items-center text-sm hover:bg-gray-50/50 transition-colors">
      {/* Matériau — colonne principale */}
      <div className="col-span-5 relative">
        {isEditable ? (
          <>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                onUpdate({ material_name: e.target.value });
                setShowMaterialSelect(true);
              }}
              onFocus={() => setShowMaterialSelect(true)}
              onBlur={() => setTimeout(() => setShowMaterialSelect(false), 200)}
              placeholder="Nom du matériau..."
              className="h-8 text-sm border-gray-200"
            />
            {showMaterialSelect && filtered.length > 0 && (
              <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {materials.slice(0, 8).map((mat) => (
                  <button
                    key={mat.id}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-orange-50 flex items-center gap-2"
                    onMouseDown={() => handleSelectMaterial(mat)}
                  >
                    <span className="font-medium truncate">
                      {mat.materiau}
                      {mat.epaisseur ? ` ${mat.epaisseur}` : ""}
                    </span>
                    <span className="text-gray-400 ml-auto text-[10px]">
                      {mat.unite}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm truncate block">
            {item.material_id ? "✅ " : "📝 "}
            {item.material_name}
          </span>
        )}
      </div>

      {/* Formule / Qté fixe */}
      <div className="col-span-3 flex items-center gap-1">
        {isEditable ? (
          <>
            {mode === "formule" ? (
              <Input
                value={item.formule || ""}
                onChange={(e) => handleFormulaChange(e.target.value)}
                placeholder="ex: ceil(L*H*150)"
                className="h-8 text-xs font-mono border-gray-200"
              />
            ) : (
              <Input
                type="number"
                value={item.quantite_fixe ?? ""}
                onChange={(e) => handleQtyChange(e.target.value)}
                placeholder="Qté"
                className="h-8 text-xs w-20 border-gray-200"
                min={0}
                step={1}
              />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={toggleMode}
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
                >
                  {mode === "formule" ? "fx" : "#"}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                {mode === "formule"
                  ? "Basculer en quantité fixe"
                  : "Basculer en formule"}
              </TooltipContent>
            </Tooltip>
          </>
        ) : (
          <span className="text-xs font-mono text-gray-600 truncate">
            {item.formule || (item.quantite_fixe != null ? `×${item.quantite_fixe}` : "—")}
          </span>
        )}
      </div>

      {/* Unité */}
      <div className="col-span-2">
        {isEditable ? (
          <Input
            value={item.unite || ""}
            onChange={(e) => onUpdate({ unite: e.target.value })}
            className="h-8 text-xs border-gray-200"
            placeholder="unité"
          />
        ) : (
          <span className="text-xs text-gray-600">{item.unite}</span>
        )}
      </div>

      {/* Référence */}
      <div className="col-span-1">
        <span className="text-[10px] text-gray-400 font-mono">
          {item.reference || autoReference(item.section, index)}
        </span>
      </div>

      {/* Condition (optionnelle) */}
      <div className="col-span-2">
        {isEditable ? (
          <Input
            value={item.condition_expr || ""}
            onChange={(e) => onUpdate({ condition_expr: e.target.value || null })}
            placeholder="S>=1.05"
            className="h-8 text-[10px] font-mono border-gray-200"
          />
        ) : (
          item.condition_expr && (
            <span className="text-[10px] text-amber-600 font-mono truncate block" title={item.condition_expr}>
              {item.condition_expr}
            </span>
          )
        )}
      </div>

      {/* Profil (optionnel) */}
      <div className="col-span-2 flex gap-1">
        {isEditable ? (
          <>
            <Input
              value={item.profile_group || ""}
              onChange={(e) => onUpdate({ profile_group: e.target.value || null, profile_value: item.profile_value || (e.target.value ? "" : null) })}
              placeholder="groupe"
              className="h-8 text-[10px] border-gray-200 w-1/2"
            />
            <Input
              value={item.profile_value || ""}
              onChange={(e) => onUpdate({ profile_value: e.target.value || null })}
              placeholder="valeur"
              className="h-8 text-[10px] border-gray-200 w-1/2"
            />
          </>
        ) : (
          item.profile_group && (
            <span className="text-[10px] text-purple-600 truncate block">
              {item.profile_group}={item.profile_value}
            </span>
          )
        )}
      </div>

      {/* Méta-variables (optionnel) */}
      <div className="col-span-2">
        {isEditable ? (
          <Input
            value={item.meta_variables ? JSON.stringify(item.meta_variables) : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              try {
                onUpdate({ meta_variables: v ? JSON.parse(v) : null });
              } catch {
                // Laisse l'utilisateur taper sans casser
              }
            }}
            placeholder='{"nb_lettres":null}'
            className="h-8 text-[10px] font-mono border-gray-200"
          />
        ) : (
          item.meta_variables && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] text-gray-500 font-mono truncate block cursor-default">
                  {JSON.stringify(item.meta_variables)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px] font-mono max-w-xs whitespace-pre-wrap">
                {JSON.stringify(item.meta_variables, null, 2)}
              </TooltipContent>
            </Tooltip>
          )
        )}
      </div>

      {/* Supprimer */}
      <div className="col-span-1 flex justify-end">
        {isEditable && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default BomEditor;
