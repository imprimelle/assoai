// src/components/templates/shared/MaterialTable.tsx
// Présentation "à plat" des matériaux d'une enseigne (remplace l'empilement
// MaterialSection > MaterialCard dépliables). Objectif : édition inline directe,
// filtres par catégorie, champs avancés à la demande. Voir maquette cdc-materiaux.
import React, { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2, Settings2, Plus, ChevronDown, ChevronUp } from "lucide-react";
import MaterialSuggestions from "@/components/materials/MaterialSuggestions";
import { UNITES, COULEURS, EPAISSEURS, withCurrent } from "@/constants/materials";
import type { MaterialItem } from "@/types";
import type { MaterialCatalogEntry } from "@/types/materialCatalog";

// Une ligne combine l'item + sa catégorie (= nom de section) + son index dans la section.
export interface FlatMaterialRow {
  section: string;
  index: number;
  item: MaterialItem;
}

interface MaterialTableProps {
  /** Matériaux groupés par catégorie (materiauxSections). */
  sections: Record<string, MaterialItem[]>;
  /** Catégories connues (pour l'ordre + l'ajout de section). */
  knownCategories: string[];
  isEditable?: boolean;
  onAddItem: (section: string) => void;
  onDeleteItem: (section: string, index: number) => void;
  onChangeItem: (section: string, index: number, changes: Partial<MaterialItem>) => void;
  onAddFromCatalog?: (section: string, preset: Partial<MaterialItem>) => void;
}

// Couleurs de badge par catégorie (fallback neutre pour les catégories non standard).
const catBadge: Record<string, string> = {
  Découpe: "bg-red-100 text-red-700",
  Éclairage: "bg-yellow-100 text-yellow-700",
  Outillage: "bg-green-100 text-green-700",
  Métal: "bg-gray-200 text-gray-700",
  Vinyl: "bg-purple-100 text-purple-700",
};
const badgeClass = (cat: string) => catBadge[cat] || "bg-blue-100 text-blue-700";

const fmtNum = (n?: number) => {
  if (n === undefined || n === null || Number.isNaN(n)) return "0";
  return Number(n.toFixed(2)).toLocaleString("fr-FR");
};

const surfaceOf = (it: MaterialItem) =>
  it.largeur && it.hauteur
    ? (it.largeur * it.hauteur * (it.quantite || 1)).toFixed(2)
    : null;

const showHauteurFor = (cat: string) => ["Découpe", "Vinyl"].includes(cat);
const showCouleurFor = (cat: string, it: MaterialItem) =>
  ["Éclairage", "Vinyl", "Découpe"].includes(cat) ||
  (it.couleurs_dispo && it.couleurs_dispo.length > 0);
const showEpaisseurFor = (cat: string) => ["Métal", "Découpe"].includes(cat);

