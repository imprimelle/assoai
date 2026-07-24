// src/components/shared/UnifiedAtInput.tsx
// Champ unifié avec déclencheur @ → dropdown de suggestions.
// Fonctionne pour les produits (depuis la table products) et les clients (depuis l'historique).
// Inspiré de MaterialCell — @ déclenche la recherche, dropdown en portal.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Loader2, Package, User, Hash } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { formatCFA } from "@/utils/format";
import { smartSearch } from "@/utils/productSearch";

// ── Types ──

export interface AtSuggestion {
  id: string;
  label: string;
  subtitle: string;
  /** Données associées (produit complet ou client) */
  data: any;
  /** Type : produ

t ou client */
  kind: "product" | "variant" | "client";
  /** Icône optionnelle */
  icon?: React.ReactNode;
}

export type AtInputMode = "product" | "client";

export interface UnifiedAtInputProps {
  value: string;
  onChange: (value: string) => void;
  onSuggestionSelect?: (suggestion: AtSuggestion) => void;
  /** Mode : product = table products, client = historique factures/commandes/devis */
  mode: AtInputMode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Utilise un textarea multiligne au lieu d'un input simple */
  multiline?: boolean;
}

// ── Helpers ──

interface FlatProduct {
  id: string;
  label: string;
  price: number;
  imageUrl?: string | null;
  isVariant: boolean;
  parentName?: string;
}

function flattenProducts(products: any[]): FlatProduct[] {
  const items: FlatProduct[] = [];
  for (const p of products) {
    if (!p) continue;
    items.push({
      id: p.id,
      label: p.name || "Sans nom",
      price: p.variants?.[0]?.price || 0,
      imageUrl: p.main_image_url,
      isVariant: false,
    });
    if (Array.isArray(p.variants)) {
      for (const v of p.variants) {
        if (!v) continue;
        items.push({
          id: v.id || "",
          label: v.name || "Variante",
          price: v.price || 0,
          imageUrl: (v as any).image_url || p.main_image_url,
          isVariant: true,
          parentName: p.name,
        });
      }
    }
  }
  return items;
}

// ── Composant ──

