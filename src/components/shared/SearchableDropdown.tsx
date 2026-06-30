import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Search, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ──────────────────────────────────────────────
// Surbrillance
// ──────────────────────────────────────────────

/** Surligne les tokens d'une recherche dans un texte. */
function highlightMatches(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokens = escaped.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return text;

  const pattern = tokens.map((t) => `(${t})`).join("|");
  const regex = new RegExp(pattern, "gi");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <mark key={key++} className="bg-amber-200 text-amber-900 rounded-sm px-0.5">
        {match[0]}
      </mark>
    );
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length > 0 ? <>{parts}</> : text;
}

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface DropdownItem {
  id: string;
  /** Texte principal affiché (et surligné) */
  label: string;
  /** Texte secondaire (optionnel) */
  subtitle?: string;
  /** Icône à gauche (optionnel) */
  icon?: React.ReactNode;
}

export interface SearchableDropdownProps<T extends DropdownItem> {
  items: T[];
  loading?: boolean;
  placeholder?: string;
  emptyMessage?: string;
  /** Afficher le compteur « X sur Y » */
  showCount?: boolean;
  /** Appelé quand l'utilisateur sélectionne un item */
  onSelect: (item: T) => void;
  /** Valeur affichée dans le trigger */
  triggerValue?: string;
  triggerPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

// ──────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────

const DEBOUNCE_MS = 200;

export function SearchableDropdown<T extends DropdownItem>({
  items,
  loading = false,
  placeholder = "Rechercher...",
  emptyMessage,
  showCount = false,
  onSelect,
  triggerValue,
  triggerPlaceholder = "Sélectionner...",
  disabled = false,
  className,
  /** Appelé quand le dropdown s'ouvre (pour lazy-load) */
  onOpen,
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Debounce ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(search),
      DEBOUNCE_MS
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  // Nettoyer à la fermeture
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDebouncedSearch("");
      setActiveIndex(0);
    }
  }, [open]);

  // ── Fermer au clic extérieur ──
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ── Focus input à l'ouverture ──
  useEffect(() => {
    if (open && inputRef.current) {
      // Petit délai pour que le rendu soit fait
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  // ── Filtrage ──
  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const q = debouncedSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle || "").toLowerCase().includes(q)
    );
  }, [items, debouncedSearch]);

  // Reset activeIndex quand la liste filtrée change
  useEffect(() => {
    setActiveIndex(0);
  }, [filtered.length]);

  // ── Hauteur max dynamique ──
  const [maxH, setMaxH] = useState(300);
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        const vh = window.innerHeight;
        setMaxH(Math.max(150, Math.min(500, Math.floor(vh * 0.5) - 60)));
      }, 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ── Scroll actif dans la vue ──
  useEffect(() => {
    if (listRef.current && activeIndex >= 0) {
      const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  // ── Handlers ──
  const selectItem = useCallback(
    (item: T) => {
      onSelect(item);
      setOpen(false);
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[activeIndex]) selectItem(filtered[activeIndex]);
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  };

  // ── Ouvrir/fermer ──
  const toggleOpen = useCallback(() => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (next && onOpen) onOpen();
  }, [open, disabled, onOpen]);

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
          "ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          !triggerValue && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-50"
        )}
        onClick={toggleOpen}
        disabled={disabled}
      >
        <span className="truncate">{triggerValue || triggerPlaceholder}</span>
        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute left-0 z-50 mt-1 w-full min-w-[280px] rounded-md border bg-white shadow-lg",
            "animate-in fade-in-0 zoom-in-95"
          )}
          style={{ maxWidth: "calc(100vw - 2rem)" }}
        >
          {/* Barre de recherche */}
          <div className="relative flex items-center border-b">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              className="flex h-10 w-full rounded-t-md bg-transparent pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground"
              placeholder={placeholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm opacity-50 hover:opacity-100"
                aria-label="Effacer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Compteur */}
          {showCount && debouncedSearch.trim() && !loading && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground border-b bg-gray-50/50">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              {filtered.length > 0 && filtered.length < items.length && (
                <span className="text-gray-400"> sur {items.length}</span>
              )}
            </div>
          )}

          {/* Liste */}
          <ul
            ref={listRef}
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: maxH, WebkitOverflowScrolling: "touch" }}
            role="listbox"
          >
            {loading ? (
              <li className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Chargement...
              </li>
            ) : filtered.length === 0 ? (
              <li className="py-6 text-center text-sm text-muted-foreground">
                {emptyMessage || (debouncedSearch.trim()
                  ? `Aucun résultat pour « ${debouncedSearch} »`
                  : "Aucun élément")}
              </li>
            ) : (
              filtered.map((item, idx) => (
                <li
                  key={item.id}
                  role="option"
                  aria-selected={idx === activeIndex}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm",
                    "hover:bg-accent hover:text-accent-foreground",
                    idx === activeIndex && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => selectItem(item)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  {item.icon && (
                    <span className="shrink-0 text-muted-foreground">
                      {item.icon}
                    </span>
                  )}
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="font-medium truncate">
                      {debouncedSearch.trim()
                        ? highlightMatches(item.label, debouncedSearch)
                        : item.label}
                    </span>
                    {item.subtitle && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
