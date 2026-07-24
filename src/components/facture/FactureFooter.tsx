// src/components/facture/FactureFooter.tsx
// Footer sticky avec widget chat Wari — modes Modifier/Demander.
// v2: Highlights + scroll séquentiel, préchargement @produit, extractContent DOM,
//     Wari décide génération vs modification via le prompt (pas de bouton Générer).
// Adapté de CdcBuilderFooter.

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Bot,
  MessageCircle,
  MessageSquare,
  ChevronDown,
  Send,
  Loader2,
  User as UserIcon,
  Mic,
  MicOff,
  Pencil,
  Save,
  Wand2,
  Package,
  FileDown,
} from "lucide-react";
import { routeMessage } from "@/services/hermesRouter";
import type { FactureData, DetailItem, FactureAction, FactureFooterMessage } from "@/types";
import type { User } from "@/types/user";
import { formatCFA } from "@/utils/format";
import { useProducts } from "@/hooks/useProducts";
import { smartSearch } from "@/utils/productSearch";

export interface FactureFooterProps {
  data: FactureData;
  onDataChange: (data: FactureData) => void;
  user: User;
  persistentSessionId: string;
  onSave: () => void;
  saving: boolean;
  changeCount: number;
  messageId?: string;
  /** Toggle tout déplier/replier */
  allOpen?: boolean;
  onToggleAllOpen?: () => void;
  /** Téléchargement PDF */
  onDownloadPDF?: () => void;
  downloadingPDF?: boolean;
  /** Highlights après application d'actions */
  onHighlightsChange?: (highlights: Record<string, "added" | "modified">) => void;
}

// ── Produit préchargé (données complètes pour le prompt Wari) ──
interface PreloadedProduct {
  id: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  variant?: string;
  dimensions?: string;
  sku?: string;
}

// ── Parsing réponse Wari ──

function parseWariResponse(
  response: { textFallback?: string; factureActions?: FactureAction[] }
): { message: string; actions?: FactureAction[] } {
  if (response.factureActions?.length) {
    return { message: response.textFallback || '', actions: response.factureActions };
  }
  const text = response.textFallback || '';
  if (!text) return { message: text };
  try {
    const parsed = JSON.parse(text);
    if (parsed.actions && Array.isArray(parsed.actions)) {
      return { message: '', actions: parsed.actions };
    }
  } catch {}
  const patterns: RegExp[] = [
    /```(?:json)?\s*(\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?\})\s*```/,
    /\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const jsonStr = match[1] || match[0];
      try {
        const parsed = JSON.parse(jsonStr);
        if (Array.isArray(parsed.actions)) {
          return { message: text.replace(match[0], '').trim(), actions: parsed.actions };
        }
      } catch {}
    }
  }
  return { message: text };
}

// ── Extraction contenu DOM (walk récursif) ──

function extractContent(container: HTMLElement): {
  text: string;
  chips: { productId: string; name: string; price: number; variant?: string; dimensions?: string; sku?: string }[];
} {
  const chips: { productId: string; name: string; price: number; variant?: string; dimensions?: string; sku?: string }[] = [];
  let text = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.hasAttribute("data-product-id")) {
        const pid = el.getAttribute("data-product-id")!;
        const pname = el.getAttribute("data-product-name") || "";
        const pprice = Number(el.getAttribute("data-product-price") || "0");
        const pvariant = el.getAttribute("data-product-variant") || undefined;
        const pdims = el.getAttribute("data-product-dimensions") || undefined;
        const psku = el.getAttribute("data-product-sku") || undefined;
        chips.push({ productId: pid, name: pname, price: pprice, variant: pvariant, dimensions: pdims, sku: psku });
        text += " " + pname + " ";
      } else if (el.tagName === "BR") {
        text += "\n";
      } else {
        el.childNodes.forEach(walk);
      }
    }
  }

  container.childNodes.forEach(walk);
  return { text: text.replace(/\u00A0/g, " ").trim(), chips };
}

// ── Scroll animé (identique CdcBuilderFooter) ──

