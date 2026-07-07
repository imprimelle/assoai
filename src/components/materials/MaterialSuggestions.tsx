// src/components/materials/MaterialSuggestions.tsx
// Sélecteur de matériau depuis le catalogue (table `materials`), branché sur useMaterials.
// Réutilise le composant générique SearchableDropdown (PAS smartSearch, spécifique aux produits).

import React, { useMemo } from "react";
import { Package } from "lucide-react";
import { useMaterials } from "@/hooks/useMaterials";
import { formatCFA } from "@/utils/format";
import {
  SearchableDropdown,
  type DropdownItem,
} from "@/components/shared/SearchableDropdown";
import { MaterialCatalogEntry } from "@/types/materialCatalog";

interface Props {
  /** Restreint la recherche à une catégorie (nom de section = catégorie). "ALL" pour tout. */
  categorie?: string;
  onSelect: (entry: MaterialCatalogEntry) => void;
  placeholder?: string;
  className?: string;
}

const MaterialSuggestions: React.FC<Props> = ({
  categorie = "ALL",
  onSelect,
  placeholder = "Choisir depuis le catalogue…",
  className,
}) => {
  const { materials, isLoading } = useMaterials("", categorie);

  const byId = useMemo(() => {
    const m = new Map<string, MaterialCatalogEntry>();
    materials.forEach((e) => m.set(e.id, e));
    return m;
  }, [materials]);

  const items: DropdownItem[] = useMemo(
    () =>
      materials.map((e) => {
        const cost =
          e.cout_min != null ? ` • ${formatCFA(e.cout_min)}/${e.unite}` : "";
        const colors = e.couleurs.length ? ` • ${e.couleurs.join(", ")}` : "";
        return {
          id: e.id,
          label: `${e.materiau}${e.epaisseur ? ` ${e.epaisseur}` : ""}`,
          subtitle: `${e.format_standard || e.categorie}${colors}${cost}`,
          icon: React.createElement(Package, {
            className: "h-4 w-4 text-amber-500",
          }),
        };
      }),
    [materials],
  );

  return (
    <SearchableDropdown
      items={items}
      loading={isLoading}
      placeholder={placeholder}
      triggerPlaceholder={placeholder}
      emptyMessage={isLoading ? undefined : "Aucun matériau dans le catalogue"}
      showCount
      onSelect={(item) => {
        const entry = byId.get(item.id);
        if (entry) onSelect(entry);
      }}
      className={className}
    />
  );
};

export default MaterialSuggestions;