const MaterialTable: React.FC<MaterialTableProps> = ({
  sections,
  knownCategories,
  isEditable = false,
  onAddItem,
  onDeleteItem,
  onChangeItem,
  onAddFromCatalog,
}) => {
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Catégories réellement présentes (ordre : connues d'abord, inconnues ensuite).
  const presentCats = useMemo(() => {
    const existing = Object.keys(sections).filter(
      (k) => (sections[k] || []).length > 0,
    );
    const known = knownCategories.filter((c) => existing.includes(c));
    const unknown = existing.filter((c) => !knownCategories.includes(c));
    return [...known, ...unknown];
  }, [sections, knownCategories]);

  // Toutes les lignes à plat (respecte l'ordre des catégories).
  const rows: FlatMaterialRow[] = useMemo(() => {
    const out: FlatMaterialRow[] = [];
    presentCats.forEach((cat) => {
      (sections[cat] || []).forEach((item, index) => {
        out.push({ section: cat, index, item });
      });
    });
    return out;
  }, [presentCats, sections]);

  const visibleRows =
    activeCat === "all" ? rows : rows.filter((r) => r.section === activeCat);

  const countFor = (cat: string) => (sections[cat] || []).length;
  const totalCount = rows.length;

  const rowKey = (r: FlatMaterialRow) => `${r.section}-${r.item.id}`;
  const toggleExpand = (r: FlatMaterialRow) =>
    setExpanded((prev) => ({ ...prev, [rowKey(r)]: !prev[rowKey(r)] }));

  const handleNum = (
    r: FlatMaterialRow,
    field: "quantite" | "largeur" | "hauteur",
    raw: string,
  ) => {
    if (raw === "") {
      onChangeItem(r.section, r.index, {
        [field]: field === "quantite" ? 1 : 0,
      });
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    onChangeItem(r.section, r.index, { [field]: Math.max(0, parsed) });
  };

  const handleCatalog = (cat: string) => (entry: MaterialCatalogEntry) => {
    if (!onAddFromCatalog) return;
    onAddFromCatalog(cat, {
      nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
      unite: entry.unite,
      epaisseur: entry.epaisseur || undefined,
      largeur: entry.largeur_std ?? undefined,
      hauteur: entry.hauteur_std ?? undefined,
      reference: entry.external_id != null ? String(entry.external_id) : undefined,
      image_url: entry.image_url || undefined,
      material_id: entry.id,
      format_standard: entry.format_standard || undefined,
      cout_unitaire: entry.cout_min ?? undefined,
      couleurs_dispo: entry.couleurs.length ? entry.couleurs : undefined,
    });
  };

  // Catégorie ciblée pour un ajout : la catégorie active si filtrée, sinon la 1ʳᵉ connue.
  const addTargetCat =
    activeCat !== "all" ? activeCat : presentCats[0] || knownCategories[0];

  const cellInput =
    "h-9 border border-gray-200 rounded px-2 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";

  // Champs avancés (réf, couleur, épaisseur, image) — partagés desktop & mobile.
  const renderAdvanced = (r: FlatMaterialRow) => {
    const { item, section } = r;
    return (
      <div className="flex flex-wrap items-end gap-3 text-xs">
        <div>
          <Label className="block text-gray-500 mb-0.5">Référence</Label>
          <Input
            value={item.reference || ""}
            onChange={(e) =>
              onChangeItem(section, r.index, { reference: e.target.value })
            }
            className="h-8 w-32"
            placeholder="REF-001"
          />
        </div>
        {showCouleurFor(section, item) && (
          <div>
            <Label className="block text-gray-500 mb-0.5">Couleur</Label>
            <select
              value={item.couleur || ""}
              onChange={(e) =>
                onChangeItem(section, r.index, { couleur: e.target.value })
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">--</option>
              {withCurrent(
                item.couleurs_dispo && item.couleurs_dispo.length > 0
                  ? item.couleurs_dispo
                  : COULEURS,
                item.couleur,
              ).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
        {showEpaisseurFor(section) && (
          <div>
            <Label className="block text-gray-500 mb-0.5">Épaisseur</Label>
            <select
              value={item.epaisseur || ""}
              onChange={(e) =>
                onChangeItem(section, r.index, { epaisseur: e.target.value })
              }
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">--</option>
              {withCurrent(EPAISSEURS, item.epaisseur).map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <Label className="block text-gray-500 mb-0.5">Image / PDF</Label>
          <Input
            value={item.image_url || ""}
            onChange={(e) =>
              onChangeItem(section, r.index, { image_url: e.target.value })
            }
            className="h-8 w-56"
            placeholder="URL du fichier"
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Filtres catégories (chips) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCat("all")}
          className={`text-xs px-2.5 py-1 rounded-full transition ${
            activeCat === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Tous · {totalCount}
        </button>
        {presentCats.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCat(cat)}
            className={`text-xs px-2.5 py-1 rounded-full transition ${
              activeCat === cat
                ? "ring-2 ring-offset-1 ring-indigo-400 " + badgeClass(cat)
                : badgeClass(cat) + " opacity-80 hover:opacity-100"
            }`}
          >
            {cat} · {countFor(cat)}
          </button>
        ))}
      </div>

      {/* Sélecteur catalogue (ajout prérempli) */}
      {isEditable && onAddFromCatalog && addTargetCat && (
        <div>
          <MaterialSuggestions
            categorie={addTargetCat}
            onSelect={handleCatalog(addTargetCat)}
            placeholder={`Choisir un matériau ${addTargetCat} du catalogue…`}
          />
        </div>
      )}

      {visibleRows.length === 0 && (
        <p className="text-sm text-gray-500 italic">
          Aucun matériau{activeCat !== "all" ? ` dans « ${activeCat} »` : ""}.
        </p>
      )}

      {/* ===================== DESKTOP : tableau ===================== */}
      {visibleRows.length > 0 && (
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm border-separate border-spacing-y-1">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400">
                <th className="px-2 py-1 font-medium">Catégorie</th>
                <th className="px-2 py-1 font-medium">Matériau</th>
                <th className="px-2 py-1 font-medium text-center">Qté</th>
                <th className="px-2 py-1 font-medium">Unité</th>
                <th className="px-2 py-1 font-medium text-center">L (m)</th>
                <th className="px-2 py-1 font-medium text-center">H (m)</th>
                <th className="px-2 py-1 font-medium text-center">Surface</th>
                {isEditable && <th className="px-2 py-1" />}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => {
                const { item, section } = r;
                const surf = surfaceOf(item);
                const isOpen = !!expanded[rowKey(r)];
                return (
                  <React.Fragment key={rowKey(r)}>
                    <tr className="bg-gray-50">
                      <td className="px-2 py-1">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass(
                            section,
                          )}`}
                        >
                          {section}
                          {item.material_id && " 📦"}
                        </span>
                      </td>
                      <td className="px-2 py-1">
                        {isEditable ? (
                          <Input
                            value={item.nom}
                            onChange={(e) =>
                              onChangeItem(section, r.index, {
                                nom: e.target.value,
                              })
                            }
                            className={`${cellInput} w-44`}
                            placeholder="Nom du matériau"
                          />
                        ) : (
                          <span className="text-gray-900">{item.nom}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {isEditable ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={1}
                            value={item.quantite ?? 1}
                            onChange={(e) =>
                              handleNum(r, "quantite", e.target.value)
                            }
                            className={`${cellInput} w-16 text-center tabular-nums`}
                          />
                        ) : (
                          <span className="block text-center tabular-nums">
                            {fmtNum(item.quantite)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {isEditable ? (
                          <>
                            <Input
                              list={`unite-${item.id}`}
                              value={item.unite || ""}
                              onChange={(e) =>
                                onChangeItem(section, r.index, {
                                  unite: e.target.value,
                                })
                              }
                              className={`${cellInput} w-24`}
                              placeholder="ex: plaque"
                            />
                            <datalist id={`unite-${item.id}`}>
                              {withCurrent(UNITES, item.unite).map((u) => (
                                <option key={u} value={u} />
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <span className="text-gray-900">{item.unite}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {isEditable ? (
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={0.1}
                            value={item.largeur ?? 0}
                            onChange={(e) =>
                              handleNum(r, "largeur", e.target.value)
                            }
                            className={`${cellInput} w-16 text-center tabular-nums`}
                          />
                        ) : (
                          <span className="block text-center tabular-nums">
                            {fmtNum(item.largeur)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {showHauteurFor(section) ? (
                          isEditable ? (
                            <Input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              step={0.1}
                              value={item.hauteur ?? 0}
                              onChange={(e) =>
                                handleNum(r, "hauteur", e.target.value)
                              }
                              className={`${cellInput} w-16 text-center tabular-nums`}
                            />
                          ) : (
                            <span className="block text-center tabular-nums">
                              {fmtNum(item.hauteur)}
                            </span>
                          )
                        ) : (
                          <span className="block text-center text-gray-300">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1 text-center whitespace-nowrap">
                        {surf ? (
                          <span className="text-indigo-700 font-medium">
                            {surf} m²
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      {isEditable && (
                        <td className="px-2 py-1 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => toggleExpand(r)}
                            className="text-gray-400 hover:text-gray-700 p-1"
                            title="Champs avancés (réf, couleur, épaisseur, image)"
                          >
                            <Settings2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteItem(section, r.index)}
                            className="text-red-500 hover:text-red-700 p-1 ml-1"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                    {isEditable && isOpen && (
                      <tr className="bg-indigo-50/40">
                        <td colSpan={8} className="px-3 py-2 rounded-b">
                          {renderAdvanced(r)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================== MOBILE : mini-cartes ===================== */}
      {visibleRows.length > 0 && (
        <div className="md:hidden space-y-2">
          {visibleRows.map((r) => {
            const { item, section } = r;
            const surf = surfaceOf(item);
            const isOpen = !!expanded[rowKey(r)];
            return (
              <div
                key={rowKey(r)}
                className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${badgeClass(
                      section,
                    )}`}
                  >
                    {section}
                    {item.material_id && " 📦"}
                  </span>
                  {isEditable && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleExpand(r)}
                        className="text-gray-400 hover:text-gray-700 p-1"
                        title="Champs avancés"
                      >
                        <Settings2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(section, r.index)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditable ? (
                  <Input
                    value={item.nom}
                    onChange={(e) =>
                      onChangeItem(section, r.index, { nom: e.target.value })
                    }
                    className="w-full h-9 text-sm"
                    placeholder="Nom du matériau"
                  />
                ) : (
                  <p className="text-sm font-medium text-gray-900">{item.nom}</p>
                )}

                <div
                  className={`grid ${
                    showHauteurFor(section) ? "grid-cols-4" : "grid-cols-3"
                  } gap-2`}
                >
                  <div>
                    <Label className="text-[10px] text-gray-500">Qté</Label>
                    {isEditable ? (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={1}
                        value={item.quantite ?? 1}
                        onChange={(e) => handleNum(r, "quantite", e.target.value)}
                        className="w-full h-9 text-center text-sm tabular-nums"
                      />
                    ) : (
                      <p className="text-sm text-center tabular-nums">
                        {fmtNum(item.quantite)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">Unité</Label>
                    {isEditable ? (
                      <>
                        <Input
                          list={`unite-m-${item.id}`}
                          value={item.unite || ""}
                          onChange={(e) =>
                            onChangeItem(section, r.index, {
                              unite: e.target.value,
                            })
                          }
                          className="w-full h-9 text-xs px-1"
                          placeholder="plaque"
                        />
                        <datalist id={`unite-m-${item.id}`}>
                          {withCurrent(UNITES, item.unite).map((u) => (
                            <option key={u} value={u} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <p className="text-sm">{item.unite}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-[10px] text-gray-500">L (m)</Label>
                    {isEditable ? (
                      <Input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={0.1}
                        value={item.largeur ?? 0}
                        onChange={(e) => handleNum(r, "largeur", e.target.value)}
                        className="w-full h-9 text-center text-sm tabular-nums"
                      />
                    ) : (
                      <p className="text-sm text-center tabular-nums">
                        {fmtNum(item.largeur)}
                      </p>
                    )}
                  </div>
                  {showHauteurFor(section) && (
                    <div>
                      <Label className="text-[10px] text-gray-500">H (m)</Label>
                      {isEditable ? (
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          step={0.1}
                          value={item.hauteur ?? 0}
                          onChange={(e) => handleNum(r, "hauteur", e.target.value)}
                          className="w-full h-9 text-center text-sm tabular-nums"
                        />
                      ) : (
                        <p className="text-sm text-center tabular-nums">
                          {fmtNum(item.hauteur)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {surf && (
                  <div className="text-xs text-indigo-700">
                    Surface : <strong>{surf} m²</strong>
                  </div>
                )}

                {isEditable && isOpen && (
                  <div className="pt-2 border-t border-gray-200">
                    {renderAdvanced(r)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Ajout d'une ligne vierge dans la catégorie ciblée */}
      {isEditable && addTargetCat && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddItem(addTargetCat)}
          className="text-brand-orange border-brand-orange hover:bg-brand-orange hover:text-white gap-1.5"
        >
          <Plus size={16} /> Ajouter un matériau
          {activeCat !== "all" ? ` (${addTargetCat})` : ""}
        </Button>
      )}
    </div>
  );
};

export default MaterialTable;
