// src/components/materials/MaterialCatalogForm.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import ImageUpload from "@/components/templates/shared/ImageUpload";
import {
  MaterialCatalogFormData,
  MATERIAL_CATEGORIES,
} from "@/types/materialCatalog";
import {
  fieldsForCategory,
  FIELD_META,
  styleFor,
  type MaterialField,
} from "./materialFields";

interface Props {
  data: MaterialCatalogFormData;
  onChange: (data: MaterialCatalogFormData) => void;
  readOnly?: boolean;
}

const numOrNull = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return isNaN(n) ? null : n;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h4 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
    {children}
  </div>
);

const MaterialCatalogForm: React.FC<Props> = ({ data, onChange, readOnly = false }) => {
  const set = (patch: Partial<MaterialCatalogFormData>) => onChange({ ...data, ...patch });
  const style = styleFor(data.categorie);
  const [colorDraft, setColorDraft] = useState("");

  const fields = fieldsForCategory(data.categorie);
  const specFields = fields.filter(
    (f) => !["cout_min", "cout_max", "cout_usinage", "couleurs"].includes(f),
  );
  const priceFields = fields.filter((f) => ["cout_min", "cout_max", "cout_usinage"].includes(f));
  const showColors = fields.includes("couleurs");

  const renderField = (f: MaterialField) => {
    const meta = FIELD_META[f];
    if (!meta) return null;
    const value = (data as any)[f];
    return (
      <div key={f}>
        <Label className="text-xs font-medium text-gray-500">{meta.label}</Label>
        <Input
          type={meta.kind === "number" ? "number" : "text"}
          value={value ?? ""}
          onChange={(e) =>
            set({
              [f]:
                meta.kind === "number"
                  ? numOrNull(e.target.value)
                  : e.target.value || null,
            } as Partial<MaterialCatalogFormData>)
          }
          placeholder={meta.placeholder}
          disabled={readOnly}
          className="h-10 mt-1"
        />
      </div>
    );
  };

  const addColor = (raw: string) => {
    const parts = raw.split(",").map((c) => c.trim()).filter(Boolean);
    if (!parts.length) return;
    const next = Array.from(new Set([...data.couleurs, ...parts]));
    set({ couleurs: next });
    setColorDraft("");
  };

  return (
    <div className="space-y-6">
      {/* Identité */}
      <Section title="Identité">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium text-gray-500">Matériau</Label>
            <Input
              value={data.materiau}
              onChange={(e) => set({ materiau: e.target.value })}
              placeholder="ex: Plexiglass"
              disabled={readOnly}
              className="h-11 mt-1 text-base font-medium"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-500">Catégorie</Label>
            <Select
              value={data.categorie}
              onValueChange={(v) => set({ categorie: v })}
              disabled={readOnly}
            >
              <SelectTrigger className="h-10 mt-1">
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                {MATERIAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="flex items-center gap-2">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${styleFor(c).iconBg}`}>
                        {styleFor(c).icon}
                      </span>
                      {c}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs font-medium text-gray-500">Identifiant (réf.)</Label>
            <Input
              type="number"
              value={data.external_id ?? ""}
              onChange={(e) => set({ external_id: numOrNull(e.target.value) })}
              placeholder="ex: 12"
              disabled={readOnly}
              className="h-10 mt-1"
            />
          </div>
        </div>
      </Section>

      {/* Spécifications (adaptatives) */}
      {specFields.length > 0 && (
        <Section title="Spécifications">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {specFields.map(renderField)}
          </div>
        </Section>
      )}

      {/* Couleurs — éditeur à puces */}
      {showColors && (
        <Section title="Couleurs disponibles">
          <div className={`rounded-xl border border-gray-200 p-3 ${style.softBg}`}>
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {data.couleurs.length === 0 && (
                <span className="text-xs text-gray-400 italic">Aucune couleur</span>
              )}
              {data.couleurs.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full pl-2.5 pr-1 py-0.5 text-xs text-gray-700 shadow-sm"
                >
                  {c}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => set({ couleurs: data.couleurs.filter((x) => x !== c) })}
                      className="rounded-full hover:bg-gray-100 p-0.5"
                      aria-label={`Retirer ${c}`}
                    >
                      <X className="h-3 w-3 text-gray-400" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!readOnly && (
              <div className="flex gap-2">
                <Input
                  value={colorDraft}
                  onChange={(e) => setColorDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addColor(colorDraft);
                    }
                  }}
                  placeholder="Ajouter une couleur puis Entrée…"
                  className="h-9 bg-white"
                />
                <button
                  type="button"
                  onClick={() => addColor(colorDraft)}
                  className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-white border border-gray-200 px-3 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Plus className="h-4 w-4" /> Ajouter
                </button>
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Tarifs */}
      {priceFields.length > 0 && (
        <Section title="Tarifs (FCFA)">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {priceFields.map(renderField)}
          </div>
        </Section>
      )}

      {/* Image */}
      <Section title="Visuel">
        <ImageUpload
          imageUrl={data.image_url || ""}
          onChange={(url) => set({ image_url: url || null })}
          isEditable={!readOnly}
        />
      </Section>
    </div>
  );
};

export default MaterialCatalogForm;