function smoothScrollTo(el: HTMLElement, duration = 800) {
  const target = el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2;
  const start = window.scrollY;
  const distance = target - start;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress < 0.5
      ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, start + distance * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const FactureFooter: React.FC<FactureFooterProps> = ({
  data,
  onDataChange,
  user,
  persistentSessionId,
  onSave,
  saving,
  changeCount,
  messageId,
  allOpen,
  onToggleAllOpen,
  onDownloadPDF,
  downloadingPDF = false,
  onHighlightsChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"modifier" | "demander">("modifier");
  const [messages, setMessages] = useState<FactureFooterMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Micro
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const productDropdownRef = useRef<HTMLDivElement>(null);
  const productWrapperRef = useRef<HTMLDivElement>(null);

  // ── @produit dropdown ──
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [activeProductIdx, setActiveProductIdx] = useState(0);
  const { products, isLoading: productsLoading } = useProducts("", "ALL");

  // 🆕 Produits préchargés (accumulés depuis les chips @produit)
  const [preloadedProducts, setPreloadedProducts] = useState<PreloadedProduct[]>([]);

  const flatProducts = useMemo(() => {
    const items: { id: string; label: string; price: number; imageUrl?: string | null; variant?: string; dimensions?: string; sku?: string; product?: any }[] = [];
    for (const p of products) {
      if (!p) continue;
      if (Array.isArray(p.variants) && p.variants.length > 0) {
        for (const v of p.variants) {
          if (!v || !v.price) continue;
          const dims = v.attributes?.dimensions || "";
          items.push({
            id: v.id || "",
            label: `${p.name} — ${v.name}`,
            price: v.price || 0,
            imageUrl: (v as any).image_url || p.main_image_url,
            variant: v.name,
            dimensions: dims,
            sku: v.sku || "",
            product: p,
          });
        }
      }
    }
    return items;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.toLowerCase().trim();
    if (!q) return flatProducts.slice(0, 12);
    const scored = smartSearch(q, products);
    const result = new Map<string, typeof flatProducts[0]>();
    for (const s of scored.slice(0, 8)) {
      result.set(s.product.id, { id: s.product.id, label: s.product.name || "", price: s.product.variants?.[0]?.price || 0, imageUrl: s.product.main_image_url, product: s.product });
    }
    return Array.from(result.values());
  }, [productQuery, products, flatProducts]);

  // Position dropdown
  const [productDropdownStyle, setProductDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (showProductDropdown && contentEditableRef.current) {
      const rect = contentEditableRef.current.getBoundingClientRect();
      setProductDropdownStyle({ position: "fixed", left: `${rect.left}px`, top: `${rect.top - 8}px`, transform: "translateY(-100%)", minWidth: `${Math.max(rect.width, 250)}px`, zIndex: 9999 });
    }
  }, [showProductDropdown, productQuery]);

  // Click outside
  useEffect(() => {
    if (!showProductDropdown) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!productWrapperRef.current?.contains(t) && !productDropdownRef.current?.contains(t)) setShowProductDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProductDropdown]);

  useEffect(() => { setActiveProductIdx(0); }, [productQuery]);

  // Autoscroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => { recognitionRef.current?.abort(); };
  }, []);

  // ── Nettoyer les précharges quand les articles changent ──
  useEffect(() => {
    // Garder seulement les produits qui sont encore référencés dans les articles
    const detailProductIds = new Set((data.details || []).map(d => (d as any).productId).filter(Boolean));
    setPreloadedProducts(prev => prev.filter(p => detailProductIds.has(p.id)));
  }, [data.details]);

  /** Construit le prompt Modifier — Wari décide s'il doit générer ou modifier */
  const buildModifierPrompt = (message: string, chips: { productId: string; name: string; price: number; variant?: string; dimensions?: string; sku?: string }[]): string => {
    const articlesText = (data.details || [])
      .map(
        (d, i) =>
          `  ${i + 1}. ${d.description || "(sans description)"} ×${d.quantite} = ${formatCFA(d.sous_total)}`,
      )
      .join("\n");

    // 🆕 Bloc produits : chips @produit (données complètes) + flat list enrichie (tjs présente)
    let preloadBlock = "";

    // 1. Produits sélectionnés via @ (données complètes avec dimensions)
    const allChips = [...chips];
    for (const pp of preloadedProducts) {
      if (!allChips.some(c => c.productId === pp.id)) {
        allChips.push({ productId: pp.id, name: pp.name, price: pp.price, variant: pp.variant, dimensions: pp.dimensions, sku: pp.sku });
      }
    }
    if (allChips.length > 0) {
      preloadBlock += "\n📦 PRODUITS SÉLECTIONNÉS (prix et dimensions exacts) :\n";
      for (const chip of allChips) {
        preloadBlock += `- ${chip.name} | Prix: ${formatCFA(chip.price)}`;
        if (chip.variant) preloadBlock += ` | Variante: ${chip.variant}`;
        if (chip.dimensions) preloadBlock += ` | Dims: ${chip.dimensions}`;
        if (chip.sku) preloadBlock += ` | SKU: ${chip.sku}`;
        preloadBlock += "\n";
      }
    }

    // 2. Flat list enrichie TOUJOURS présente (id|produit|variante|prix|dimensions|SKU)
    const topProducts = flatProducts.slice(0, 100);
    if (topProducts.length > 0) {
      preloadBlock += `\n📋 FLAT LIST (${topProducts.length} variantes — choisis la bonne selon les dimensions. Format: id|produit|variante|prix|dimensions|SKU) :\n`;
      for (const fp of topProducts) {
        preloadBlock += `${fp.id}|${fp.label}|${fp.price}`;
        if (fp.dimensions) preloadBlock += `|${fp.dimensions}`;
        if (fp.sku) preloadBlock += `|${fp.sku}`;
        preloadBlock += "\n";
      }
    }

    const isEmpty = !data.details || data.details.length === 0;
    const modeInstruction = isEmpty
      ? `\n🆕 MODE GÉNÉRATION : La facture est VIDE (aucun article). Tu dois GÉNÉRER une facture complète et cohérente.`
      : `\n✏️ MODE MODIFICATION : La facture a déjà ${data.details?.length || 0} article(s). Tu dois MODIFIER la facture existante.`;

    return `[Facture Builder — Wari]
${modeInstruction}

N°: ${data.factureNumero || "Brouillon"}
Date: ${data.dateEmission || "?"}
Client: ${data.client.nom || "?"}
Adresse: ${data.client.adresse || "?"}
Téléphone: ${data.client.telephone || "?"}
Statut: ${data.statut || "Brouillon"}

Articles:
${articlesText || "  (aucun article)"}

Remise: ${formatCFA(data.reduction ?? 0)}
Échéancier: ${data.echeancier || "—"}
Délai livraison: ${data.delaiLivraison || "—"}
Total: ${formatCFA(data.total)}
${preloadBlock}
Instruction de l'utilisateur: ${message}

⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
1. Une courte analyse (1-3 phrases) expliquant ce que tu fais et pourquoi.
2. Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.

Actions disponibles :
- updateClientField : { field: "nom"|"adresse"|"telephone", value: "..." }
- addDetail : { item: { description: "...", quantite: 1, prixUnitaire: 50000 } }
- updateDetail : { index: 0, changes: { quantite: 3 } }
- removeDetail : { index: 0 }
- setRemise : { value: 15000 }
- setStatut : { value: "Brouillon"|"demande"|"Vérifié"|"Payé"|"Livré" }
- setEcheancier : { value: "30% à la commande, 70% à la livraison" }
- setDelaiLivraison : { value: "2 semaines" }
- updateField : { field: "dateEmission", value: "2026-07-24" }

Exemple :
Analyse : j'ajoute un article "Forfait installation" et je passe le statut à "Vérifié".

{"actions": [
  {"type":"addDetail","item":{"description":"Forfait installation","quantite":1,"prixUnitaire":75000}},
  {"type":"setStatut","value":"Vérifié"}
]}

⚠️ Le JSON doit être valide — pas de virgule après le dernier élément, pas de commentaires.`;
  };

  /** Appliquer les actions Wari — avec highlights + scroll séquentiel */
  const applyActions = useCallback(
    (actions: FactureAction[]) => {
      let newData = JSON.parse(JSON.stringify(data)) as FactureData;
      const allHighlights: Record<string, "added" | "modified"> = {};
      const scrollOrder: string[] = [];

      for (const action of actions) {
        switch (action.type) {
          case "updateClientField": {
            if (action.field && action.value !== undefined) {
              newData = {
                ...newData,
                client: { ...newData.client, [action.field]: action.value },
              };
              const key = `client-${action.field}`;
              allHighlights[key] = "modified";
              scrollOrder.push(key);
            }
            break;
          }
          case "addDetail": {
            if (action.item) {
              const qte = action.item.quantite || 1;
              const prix = action.item.prixUnitaire || 0;
              const newItem: DetailItem = {
                id: crypto.randomUUID?.() || `detail-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                description: action.item.description || "",
                quantite: qte,
                prixUnitaire: prix,
                sous_total: qte * prix,
              };
              newData = {
                ...newData,
                details: [...(newData.details || []), newItem],
              };
              const idx = (newData.details || []).length - 1;
              const key = `detail-${idx}`;
              allHighlights[key] = "added";
              scrollOrder.push(key);
            }
            break;
          }
          case "updateDetail": {
            if (action.index != null && action.changes && newData.details?.[action.index]) {
              const updated = { ...newData.details[action.index], ...action.changes };
              updated.sous_total = Number(updated.quantite) * Number(updated.prixUnitaire);
              const newDetails = [...newData.details];
              newDetails[action.index] = updated;
              newData = { ...newData, details: newDetails };
              const key = `detail-${action.index}`;
              allHighlights[key] = "modified";
              scrollOrder.push(key);
            }
            break;
          }
          case "removeDetail": {
            if (action.index != null && newData.details?.[action.index]) {
              newData = { ...newData, details: newData.details.filter((_, i) => i !== action.index) };
            }
            break;
          }
          case "setRemise": {
            newData = { ...newData, reduction: action.value ?? 0 };
            allHighlights["remise"] = "modified";
            scrollOrder.push("remise");
            break;
          }
          case "setStatut": {
            newData = { ...newData, statut: action.value };
            allHighlights["statut"] = "modified";
            scrollOrder.push("statut");
            break;
          }
          case "setEcheancier": {
            newData = { ...newData, echeancier: action.value };
            allHighlights["echeancier"] = "modified";
            scrollOrder.push("echeancier");
            break;
          }
          case "setDelaiLivraison": {
            newData = { ...newData, delaiLivraison: action.value };
            allHighlights["delaiLivraison"] = "modified";
            scrollOrder.push("delaiLivraison");
            break;
          }
          case "updateField": {
            if (action.field) {
              (newData as any)[action.field] = action.value;
              const key = `field-${action.field}`;
              allHighlights[key] = "modified";
              scrollOrder.push(key);
            }
            break;
          }
        }
      }

      // Recalculer le total
      const base = (newData.details || []).reduce((sum, d) => sum + d.sous_total, 0);
      newData.total = base - (newData.reduction ?? 0);

      // Appliquer le state d'un coup
      console.log("[FactureFooter] applyActions: onDataChange avec", newData.details?.length || 0, "articles, total:", newData.total);
      onDataChange(newData);

      // Émettre les highlights
      if (onHighlightsChange && Object.keys(allHighlights).length > 0) {
        onHighlightsChange({ ...allHighlights });
      }

      // 🆕 Scroll séquentiel (identique CDC Builder)
      if (scrollOrder.length > 0) {
        setTimeout(async () => {
          for (const key of scrollOrder) {
            const el = document.querySelector(`[data-highlight-key="${key}"]`) as HTMLElement | null;
            if (el) {
              // Appliquer le flash
              const type = allHighlights[key];
              el.setAttribute("data-flash", type);
            }
            // Pause 1.5s entre chaque
            await new Promise<void>(r => setTimeout(r, 1500));
          }
        }, 100);
      }
    },
    [data, onDataChange, onHighlightsChange],
  );

  /** Envoyer un message */
  const handleSend = async () => {
    if (!contentEditableRef.current || loading) return;

    const { text, chips } = extractContent(contentEditableRef.current);
    if (!text && chips.length === 0) return;

    // 🆕 Ajouter les chips au préchargement
    if (chips.length > 0) {
      setPreloadedProducts(prev => {
        const existing = new Set(prev.map(p => p.id));
        const newProds: PreloadedProduct[] = [];
        for (const chip of chips) {
          if (!existing.has(chip.productId)) {
            const fp = flatProducts.find(p => p.id === chip.productId);
            newProds.push({
              id: chip.productId,
              name: chip.name,
              price: chip.price,
              variant: chip.variant,
              // BOM sera chargée plus tard si disponible
            });
          }
        }
        return [...prev, ...newProds];
      });
    }

    const displayText = text || chips.map(c => c.name).join(", ");
    const userMsg: FactureFooterMessage = { role: "user", text: displayText };
    setMessages((prev) => [...prev, userMsg]);

    // Vider le contenteditable
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "";
    }

    setLoading(true);
    setExpanded(true);

    try {
      const prompt = mode === "modifier"
        ? buildModifierPrompt(text, chips)
        : text;

      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
      };

      const response = await routeMessage(payload, "wari");
      const responseText = response.response.textFallback || "Aucune réponse.";

      if (mode === "modifier") {
        const parsed = parseWariResponse({
          textFallback: responseText,
          factureActions: (response.response as any).factureActions,
        });
        const actionsFound = parsed.actions?.length || 0;
        const debugInfo = actionsFound > 0
          ? ` [✅ ${actionsFound} action(s) appliquée(s)]`
          : " [⚠️ Aucune action trouvée — vérifie le format JSON]";
        setMessages((prev) => [
          ...prev,
          { role: "wari", text: (parsed.message || responseText) + debugInfo },
        ]);
        if (actionsFound > 0) {
          applyActions(parsed.actions!);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "wari", text: responseText },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "wari",
          text: `❌ Erreur: ${err.message || "Impossible de contacter Wari."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigation dropdown @produit
    if (showProductDropdown && filteredProducts.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveProductIdx((p) => (p + 1) % filteredProducts.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveProductIdx((p) => (p - 1 + filteredProducts.length) % filteredProducts.length); return; }
      if (e.key === "Enter") { e.preventDefault(); const fp = filteredProducts[activeProductIdx]; if (fp) insertProductChip(fp); return; }
      if (e.key === "Escape") { setShowProductDropdown(false); return; }
    }

    // Suppression d'une chip avec Backspace
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const offset = range.startOffset;
        if (offset === 0) {
          const prev = textNode.previousSibling;
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const el = prev as HTMLElement;
            if (el.hasAttribute("data-product-id")) {
              e.preventDefault();
              el.remove();
              if (textNode.textContent?.startsWith("\u00A0")) {
                textNode.textContent = textNode.textContent.slice(1);
              }
              return;
            }
          }
        }
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Insère une chip produit (contentEditable=false) dans le contenteditable */
  const insertProductChip = (prod: { id: string; label: string; price: number; imageUrl?: string | null; variant?: string; product?: any }) => {
    if (!contentEditableRef.current) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;
    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx < 0) return;

    const charBeforeAt = atIdx > 0 ? text[atIdx - 1] : " ";
    if (charBeforeAt !== " " && charBeforeAt !== "\n" && atIdx > 0) return;

    // Supprimer @query du nœud texte
    textNode.textContent = text.slice(0, atIdx) + text.slice(cursorPos);

    // Créer la chip
    const chip = document.createElement("span");
    chip.textContent = prod.label;
    chip.setAttribute("data-product-id", prod.id);
    chip.setAttribute("data-product-name", prod.label);
    chip.setAttribute("data-product-price", String(prod.price));
    if (prod.variant) chip.setAttribute("data-product-variant", prod.variant);
    if ((prod as any).dimensions) chip.setAttribute("data-product-dimensions", (prod as any).dimensions);
    if ((prod as any).sku) chip.setAttribute("data-product-sku", (prod as any).sku);
    chip.contentEditable = "false";
    chip.className =
      "inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-medium " +
      "bg-orange-100 text-orange-700 border border-orange-200 select-none cursor-default " +
      "align-middle whitespace-nowrap";

    // Insérer la chip + un espace après
    const space = document.createTextNode("\u00A0");
    const newRange = document.createRange();
    newRange.setStart(textNode, atIdx);
    newRange.collapse(true);
    newRange.insertNode(chip);
    chip.after(space);

    // Placer le curseur après l'espace
    const afterRange = document.createRange();
    afterRange.setStartAfter(space);
    afterRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(afterRange);
    setShowProductDropdown(false);
    setProductQuery("");
    contentEditableRef.current.focus();
  };

  /** Détecte @ dans le contenteditable */
  const handleContentEditableInput = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !contentEditableRef.current) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) { setShowProductDropdown(false); setProductQuery(""); return; }
    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx >= 0) {
      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
        setProductQuery(beforeCursor.slice(atIdx + 1).split(/\s/)[0]);
        setShowProductDropdown(true);
        return;
      }
    }
    setShowProductDropdown(false);
    setProductQuery("");
  }, []);

  // ── Reconnaissance vocale ──
  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.abort();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (contentEditableRef.current) {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const textNode = document.createTextNode(transcript + " ");
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          contentEditableRef.current.appendChild(document.createTextNode(transcript + " "));
        }
        contentEditableRef.current.focus();
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  // ── Hauteurs ──
  const chatHeight = 280;
  const actionBarHeight = 34;
  const inputBarHeight = 56;
  const collapsedSpacer = actionBarHeight + inputBarHeight + 10;
  const expandedSpacer = collapsedSpacer + chatHeight + 4;

  return (
    <>
      {/* Spacer */}
      <div
        style={{ height: expanded ? expandedSpacer : collapsedSpacer }}
        aria-hidden="true"
      />

      {/* Footer fixe */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col">
          {/* ── Barre d'actions ── */}
          <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
            {/* 💬 Discussion */}
            <button
              type="button"
              onClick={() => setExpanded((p) => !p)}
              className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
                expanded
                  ? "bg-orange-500/40 text-white"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
              title={expanded ? "Masquer la discussion" : "Afficher la discussion"}
            >
              <MessageSquare size={13} />
              <span>Discussion</span>
              {messages.length > 0 && !expanded && (
                <span className="min-w-[16px] h-[16px] flex items-center justify-center bg-orange-500 text-white text-[9px] font-bold rounded-full px-1">
                  {messages.length > 9 ? "9+" : messages.length}
                </span>
              )}
            </button>

            {/* Tout déplier/replier */}
            {onToggleAllOpen && (
              <button
                type="button"
                onClick={onToggleAllOpen}
                className="flex items-center justify-center w-7 h-7 rounded-lg text-xs
                           bg-white/10 text-white hover:bg-white/20 transition-all"
                title={allOpen ? "Tout replier" : "Tout déplier"}
              >
                <span className="text-xs">{allOpen ? "🔽" : "🔼"}</span>
              </button>
            )}

            {/* Séparateur */}
            <div className="w-px h-4 bg-white/20 mx-0.5" />

            {/* PDF */}
            {onDownloadPDF && (
              <button
                type="button"
                onClick={onDownloadPDF}
                disabled={downloadingPDF}
                className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-50"
                title="Télécharger en PDF"
              >
                {downloadingPDF ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <FileDown size={13} />
                )}
                <span>PDF</span>
              </button>
            )}

            {/* Sauvegarde avec badge compteur */}
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="relative flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all
                         bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
              title={messageId ? "Mettre à jour la facture" : "Sauvegarder la facture"}
            >
              {saving ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Save size={13} />
              )}
              <span>{messageId ? "MàJ" : "Sauver"}</span>
              {changeCount > 0 && !saving && (
                <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center
                               bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
                  {changeCount > 99 ? "99+" : changeCount}
                </span>
              )}
            </button>
          </div>

          {/* ── Chat expandé ── */}
          {expanded && (
            <div
              className="flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
              style={{ height: chatHeight }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  {mode === "modifier" ? (
                    <>
                      <Pencil size={13} className="text-orange-400" />
                      <span className="font-medium text-gray-300">Modifier la facture</span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={13} className="text-gray-400" />
                      <span className="font-medium text-gray-300">Discussion</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="text-gray-500 hover:text-gray-300 p-1"
                  title="Réduire"
                >
                  <ChevronDown size={15} />
                </button>
              </div>

              {/* Messages */}
              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5">
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-500 py-3">
                    {mode === "modifier"
                      ? "Décris les modifications. Wari détecte si la facture est vide (génération) ou remplie (modification)."
                      : "Pose une question à Wari à propos de cette facture."}
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "wari" && (
                      <div className="w-6 h-6 rounded-full bg-orange-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-orange-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed ${
                        msg.role === "user"
                          ? "bg-orange-600 text-white rounded-br-sm"
                          : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon size={12} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex gap-1.5 justify-start">
                    <div className="w-6 h-6 rounded-full bg-orange-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Loader2 size={12} className="text-orange-400 animate-spin" />
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-bl-sm">
                      Wari réfléchit…
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Barre de saisie (toujours visible) ── */}
          <div className="bg-gradient-to-t from-gray-100/80 via-gray-50/60 to-transparent backdrop-blur-lg border-t border-gray-200/30">
            <div className="flex items-center gap-1.5 px-3 py-2.5 max-w-6xl mx-auto min-h-[56px]">
              {/* Input pill */}
              <div className="flex-1 relative min-w-0" ref={productWrapperRef}>
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyDown={handleKeyDown}
                  onInput={handleContentEditableInput}
                  data-placeholder={
                    mode === "demander"
                      ? "Poser une question… @ pour citer un produit"
                      : "Décrire la modification… @ pour citer un produit"
                  }
                  className="w-full min-h-[40px] max-h-[120px] overflow-y-auto pl-9 pr-4 py-2 rounded-[20px] bg-white border border-gray-300
                             text-sm text-gray-700
                             focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none
                             shadow-sm transition-shadow
                             whitespace-pre-wrap break-words
                             empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
                />

                {/* Dropdown @produit */}
                {showProductDropdown && filteredProducts.length > 0 && createPortal(
                  <div ref={productDropdownRef} style={productDropdownStyle}
                    className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1">
                    {productsLoading && (
                      <div className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400">
                        <Loader2 size={12} className="animate-spin" /> Chargement…
                      </div>
                    )}
                    {filteredProducts.map((fp, idx) => (
                      <button key={fp.id} type="button"
                        onMouseDown={(e) => { e.preventDefault(); insertProductChip(fp); }}
                        className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                          idx === activeProductIdx ? "bg-orange-50 text-orange-700" : "text-gray-700 hover:bg-gray-50"
                        }`}>
                        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                          {fp.imageUrl ? (
                            <img src={fp.imageUrl} alt="" className="w-5 h-5 rounded object-cover" />
                          ) : (
                            <Package className="h-4 w-4 text-gray-400" />
                          )}
                        </span>
                        <span className="font-medium flex-1 truncate">{fp.label}</span>
                        <span className="text-[10px] text-gray-400 shrink-0">{formatCFA(fp.price)}</span>
                      </button>
                    ))}
                  </div>,
                  document.body
                )}

                {/* Micro dans l'input */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${
                    isListening
                      ? "text-red-500 animate-pulse"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                  title={isListening ? "Arrêter l'écoute" : "Dicter"}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>

              {/* Toggle Modifier / Demander */}
              <button
                type="button"
                onClick={() =>
                  setMode((prev) =>
                    prev === "modifier" ? "demander" : "modifier",
                  )
                }
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0 ${
                  mode === "modifier"
                    ? "bg-orange-600 text-white shadow-md shadow-orange-600/25"
                    : "bg-white text-gray-400 border border-gray-300 hover:text-gray-600 hover:border-gray-400"
                }`}
                title={
                  mode === "modifier"
                    ? "Mode Modifier — clic pour Demander"
                    : "Mode Demander — clic pour Modifier"
                }
              >
                {mode === "modifier" ? (
                  <Pencil size={15} />
                ) : (
                  <MessageCircle size={15} />
                )}
              </button>

              {/* Envoyer */}
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="flex items-center justify-center w-8 h-8 rounded-full
                           bg-orange-600 text-white hover:bg-orange-500 transition-all shrink-0
                           disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-orange-600/20"
                title="Envoyer"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default FactureFooter;