const UnifiedAtInput: React.FC<UnifiedAtInputProps> = ({
  value,
  onChange,
  onSuggestionSelect,
  mode,
  placeholder = "Tapez @ pour chercher…",
  disabled = false,
  className = "",
  multiline = false,
}) => {
  // ── State dropdown ──
  const [showDropdown, setShowDropdown] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Données ──
  const { products, isLoading: productsLoading } = useProducts("", "ALL");
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientsFetched, setClientsFetched] = useState(false);

  // Charger les clients (lazy, au premier @)
  useEffect(() => {
    if (mode !== "client" || !showDropdown || clientsFetched) return;
    setClientsLoading(true);
    supabase
      .from("messages")
      .select("template_data")
      .not("template_data", "is", null)
      .in("template_type", ["facture", "commande", "devis"])
      .order("timestamp", { ascending: false })
      .then(({ data, error }) => {
        setClientsLoading(false);
        setClientsFetched(true);
        if (error || !data) return;
        const unique = new Map<string, any>();
        data.forEach((m: any) => {
          const c = m.template_data?.data?.client;
          if (c?.nom && !unique.has(c.nom)) unique.set(c.nom, c);
        });
        setClients(Array.from(unique.values()));
      });
  }, [mode, showDropdown, clientsFetched]);

  const flatProducts = useMemo(() => flattenProducts(products), [products]);

  // ── Suggestions filtrées ──
  const suggestions = useMemo((): AtSuggestion[] => {
    if (mode === "product") {
      if (!atQuery) {
        // Sans query : montrer les premiers produits (top 12)
        return flatProducts.slice(0, 12).map((fp) => ({
          id: fp.id,
          label: fp.isVariant ? `${fp.parentName} — ${fp.label}` : fp.label,
          subtitle: formatCFA(fp.price),
          data: fp,
          kind: fp.isVariant ? "variant" as const : "product" as const,
          icon: fp.imageUrl ? (
            <img src={fp.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
          ) : (
            <Package className="h-4 w-4 text-gray-400" />
          ),
        }));
      }
      // Avec query : smartSearch
      const scored = smartSearch(atQuery, products);
      const matchedIds = new Set<string>();
      const result: AtSuggestion[] = [];
      for (const s of scored.slice(0, 12)) {
        matchedIds.add(s.product.id);
        result.push({
          id: s.product.id,
          label: s.product.name || "",
          subtitle: formatCFA(s.product.variants?.[0]?.price || 0),
          data: { ...s.product, matchedVariants: s.allMatchedVariants },
          kind: "product",
          icon: s.product.main_image_url ? (
            <img src={s.product.main_image_url} alt="" className="w-5 h-5 rounded object-cover" />
          ) : (
            <Package className="h-4 w-4 text-gray-400" />
          ),
        });
        // Ajouter les variantes matchées
        for (const v of s.allMatchedVariants) {
          result.push({
            id: v.id,
            label: `${s.product.name} — ${v.name}`,
            subtitle: formatCFA(v.price || 0),
            data: { ...v, parentProduct: s.product.name },
            kind: "variant",
            icon: (v as any).image_url ? (
              <img src={(v as any).image_url} alt="" className="w-5 h-5 rounded object-cover" />
            ) : (
              <Hash className="h-4 w-4 text-gray-400" />
            ),
          });
        }
      }
      return result.slice(0, 12);
    }

    // Mode client
    const q = atQuery.toLowerCase();
    const filtered = clients.filter((c) =>
      c.nom?.toLowerCase().includes(q),
    );
    return filtered.slice(0, 12).map((c) => ({
      id: c.nom,
      label: c.nom,
      subtitle: [c.adresse, c.telephone].filter(Boolean).join(" • "),
      data: c,
      kind: "client",
      icon: <User className="h-4 w-4 text-gray-400" />,
    }));
  }, [mode, atQuery, flatProducts, products, clients]);

  // ── Handlers ──
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      onChange(raw);

      const atIdx = raw.lastIndexOf("@");
      if (atIdx >= 0) {
        const term = raw.slice(atIdx + 1);
        setAtQuery(term);
        setShowDropdown(true);
        setActiveIdx(0);
      } else {
        setShowDropdown(false);
        setAtQuery("");
      }
    },
    [onChange],
  );

  const handleSelect = useCallback(
    (sugg: AtSuggestion) => {
      // Remplacer le @query dans le texte
      const atIdx = value.lastIndexOf("@");
      if (atIdx >= 0) {
        const before = value.slice(0, atIdx);
        onChange(before + sugg.label);
      } else {
        onChange(sugg.label);
      }
      setShowDropdown(false);
      setAtQuery("");
      onSuggestionSelect?.(sugg);
      inputRef.current?.focus();
    },
    [value, onChange, onSuggestionSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((p) => (p + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((p) => (p - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[activeIdx]) handleSelect(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // ── Click outside ──
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = wrapperRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  // ── Position dropdown ──
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.bottom + 4}px`,
        minWidth: `${Math.max(rect.width, 300)}px`,
        maxWidth: "360px",
        zIndex: 9999,
      });
    }
  }, [showDropdown, atQuery]);

  const loading = mode === "product" ? productsLoading : clientsLoading;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {multiline ? (
        <textarea
          ref={inputRef as any}
          value={value}
          onChange={(e) => handleInputChange(e as any)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const atIdx = value.lastIndexOf("@");
            if (atIdx >= 0) {
              setAtQuery(value.slice(atIdx + 1));
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-sm text-gray-700
                     placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400
                     outline-none transition-shadow resize-none"
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            const atIdx = value.lastIndexOf("@");
            if (atIdx >= 0) {
              setAtQuery(value.slice(atIdx + 1));
              setShowDropdown(true);
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full h-9 border border-gray-200 rounded-lg px-3 bg-white text-sm text-gray-700
                     placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400
                     outline-none transition-shadow"
        />
      )}

      {showDropdown &&
        suggestions.length > 0 &&
        createPortal(
          <div
            ref={dropdownRef}
            style={dropdownStyle}
            className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1"
          >
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                <Loader2 size={12} className="animate-spin" />
                Chargement…
              </div>
            )}
            {suggestions.map((sugg, idx) => (
              <button
                key={sugg.id + (sugg.kind === "variant" ? "-v" : "")}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(sugg);
                }}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                  idx === activeIdx
                    ? "bg-orange-50 text-orange-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                  {sugg.icon || (
                    <Package className="h-4 w-4 text-gray-300" />
                  )}
                </span>
                <span className="font-medium flex-1 truncate">{sugg.label}</span>
                <span className="text-[10px] text-gray-400 shrink-0">{sugg.subtitle}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default UnifiedAtInput;
