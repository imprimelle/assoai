// src/components/materials/MaterialCatalogForm.tsx
import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import ImageUpload from "@/components/templates/shared/ImageUpload";
import {
  MaterialCatalogFormData,
  MATERIAL_CATEGORIES,
} from "@/types/materialCatalog";

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

const MaterialCatalogForm: React.FC<Props> = ({ data, onChange, readOnly = false }) => {
  const set = (patch: Partial<MaterialCatalogFormData>) =>
    onChange({ ...data, ...patch });

  const field = (
    label: string,
    value: string | number | null,
    onVal: (v: string) => void,
    placeholder = "",
    type: "text" | "number" = "text",
  ) => (
    <div>
      <Label className="text-xs font-medium text-gray-500">{label}</Label>
      <Input
        type={type}
        value={value ?? ""}
        onChange={(e) => onVal(e.target.value)}
        placeholder={placeholder}
        disabled={readOnly}
        className="h-10"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field("Matériau", data.materiau, (v) => set({ materiau: v }), "ex: Plexiglass")}
        <div>
          <Label className="text-xs font-medium text-gray-500">Catégorie</Label>
          <Select
            value={data.categorie}
            onValueChange={(v) => set({ categorie: v })}
            disabled={readOnly}
          >
            <SelectTrigger className="h-10">
              <SelectValue placeholder="Catégorie" />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {field("Épaisseur", data.epaisseur, (v) => set({ epaisseur: v || null }), "ex: 5mm")}
        {field("Unité", data.unite, (v) => set({ unite: v }), "plaque")}
        {field("Identifiant (external_id)", data.external_id, (v) => set({ external_id: numOrNull(v) }), "ex: 12", "number")}
      </div>

      {field("Format standard", data.format_standard, (v) => set({ format_standard: v || null }), "ex: Grande feuille - 4,20m/1,22m")}

      <div className="grid grid-cols-2 gap-4">
        {field("Largeur std (m)", data.largeur_std, (v) => set({ largeur_std: numOrNull(v) }), "4.20", "number")}
        {field("Hauteur std (m)", data.hauteur_std, (v) => set({ hauteur_std: numOrNull(v) }), "1.22", "number")}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {field("Coût min (FCFA)", data.cout_min, (v) => set({ cout_min: numOrNull(v) }), "", "number")}
        {field("Coût max (FCFA)", data.cout_max, (v) => set({ cout_max: numOrNull(v) }), "", "number")}
        {field("Usinage (FCFA)", data.cout_usinage, (v) => set({ cout_usinage: numOrNull(v) }), "", "number")}
      </div>

      <div>
        <Label className="text-xs font-medium text-gray-500">
          Couleurs disponibles (séparées par des virgules)
        </Label>
        <Input
          value={data.couleurs.join(", ")}
          onChange={(e) =>
            set({
              couleurs: e.target.value
                .split(",")
                .map((c) => c.trim())
                .filter(Boolean),
            })
          }
          placeholder="Transparent, Rouge, Bleu"
          disabled={readOnly}
          className="h-10"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {field("Puissance / Volt", data.puissance_volt ?? null, (v) => set({ puissance_volt: v || null }), "ex: 12V - 200 W")}
        {field("Étanchéité", data.etancheite ?? null, (v) => set({ etancheite: v || null }), "ex: Etanche")}
        {field("Indications", data.indications ?? null, (v) => set({ indications: v || null }), "ex: 25mm")}
      </div>

      <div>
        <Label className="text-xs font-medium text-gray-500">Image</Label>
        <ImageUpload
          imageUrl={data.image_url || ""}
          onChange={(url) => set({ image_url: url || null })}
          isEditable={!readOnly}
        />
      </div>
    </div>
  );
};

export default MaterialCatalogForm;
