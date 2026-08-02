// src/components/cdc-builder/CdcBuilderFooter.tsx
// Footer sticky avec widget chat Brico — modes Modifier/Demander.
// v7: bouton Discussion dans l'action bar, chat repositionné entre action bar et saisie.
//     Gestion @enseigne dans l'input. Bouton "Générer le CDC" quand projet sans CDC.

import React, { useState, useRef, useEffect, useCallback } from "react";
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
  LayoutGrid,
  Save,
  Wand2,
  Hash,
} from "lucide-react";
import { routeMessage } from "@/services/hermesRouter";
import { rowsToSections, sectionsToRows } from "./CdcBuilderTable";
import type {
  CdcBuilderState,
  BricoAction,
} from "@/types/cdcBuilder";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { User } from "@/types/user";
import { supabase } from "@/integrations/supabase/client";
import { useChatPersistence } from "@/hooks/useChatPersistence";
import type { ChatMessage } from "@/hooks/useChatPersistence";

/**
 * ⚠️ ZONE CRITIQUE — Contenteditable avec chips @enseigne
 *
 * Ce composant manipule directement le DOM (contenteditable + chips contentEditable="false").
 * Toute modification des handlers handleKeyDown / handleSelectEnseigne / handleContentEditableInput
 * doit respecter ces contraintes :
 *
 * 1. Les chips sont des <span contentEditable="false" data-enseigne-id="...">
 * 2. Backspace en position 0 d'un nœud texte suivant une chip → supprime la chip entière
 * 3. @ n'est détecté QUE si précédé d'un espace ou début de ligne
 * 4. Le dropdown @enseigne utilise onMouseDown (pas onClick) pour éviter le blur avant sélection
 * 5. extractContent() traverse le DOM — ne pas utiliser innerText
 */

export interface CdcBuilderFooterProps {
  state: CdcBuilderState;
  onStateChange: (state: CdcBuilderState) => void;
  user: User;
  persistentSessionId: string;
  /** 🆕 Identité stable du CDC — fournie par le parent, change uniquement quand on passe à un CDC différent */
  chatIdentity: string;
  /** 🆕 ID du projet lié (null si aucun projet) */
  projectId?: string | null;
  onHighlightsChange?: (
    highlights: Record<string, "added" | "modified">,
  ) => void;
  // ── Action bar props ──
  showConsolidated: boolean;
  onToggleConsolidated: () => void;
  allOpen: boolean;
  onToggleAllOpen: () => void;
  onSave: () => void;
  saving: boolean;
  changeCount: number;
  /** true = projet lié mais aucun CDC (pas de matériaux) — affiche le bouton "Créer un CDC" */
  hasProjectWithoutCdc?: boolean;
  /** Callback appelé quand Brico a généré un CDC depuis le bouton "Créer un CDC" */
  onCdcGenerated?: (state: CdcBuilderState) => void;
  /** 🆕 ID de l'enseigne à régénérer — déclenche un envoi auto à Brico */
  regenerateEnseigneId?: string | null;
  /** 🆕 Message utilisateur optionnel pour préciser la régénération */
  regenerateMessage?: string;
  /** 🆕 Callback pour vider l'ID après traitement */
  onClearRegenerate?: () => void;
}

/** Formate le nom d'une enseigne en version courte pour la chip : "Neon Tra..." */
function formatChipName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 12) + (parts[0].length > 12 ? "…" : "");
  return parts[0] + " " + parts[1].slice(0, 2) + "…";
}

/** Extrait le contenu du contenteditable : texte + chips */
function extractContent(container: HTMLElement): {
  text: string;
  chips: { enseigneId: string; name: string; shortName: string }[];
} {
  const chips: { enseigneId: string; name: string; shortName: string }[] = [];
  let text = "";

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.hasAttribute("data-enseigne-id")) {
        const eid = el.getAttribute("data-enseigne-id")!;
        const ename = el.getAttribute("data-enseigne-name") || "";
        chips.push({ enseigneId: eid, name: ename, shortName: el.textContent || "" });
        text += " @" + ename + " ";
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

/** 🆕 Convertit le markdown basique en HTML pour l'affichage dans le chat.
 *  Supporte : **gras**, *italique*, `code`, listes à puces, tableaux simples. */
function renderMarkdownToHtml(md: string): string {
  let html = md;

  // Échapper le HTML existant
  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // Code inline — traiter AVANT les autres formats
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-amber-400 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');

  // Gras
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');

  // Italique
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  // Tableaux : | col1 | col2 |
  const lines = html.split("\n");
  const result: string[] = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\|(.+)\|$/.test(line.trim())) {
      const trimmed = line.trim();
      // Ignorer les séparateurs (|---|---|)
      if (/^\|[\s\-:]+\|/.test(trimmed)) continue;
      if (!inTable) {
        result.push('<table class="w-full text-[11px] border-collapse border border-gray-600 rounded overflow-hidden my-1"><tbody>');
        inTable = true;
      }
      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
      result.push("<tr>" + cells.map(c => `<td class="border border-gray-600 px-2 py-1 text-gray-300">${c}</td>`).join("") + "</tr>");
    } else {
      if (inTable) { result.push("</tbody></table>"); inTable = false; }
      result.push(line);
    }
  }
  if (inTable) result.push("</tbody></table>");
  html = result.join("\n");

  // Listes à puces
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-gray-200">$1</li>');

  // Sauts de ligne
  html = html.replace(/\n/g, "<br>");

  return html;
}

function parseBricoResponse(
  response: { textFallback?: string; cdcActions?: BricoAction[] }
): { message: string; actions?: BricoAction[] } {
  // Niveau 0 : le backend a déjà extrait les actions → pas de re-parsing
  if (response.cdcActions?.length) {
    return { message: response.textFallback || '', actions: response.cdcActions };
  }

  const text = response.textFallback || '';
  if (!text) return { message: text };

  // Niveau 1 : la réponse entière est un JSON valide contenant "actions"
  try {
    const parsed = JSON.parse(text);
    if (parsed.actions && Array.isArray(parsed.actions)) {
      return { message: '', actions: parsed.actions };
    }
  } catch {}

  // Niveau 2 : extraction multi-patterns (```json, JSON inline)
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
          return {
            message: text.replace(match[0], '').trim(),
            actions: parsed.actions,
          };
        }
      } catch {}
    }
  }

  // Niveau 3 : échec — retour texte brut, pas d'actions
  return { message: text };
}

// ── Enrichissement catalogue materials (post-processing des actions Brico) ──

/** Mapping d'une entrée catalogue → MaterialItem partiel */
function catalogToMaterialFields(entry: any): Partial<MaterialItem> {
  return {
    nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
    unite: entry.unite,
    epaisseur: entry.epaisseur || undefined,
    reference: entry.external_id != null ? String(entry.external_id) : undefined,
    material_id: entry.id,
    format_standard: entry.format_standard || undefined,
    cout_unitaire: entry.cout_min ?? undefined,
    couleurs_dispo: entry.couleurs?.length ? entry.couleurs : undefined,
  };
}

/** Requête le catalogue materials pour un terme de recherche */
async function searchCatalog(query: string): Promise<any[]> {
  // Essayer d'abord par material_id (UUID exact)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)) {
    const { data } = await supabase.from("materials").select("*").eq("id", query).limit(1);
    if (data?.length) return data;
  }
  // Recherche par nom (premier mot, ilike)
  const searchTerm = query.split(/\s+/)[0];
  if (searchTerm.length < 2) return [];
  const { data } = await supabase
    .from("materials")
    .select("*")
    .ilike("materiau", `%${searchTerm}%`)
    .limit(5);
  return data || [];
}

/** Enrichit un MaterialItem avec les données du catalogue materials */
function applyCatalogMatch(item: MaterialItem, entry: any): MaterialItem {
  const fields = catalogToMaterialFields(entry);
  return {
    ...item,
    material_id: item.material_id || fields.material_id,
    reference: item.reference || fields.reference,
    cout_unitaire: item.cout_unitaire ?? fields.cout_unitaire,
    format_standard: item.format_standard || fields.format_standard,
    epaisseur: item.epaisseur || fields.epaisseur,
    unite: item.unite || fields.unite,
    couleurs_dispo: item.couleurs_dispo || fields.couleurs_dispo,
    // Ne pas écraser le nom s'il est déjà plus précis que le nom catalogue
    nom: item.nom || fields.nom || item.nom,
  };
}

/**
 * Post-processing : enrichit les actions Brico avec les données réelles
 * du catalogue materials (material_id, prix, formats, couleurs).
 * Garantit que chaque item a un material_id valide même si Brico a « oublié »
 * de consulter le catalogue.
 */
async function enrichActionsWithCatalog(
  actions: BricoAction[],
): Promise<BricoAction[]> {
  // 1. Collecter les items à enrichir (add, update, ET group)
  const itemsToEnrich: { actionIdx: number; item: MaterialItem }[] = [];
  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if ((a.type === "add" || a.type === "update") && a.item?.nom) {
      itemsToEnrich.push({ actionIdx: i, item: a.item });
    }
    // 🆕 Enrichir aussi les actions "group" (material_id de la feuille)
    if (a.type === "group" && a.groupe?.nom) {
      itemsToEnrich.push({
        actionIdx: i,
        item: {
          id: a.groupe.material_id || "",
          nom: a.groupe.nom,
          material_id: a.groupe.material_id,
          quantite: 1,
        } as MaterialItem,
      });
    }
  }
  if (itemsToEnrich.length === 0) return actions;

  // 2. Requêter le catalogue pour chaque item (déduplication par material_id)
  const cache = new Map<string, any>();
  const enriched = [...actions];

  for (const { actionIdx, item } of itemsToEnrich) {
    const searchKey = item.material_id || item.nom;
    if (!searchKey) continue;

    if (!cache.has(searchKey)) {
      const results = await searchCatalog(searchKey);
      cache.set(searchKey, results.length > 0 ? results[0] : null);
    }

    const match = cache.get(searchKey);
    if (match) {
      const a = enriched[actionIdx];
      if (a.type === "add") {
        enriched[actionIdx] = { ...a, item: applyCatalogMatch(item, match) };
      } else if (a.type === "update") {
        enriched[actionIdx] = {
          ...a,
          changes: {
            ...a.changes,
            material_id: a.changes?.material_id || match.id,
            reference: a.changes?.reference || String(match.external_id || ""),
            cout_unitaire: a.changes?.cout_unitaire ?? match.cout_min,
            format_standard: a.changes?.format_standard || match.format_standard,
            unite: a.changes?.unite || match.unite,
          },
        };
      } else if (a.type === "group" && a.groupe) {
        // 🆕 Enrichir la feuille du groupe avec les données catalogue
        const fields = catalogToMaterialFields(match);
        enriched[actionIdx] = {
          ...a,
          groupe: {
            ...a.groupe,
            material_id: a.groupe.material_id || match.id,
            nom: fields.nom || a.groupe.nom,
            format: fields.format_standard || a.groupe.format,
          },
        };
      }
    }
  }

  console.log(
    `[enrichCatalog] ${itemsToEnrich.length} items vérifiés, ${cache.size} requêtes catalogue`,
  );
  return enriched;
}

/** Scroll animé manuel — durée contrôlable (800ms, easing easeInOutCubic). */
function smoothScrollTo(el: HTMLElement, duration = 800) {
  const target =
    el.getBoundingClientRect().top +
    window.scrollY -
    window.innerHeight / 2;
  const start = window.scrollY;
  const distance = target - start;
  const startTime = performance.now();

  function step(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // easeInOutCubic
    const eased =
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    window.scrollTo(0, start + distance * eased);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

const CdcBuilderFooter: React.FC<CdcBuilderFooterProps> = ({
  state,
  onStateChange,
  user,
  persistentSessionId,
  chatIdentity,
  projectId,
  onHighlightsChange,
  showConsolidated,
  onToggleConsolidated,
  allOpen,
  onToggleAllOpen,
  onSave,
  saving,
  changeCount,
  hasProjectWithoutCdc = false,
  onCdcGenerated,
  regenerateEnseigneId,
  regenerateMessage,
  onClearRegenerate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"modifier" | "demander">("modifier");

  // 🆕 Persistence du fil de discussion via useChatPersistence
  // Architecture hybride : localStorage (cache instantané) + Supabase (source de vérité)
  const {
    messages,
    setMessages,
    loading: chatPersistenceLoading,
  } = useChatPersistence({
    chatIdentity,
    documentMessageId: state.savedMessageId || null,
    documentType: "cdc",
    agent: "brico",
  });

  const [loading, setLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false); // enrichissement catalogue en cours

  // Micro
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const contentEditableRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // ── @enseigne dropdown ──
  const [showEnseigneDropdown, setShowEnseigneDropdown] = useState(false);
  const [enseigneQuery, setEnseigneQuery] = useState("");
  const [activeEnseigneIdx, setActiveEnseigneIdx] = useState(0);
  /** Enseigne ciblée via @ dans l'input (null = Brico décide) */
  const [targetedEnseigneId, setTargetedEnseigneId] = useState<string | null>(null);
  const enseigneDropdownRef = useRef<HTMLDivElement>(null);
  const enseigneWrapperRef = useRef<HTMLDivElement>(null);

  // Filtrer les enseignes pour le dropdown @
  const filteredEnseignes = React.useMemo(() => {
    if (!enseigneQuery) return state.enseignes;
    const q = enseigneQuery.toLowerCase();
    return state.enseignes.filter((ens) =>
      ens.nom.toLowerCase().includes(q),
    );
  }, [state.enseignes, enseigneQuery]);

  // Position dropdown @enseigne
  const [enseigneDropdownStyle, setEnseigneDropdownStyle] = useState<React.CSSProperties>({});
  useEffect(() => {
    if (showEnseigneDropdown && contentEditableRef.current) {
      const rect = contentEditableRef.current.getBoundingClientRect();
      setEnseigneDropdownStyle({
        position: "fixed",
        left: `${rect.left}px`,
        top: `${rect.top - 8}px`, // au-dessus de l'input
        transform: "translateY(-100%)",
        minWidth: `${Math.max(rect.width, 250)}px`,
        zIndex: 9999,
      });
    }
  }, [showEnseigneDropdown, enseigneQuery]);

  // Click outside @enseigne dropdown
  useEffect(() => {
    if (!showEnseigneDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideWrapper = enseigneWrapperRef.current?.contains(target);
      const insideDropdown = enseigneDropdownRef.current?.contains(target);
      if (!insideWrapper && !insideDropdown) {
        setShowEnseigneDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEnseigneDropdown]);

  // Reset active enseigne idx quand la query change
  useEffect(() => {
    setActiveEnseigneIdx(0);
  }, [enseigneQuery]);

  // Autoscroll
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  // 🆕 Régénération enseigne — auto-envoi d'un message à Brico
  useEffect(() => {
    if (!regenerateEnseigneId) return;
    const ens = state.enseignes.find((e) => e.id === regenerateEnseigneId);
    if (!ens) {
      onClearRegenerate?.();
      return;
    }

    // Trouver l'index de l'enseigne
    const ensIdx = state.enseignes.findIndex((e) => e.id === regenerateEnseigneId);

    // 🆕 Info produit pour la BOM
    const productInfo = ens.produits?.length
      ? `\n📦 Produit(s) lié(s): ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
      : "";

    // Construire le prompt
    const prompt = `[CDC Builder — Mode Modifier]
Tu es Brico. Régénère TOUS les matériaux de cette enseigne à partir de zéro.

⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).

Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
CDC N°: ${state.cdcNumero || "?"}

🎯 Enseigne à régénérer : ${ens.nom} (enseigneIndex = ${ensIdx})${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}
Dimensions : ${ens.dimensions.largeur}×${ens.dimensions.hauteur}${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}` : ""} cm${
      ens.produits?.length ? `\n📦 Produit(s) lié(s): ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}` : ""
    }${
      regenerateMessage ? `\n\n💬 Précision de l'utilisateur : ${regenerateMessage}` : ""
    }

⚠️ INSTRUCTIONS :
1. Supprime TOUS les matériaux existants de cette enseigne (enseigneIndex=${ensIdx}) — utilise "delete" pour chaque item dans chaque section.
2. Recrée les 5 sections (Découpe, Éclairage, Outillage, Métal, Vinyl) avec des matériaux frais basés sur les règles de fabrication.
3. ${ens.produits?.length ? "Si un produit est lié, charge sa nomenclature (BOM) via product_bom." : "Utilise les règles de fabrication standards (manufacturing-rules)."}
4. 🔢 MULTIPLIE les quantités par le nombre d'exemplaires : cette enseigne doit être fabriquée en ${ens.quantite} exemplaire${ens.quantite > 1 ? "s" : ""}.
5. Respecte les dimensions de l'enseigne.${regenerateMessage ? "\n6. Applique la précision de l'utilisateur." : ""}
7. ⚠️ FORMAT : analyse + JSON actions (SANS triple-backticks).`;

    // Message utilisateur dans le chat
    const chatLabel = regenerateMessage
      ? `🔄 Régénérer « ${ens.nom} » — "${regenerateMessage}"`
      : `🔄 Régénérer « ${ens.nom} »`;
    setMessages((prev) => [...prev, { role: "user", text: chatLabel }]);
    setExpanded(true);
    setLoading(true);
    setMode("modifier");

    // Envoyer à Brico
    routeMessage(
      {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
        projectId: projectId || undefined,
      },
      "brico",
    )
      .then((response: any) => {
        const parsed = parseBricoResponse(response);
        setMessages((prev) => [
          ...prev,
          { role: "ai", agent: "brico", text: parsed.message || "✅ Matériaux régénérés." },
        ]);
        if (parsed.actions?.length) {
          applyActions(parsed.actions, false);
        }
        setLoading(false);
        onClearRegenerate?.();
      })
      .catch(() => {
        setMessages((prev) => [...prev, { role: "ai", agent: "brico", text: "❌ Erreur lors de la régénération." }]);
        setLoading(false);
        onClearRegenerate?.();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regenerateEnseigneId]);

  /** Enseigne ciblée (via @ ou null = Brico décide) */
  const targetedEnseigne = targetedEnseigneId
    ? state.enseignes.find((e) => e.id === targetedEnseigneId)
    : null;

  /** Filtre les matériaux valides (avec nom) pour éviter d'envoyer des lignes vides à Brico */
  const filterValidMaterials = (
    materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>>,
  ): Record<string, Record<string, MaterialItem[]>> => {
    const filtered: Record<string, Record<string, MaterialItem[]>> = {};
    for (const [ensId, sections] of Object.entries(materiauxByEnseigne)) {
      filtered[ensId] = {};
      for (const [section, items] of Object.entries(sections)) {
        const valid = items.filter((item) => item.nom && item.nom.trim());
        if (valid.length > 0) {
          filtered[ensId][section] = valid;
        }
      }
    }
    return filtered;
  };

  /** 🆕 Formate les groupes existants pour le prompt Brico */
  const formatGroupsForPrompt = (
    materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>>,
  ): string => {
    const lines: string[] = [];
    for (const [ensId, sections] of Object.entries(materiauxByEnseigne)) {
      for (const [section, items] of Object.entries(sections)) {
        for (const item of items) {
          const enfants = item.groupe_enfants;
          if (!enfants || enfants.length === 0) continue;
          const feuilleL = item.largeur ?? item.groupe_largeur ?? "?";
          const feuilleH = item.hauteur ?? item.groupe_hauteur ?? "?";
          const feuilleSurface = (item.largeur || 0) * (item.hauteur || 0);
          const occupee = enfants
            .filter(e => e.nom !== "Chute")
            .reduce((sum, e) => sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1), 0);
          const chute = Math.max(0, feuilleSurface - occupee);
          lines.push(`📐 [${section}] Feuille ${item.nom} (${feuilleL}×${feuilleH}cm, surface ${feuilleSurface.toFixed(2)}cm²) :`);
          for (const e of enfants) {
            const dims = e.largeur != null && e.hauteur != null ? ` (${e.largeur}×${e.hauteur}cm)` : "";
            lines.push(`    • ${e.nom}${dims} ×${e.quantite} ${e.unite || ""}`);
          }
          if (chute > 0.001) lines.push(`    • Chute ~${chute.toFixed(2)}m²`);
        }
      }
    }
    return lines.join("\n");
  };

  /** Construit le prompt Modifier — avec @ → focus + BOM, sans @ → toutes les enseignes */
  const buildModifierPrompt = (
    message: string,
    explicitTargetId?: string,
  ): string => {
    const targetId = explicitTargetId || targetedEnseigneId;
    const targetEns = targetId
      ? state.enseignes.find((e) => e.id === targetId)
      : null;

    // Contexte détaillé de TOUTES les enseignes (toujours inclus, filtré des lignes vides)
    const validMateriaux = filterValidMaterials(state.materiauxByEnseigne);
    const allEnseignesText = state.enseignes
      .map((ens, ensIdx) => {
        const sections = validMateriaux[ens.id] || {};
        const productInfo = ens.produits?.length
          ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
          : "";
        const sectionsText = Object.entries(sections)
          .filter(([, items]) => items.length > 0)
          .map(([section, items]) => {
            const lines = items.map((m) => {
              const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
              const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
              const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
              return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
            });
            return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
          })
          .join("\n\n");
        return `- [${ensIdx}] ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}cm` : ""}${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}\n${sectionsText || "    (aucun matériau)"}`;
      })
      .join("\n\n");

    // 🆕 Section groupes détaillés
    const groupsText = formatGroupsForPrompt(state.materiauxByEnseigne);
    const groupsBlock = groupsText
      ? `\n📐 Groupes Feuille existants (Découpe / Vinyl) :\n${groupsText}\n⚠️ Ces groupes existent déjà — ne pas les recréer. Tu peux ajouter des plaques dedans ou en créer de nouveaux si pertinent.`
      : "";

    const focusBlock = targetEns
      ? `\n🎯 Enseigne mentionnée par l'utilisateur: ${targetEns.nom} (enseigneIndex = ${state.enseignes.findIndex(e => e.id === targetEns.id)})
Dimensions: ${targetEns.dimensions.largeur}×${targetEns.dimensions.hauteur}${targetEns.dimensions.profondeur ? `×${targetEns.dimensions.profondeur}` : ""} cm${
          targetEns.produits?.length ? `\n📦 Produit(s) lié(s): ${targetEns.produits.map(p => `${p.nom} (id: ${p.id})`).join(", ")}` : ""
        }
⚠️ Recherche aussi sa nomenclature (BOM) si un produit est lié (product_id → table product_bom).`
      : `\n📋 Aucune enseigne spécifique mentionnée avec @ — voici le CDC complet. Détermine toi-même quelle(s) enseigne(s) modifier en fonction de la demande de l'utilisateur. Tu as TOUTES les sections et matériaux ci-dessus pour prendre ta décision.`;

    return `[CDC Builder — Mode Modifier]
Tu es Brico. Voici le CDC en cours de construction.

⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm). Pour les feuilles (groupe), utilise des valeurs en cm aussi (ex: 305 au lieu de 3.05 pour 3,05m).

Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
CDC N°: ${state.cdcNumero || "?"}
Commande N°: ${state.commandeId || "?"}

📋 Toutes les enseignes du CDC (avec leurs matériaux):
${allEnseignesText}
${groupsBlock}
${focusBlock}

Instruction de l'utilisateur: ${message}

⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
1. Une courte analyse (1-3 phrases) expliquant ce que tu modifies et pourquoi.
2. Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.

Exemple :
Analyse : j'ajoute du Forex 5mm dans la section Découpe car la demande concerne une bande rectangulaire. Quantité ajustée aux dimensions.

{"actions": [
  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"Forex 5mm","quantite":1,"unite":"plaque","largeur":5,"hauteur":70}}
]}

⚠️ Pour grouper des plaques en feuille, utilise le type "group" (sections Découpe et Vinyl uniquement). Les dimensions de la feuille (largeur_feuille, hauteur_feuille) et des plaques enfants sont en CM (ex: 305 pour 3,05m, 50 pour 0,5m).
⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne s'applique chaque action.
⚠️ 🔢 MULTIPLIE les quantités de TOUS les matériaux par le nombre d'exemplaires indiqué pour chaque enseigne.
   Ex: si [0] Façade ×3 exemplaires et qu'il faut 2 plaques par exemplaire → quantite=6 pour cette enseigne.
⚠️ Le JSON doit être valide — pas de virgule après le dernier élément, pas de commentaires.`;

  };

  /** Prompt pour la génération complète d'un CDC (bouton "Créer un CDC") */
  const buildGenerationPrompt = (): string => {
    const allEnseignesText = state.enseignes
      .map(
        (ens) => {
          const productInfo = ens.produits?.length
            ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
            : "";
          return `- ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}`;
        },
      )
      .join("\n");

    return `[CDC Builder — Génération complète]
Tu es Brico. Génère un Cahier des Charges complet pour ce projet.

⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm). Pour les feuilles (groupe), utilise des valeurs en cm (ex: 305 au lieu de 3.05 pour 3,05m).

Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
CDC N°: ${state.cdcNumero || "?"}
Commande N°: ${state.commandeId || "?"}

Enseignes à couvrir:
${allEnseignesText}

⚠️ Pour chaque enseigne qui a un 📦 product_id, interroge la table product_bom pour obtenir la nomenclature exacte. C'est ta source de vérité.

⚠️ INSTRUCTIONS CRITIQUES :
1. Pour CHAQUE enseigne, remplis les 5 sections (Découpe, Éclairage, Outillage, Métal, Vinyl) avec des matériaux pertinents.
2. Utilise tes connaissances des règles de fabrication (manufacturing-rules) pour déterminer les bons matériaux.
3. Les quantités doivent respecter les dimensions de chaque enseigne.
   🔢 MULTIPLIE les quantités par le nombre d'exemplaires (×N) de chaque enseigne.
4. 🆕 Pour les sections Découpe et Vinyl, regroupe les plaques compatibles en feuilles via des actions "group" quand c'est pertinent (même matériau, même épaisseur).
5. ⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
   a) Une analyse (2-4 phrases) résumant les matériaux générés pour chaque enseigne.
   b) Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.

Exemple :
Analyse : génération complète du CDC. Façade lumineuse : Plexiglass 5mm + LED Samsung 12V + profilé alu + kit visserie. Enseigne drapeau : Forex 3mm + vinyle rouge.

{"actions": [
  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"Plexiglass 5mm","quantite":1,"unite":"plaque","largeur":400,"hauteur":150}},
  {"type":"add","section":"Éclairage","enseigneIndex":0,"item":{"nom":"Bande LED 12V","quantite":12,"unite":"mètres"}},
  ...
]}

⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne appartient chaque matériau.`;
  };

  /** 🆕 Prompt Discussion — contexte CDC injecté directement (pas de JSON actions) */
  const buildDiscussionPrompt = (
    message: string,
    explicitTargetId?: string,
  ): string => {
    const targetId = explicitTargetId || targetedEnseigneId;
    const targetEns = targetId
      ? state.enseignes.find((e) => e.id === targetId)
      : null;

    const validMateriaux = filterValidMaterials(state.materiauxByEnseigne);

    // ── Avec @enseigne : focus sur UNE seule enseigne, matériaux détaillés ──
    if (targetEns) {
      const ensIdx = state.enseignes.findIndex((e) => e.id === targetEns.id);
      const sections = validMateriaux[targetEns.id] || {};
      const productInfo = targetEns.produits?.length
        ? `\n📦 Produit(s) lié(s): ${targetEns.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
        : "";

      const sectionsText = Object.entries(sections)
        .filter(([, items]) => items.length > 0)
        .map(([section, items]) => {
          const lines = items.map((m) => {
            const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
            const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
            const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
            return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
          });
          return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
        })
        .join("\n\n");

      return `Tu es Brico, l'ingénieur de conception d'Imprimelle. Tu es en DISCUSSION avec l'utilisateur sur le CDC Builder.

⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).

📋 Contexte du CDC :
Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
CDC N°: ${state.cdcNumero || "Brouillon"}
Commande N°: ${state.commandeId || "?"}

🎯 Enseigne mentionnée: ${targetEns.nom} (enseigneIndex=${ensIdx})
Dimensions: ${targetEns.dimensions.largeur}×${targetEns.dimensions.hauteur}${targetEns.dimensions.profondeur ? `×${targetEns.dimensions.profondeur}` : ""} cm${targetEns.quantite > 1 ? ` (×${targetEns.quantite} exemplaires)` : ""}${productInfo}

📐 Matériaux de cette enseigne :
${sectionsText || "    (aucun matériau)"}

💬 Question de l'utilisateur : ${message}

⚠️ Tu es en mode DISCUSSION (pas en mode modification). Réponds de façon conversationnelle, en texte simple avec émojis et markdown léger. N'utilise PAS de JSON d'actions. Base ta réponse sur le contexte ci-dessus.`;
    }

    // ── Sans @enseigne : contexte complet de TOUTES les enseignes ──
    const allEnseignesDetailed = state.enseignes
      .map((ens, ensIdx) => {
        const sections = validMateriaux[ens.id] || {};
        const productInfo = ens.produits?.length
          ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
          : "";
        const sectionsText = Object.entries(sections)
          .filter(([, items]) => items.length > 0)
          .map(([section, items]) => {
            const lines = items.map((m) => {
              const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
              const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
              const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
              return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
            });
            return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
          })
          .join("\n\n");
        return `- [${ensIdx}] ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}cm` : ""}${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}\n${sectionsText || "    (aucun matériau)"}`;
      })
      .join("\n\n");

    const groupsText = formatGroupsForPrompt(state.materiauxByEnseigne);
    const groupsBlock = groupsText
      ? `\n📐 Groupes Feuille existants (Découpe / Vinyl) :\n${groupsText}`
      : "";

    return `Tu es Brico, l'ingénieur de conception d'Imprimelle. Tu es en DISCUSSION avec l'utilisateur sur le CDC Builder.

⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).

📋 Contexte complet du CDC :
Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
CDC N°: ${state.cdcNumero || "Brouillon"}
Commande N°: ${state.commandeId || "?"}

📋 Toutes les enseignes du CDC (avec leurs matériaux):
${allEnseignesDetailed}${groupsBlock}

💬 Question de l'utilisateur : ${message}

⚠️ Tu es en mode DISCUSSION (pas en mode modification). Réponds de façon conversationnelle, en texte simple avec émojis et markdown léger. N'utilise PAS de JSON d'actions. Base ta réponse sur le contexte ci-dessus.`;
  };

  /** 🆕 Validation géométrique 1D : vérifie que les plaques peuvent tenir dans la feuille.
   *  Approximation conservative : somme des côtés les plus longs ≤ côté le plus long de la feuille.
   *  Retourne { ok: boolean, warning: string | null }
   */
  const validateGroupFit = (
    feuilleL: number,
    feuilleH: number,
    enfants: MaterialItem[],
  ): { ok: boolean; warning: string | null } => {
    const feuilleMax = Math.max(feuilleL, feuilleH);
    const feuilleMin = Math.min(feuilleL, feuilleH);
    let totalLong = 0;
    let totalShort = 0;
    const oversized: string[] = [];

    for (const e of enfants) {
      const el = e.largeur ?? 0;
      const eh = e.hauteur ?? 0;
      const eMax = Math.max(el, eh);
      const eMin = Math.min(el, eh);

      if (eMax > feuilleMax || eMin > feuilleMin) {
        oversized.push(`${e.nom || "plaque"} (${el}×${eh}cm)`);
      }
      totalLong += eMax * (e.quantite ?? 1);
      totalShort += eMin * (e.quantite ?? 1);
    }

    if (oversized.length > 0) {
      return {
        ok: false,
        warning: `⚠️ ${oversized.length} plaque(s) dépassent les dimensions de la feuille (${feuilleL}×${feuilleH}cm) : ${oversized.join(", ")}`,
      };
    }

    // Vérification conservative : somme des grands côtés vs grand côté feuille
    if (totalLong > feuilleMax * 1.05) {
      return {
        ok: false,
        warning: `⚠️ La somme des longueurs des plaques (${totalLong.toFixed(2)}cm) dépasse la longueur de la feuille (${feuilleMax}cm). Les plaques risquent de ne pas tenir.`,
      };
    }

    return { ok: true, warning: null };
  };

  /** Appliquer les actions Brico — application immédiate + scroll séquentiel (v9.1).
   * Toutes les données sont appliquées en une fois, puis l'écran slide
   * séquentiellement vers chaque ligne modifiée (1s entre chaque).
   * @param isGeneration true = génération complète (CDC vierge → rempli), false = modification
   */
  const applyActions = useCallback(
    async (actions: BricoAction[], isGeneration = false) => {
      if (state.enseignes.length === 0) return;

      // 🆕 Enrichir avec le catalogue materials (material_id, prix, formats)
      setCatalogLoading(true);
      const enrichedActions = await enrichActionsWithCatalog(actions);
      setCatalogLoading(false);

      // ── Phase 1 : appliquer toutes les actions immédiatement ──
      const newMateriaux = JSON.parse(
        JSON.stringify(state.materiauxByEnseigne),
      ) as typeof state.materiauxByEnseigne;
      const allHighlights: Record<string, "added" | "modified"> = {};
      // Ordre de scroll : [ { ensId, highlightKey } ]
      const scrollOrder: { ensId: string; key: string }[] = [];
      let anyModified = false;

      for (const action of enrichedActions) {
        const ensIdx =
          (action as any).enseigneIndex != null
            ? (action as any).enseigneIndex
            : 0;
        const targetEns = state.enseignes[ensIdx];
        if (!targetEns) continue;

        const ensId = targetEns.id;
        const currentSections = { ...(newMateriaux[ensId] || {}) };
        const section = [...(currentSections[action.section] || [])];
        let highlightKey = "";

        switch (action.type) {
          case "add": {
            if (action.item) {
              const newItem: MaterialItem = {
                id:
                  crypto.randomUUID?.() ||
                  `mat-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                nom: action.item.nom || "",
                quantite: action.item.quantite || 1,
                unite: action.item.unite || "",
                largeur: action.item.largeur,
                hauteur: action.item.hauteur,
                couleur: action.item.couleur,
                epaisseur: action.item.epaisseur,
                reference: action.item.reference,
                material_id: action.item.material_id,
                format_standard: action.item.format_standard,
                cout_unitaire: action.item.cout_unitaire,
                couleurs_dispo: action.item.couleurs_dispo,
              };
              currentSections[action.section] = [...section, newItem];
              highlightKey = `${action.section}-${section.length}`;
              allHighlights[highlightKey] = "added";
              anyModified = true;
            }
            break;
          }
          case "update": {
            if (
              action.index != null &&
              action.index < section.length &&
              action.changes
            ) {
              currentSections[action.section] = section.map((item, i) =>
                i === action.index
                  ? { ...item, ...action.changes }
                  : item,
              );
              highlightKey = `${action.section}-${action.index}`;
              allHighlights[highlightKey] = "modified";
              anyModified = true;
            }
            break;
          }
          case "delete": {
            if (action.index != null && action.index < section.length) {
              currentSections[action.section] = section.filter(
                (_, i) => i !== action.index,
              );
              anyModified = true;
            }
            break;
          }
          case "group": {
            // 🆕 Action de groupe : fusionne N plaques en une feuille
            // ⚠️ Brico renvoie les dimensions en CM (standardisé v95) — pas de conversion
            if (action.groupe && action.indices && action.indices.length >= 2) {
              const feuilleL_cm = action.groupe.largeur_feuille || 0;
              const feuilleH_cm = action.groupe.hauteur_feuille || 0;
              const feuilleSurface = feuilleL_cm * feuilleH_cm;
              const occupee = action.groupe.enfants.reduce(
                (sum, e) =>
                  sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1),
                0,
              );
              const chuteSurface = Math.max(0, feuilleSurface - occupee);

              // 🆕 Validation géométrique (en cm)
              const fit = validateGroupFit(
                feuilleL_cm,
                feuilleH_cm,
                action.groupe.enfants.filter(e => e.nom !== "Chute").map(e => ({
                  ...e,
                  largeur: e.largeur || 0,
                  hauteur: e.hauteur || 0,
                })),
              );
              if (!fit.ok && fit.warning) {
                console.warn("[applyActions group] Validation:", fit.warning);
              }

              const enfants: MaterialItem[] = [
                ...action.groupe.enfants.map((e) => ({
                  ...e,
                  id:
                    e.id ||
                    crypto.randomUUID?.() ||
                    `enf-${Date.now()}-${Math.random()
                      .toString(36)
                      .slice(2, 6)}`,
                  unite: e.unite || "plaque",
                  // Dimensions déjà en CM (standardisé v95)
                  largeur: e.largeur || 0,
                  hauteur: e.hauteur || 0,
                })),
                // Ajouter la chute si surface > 0 (en cm² → dimensions en cm)
                ...(chuteSurface > 0.001
                  ? [
                      {
                        id:
                          crypto.randomUUID?.() ||
                          `chu-${Date.now()}-${Math.random()
                            .toString(36)
                            .slice(2, 6)}`,
                        nom: "Chute",
                        quantite: 1,
                        unite: "plaque",
                        largeur:
                          Math.round(Math.sqrt(chuteSurface)),
                        hauteur:
                          Math.round(Math.sqrt(chuteSurface)),
                      } as MaterialItem,
                    ]
                  : []),
              ];

              const groupItem: MaterialItem = {
                id:
                  crypto.randomUUID?.() ||
                  `grp-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 6)}`,
                nom: action.groupe.nom,
                quantite: 1,
                unite: "Feuille",
                largeur: feuilleL_cm,
                hauteur: feuilleH_cm,
                material_id: action.groupe.material_id,
                format_standard: action.groupe.format,
                groupe_enfants: enfants,
                groupe_material_id: action.groupe.material_id,
                groupe_nom: action.groupe.nom,
                groupe_format: action.groupe.format,
                groupe_largeur: feuilleL_cm,
                groupe_hauteur: feuilleH_cm,
              };

              // Supprimer les lignes aux indices spécifiés (ordre décroissant)
              const sortedIndices = [...action.indices].sort((a, b) => b - a);
              let newSection = [...section];
              for (const idx of sortedIndices) {
                if (idx >= 0 && idx < newSection.length) {
                  newSection = newSection.filter((_, i) => i !== idx);
                }
              }
              // Ajouter le groupe
              newSection.push(groupItem);
              currentSections[action.section] = newSection;
              highlightKey = `${action.section}-${newSection.length - 1}`;
              allHighlights[highlightKey] = "added";
              anyModified = true;
            }
            break;
          }
        }

        newMateriaux[ensId] = currentSections;

        if (highlightKey) {
          scrollOrder.push({ ensId, key: highlightKey });
        }
      }

      if (!anyModified) return;

      // Appliquer tout le state d'un coup
      const finalState = {
        ...state,
        materiauxByEnseigne: newMateriaux,
      };
      onStateChange(finalState);

      // Émettre tous les highlights d'un coup
      if (onHighlightsChange && Object.keys(allHighlights).length > 0) {
        onHighlightsChange({ ...allHighlights });
      }

      // Notifier pour génération complète
      if (isGeneration && onCdcGenerated) {
        onCdcGenerated(finalState);
      }

      // ── Phase 2 : scroll séquentiel avec 1s entre chaque ligne ──
      // Attendre le render initial
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => setTimeout(resolve, 100));
      });

      for (const { ensId, key } of scrollOrder) {
        const fullKey = `${ensId}-${key}`;
        const el = document.querySelector(
          `[data-highlight-key="${fullKey}"]`,
        );
        if (el) {
          // Si l'accordéon parent est replié, l'ouvrir d'abord
          const accordion = el.closest(
            '[data-enseigne-accordion]',
          ) as HTMLElement | null;
          if (accordion) {
            const content = accordion.querySelector(
              '[data-accordion-content]',
            ) as HTMLElement | null;
            if (!content) {
              // Accordéon replié → cliquer pour l'ouvrir
              const btn = accordion.querySelector(
                'button[data-toggle-accordion]',
              ) as HTMLButtonElement | null;
              if (btn) {
                btn.click();
                // Attendre que l'accordéon s'ouvre
                await new Promise<void>((resolve) =>
                  setTimeout(resolve, 400),
                );
              }
            }
          }
          smoothScrollTo(el);
        }
        // Pause de 1,5 seconde entre chaque scroll
        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
      }
    },
    [state, onStateChange, onHighlightsChange, onCdcGenerated],
  );

  /** Sélection d'une enseigne via @ → insère une chip dans le contenteditable */
  const handleSelectEnseigne = (ensIdx: number) => {
    setShowEnseigneDropdown(false);
    setEnseigneQuery("");
    const ens = state.enseignes[ensIdx];
    if (!ens || !contentEditableRef.current) return;

    setTargetedEnseigneId(ens.id);

    // Remplacer le @query dans le contenteditable par une chip
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;

    // Trouver le nœud texte contenant @ et le curseur
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) return;

    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;

    // Chercher le @ le plus proche avant le curseur
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");
    if (atIdx < 0) return;

    // Vérifier que @ est précédé d'un espace ou début
    const charBeforeAt = atIdx > 0 ? text[atIdx - 1] : " ";
    if (charBeforeAt !== " " && charBeforeAt !== "\n" && atIdx > 0) return;

    // Supprimer @query du nœud texte
    textNode.textContent = text.slice(0, atIdx) + text.slice(cursorPos);

    // Créer la chip
    const chip = document.createElement("span");
    const shortName = formatChipName(ens.nom);
    chip.textContent = shortName;
    chip.setAttribute("data-enseigne-id", ens.id);
    chip.setAttribute("data-enseigne-name", ens.nom);
    chip.contentEditable = "false";
    chip.className =
      "inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-medium " +
      "bg-indigo-100 text-indigo-700 border border-indigo-200 select-none cursor-default " +
      "align-middle whitespace-nowrap";

    // Insérer la chip + un espace après
    const space = document.createTextNode("\u00A0"); // espace insécable
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

    contentEditableRef.current.focus();
  };

  /** Envoyer un message */
  const handleSend = async () => {
    if (!contentEditableRef.current || loading) return;

    const { text, chips } = extractContent(contentEditableRef.current);
    if (!text && chips.length === 0) return;

    const userMsg: ChatMessage = { role: "user", text: text || "(modifications demandées)" };
    setMessages((prev) => [...prev, userMsg]);

    // Vider le contenteditable
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "";
    }

    setLoading(true);
    setExpanded(true);
    setTargetedEnseigneId(null);

    // L'enseigne ciblée = première chip trouvée, ou null si aucune
    const targetEnseigneId = chips.length > 0 ? chips[0].enseigneId : undefined;

    try {
      const prompt =
        mode === "modifier"
          ? buildModifierPrompt(text, targetEnseigneId)
          : buildDiscussionPrompt(text, targetEnseigneId);

      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
        projectId: projectId || undefined,
      };

      const response = await routeMessage(payload, "brico");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      if (mode === "modifier") {
        const parsed = parseBricoResponse({
          textFallback: responseText,
          cdcActions: (response.response as any).cdcActions,
        });
        setMessages((prev) => [
          ...prev,
          { role: "ai", agent: "brico", text: parsed.message || responseText },
        ]);
        if (parsed.actions?.length) {
          await applyActions(parsed.actions, false);
        } else {
          console.warn(
            '[CdcBuilderFooter] Réponse Brico sans actions parsables:',
            responseText.slice(0, 200),
          );
        }
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "ai", agent: "brico", text: responseText },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai", agent: "brico",
          text: `❌ Erreur: ${err.message || "Impossible de contacter Brico."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /** Génération complète du CDC via Brico */
  const handleGenerateCdc = async () => {
    if (loading) return;
    setLoading(true);
    setExpanded(true);

    const prompt = buildGenerationPrompt();

    setMessages([
      {
        role: "user",
        text: `🪄 Génère le CDC complet pour "${state.projectName}"`,
      },
    ]);

    try {
      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
      };

      const response = await routeMessage(payload, "brico");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      const parsed = parseBricoResponse({
        textFallback: responseText,
        cdcActions: (response.response as any).cdcActions,
      });
      setMessages((prev) => [
        ...prev,
        { role: "ai", agent: "brico", text: parsed.message || responseText },
      ]);

      if (parsed.actions?.length) {
        await applyActions(parsed.actions, true);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai", agent: "brico",
          text: `❌ Erreur: ${err.message || "Impossible de contacter Brico."}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navigation dans le dropdown @enseigne
    if (showEnseigneDropdown && filteredEnseignes.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveEnseigneIdx((p) => (p + 1) % filteredEnseignes.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveEnseigneIdx(
          (p) => (p - 1 + filteredEnseignes.length) % filteredEnseignes.length,
        );
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const ens = filteredEnseignes[activeEnseigneIdx];
        if (ens) {
          const realIdx = state.enseignes.findIndex((e) => e.id === ens.id);
          if (realIdx >= 0) handleSelectEnseigne(realIdx);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowEnseigneDropdown(false);
        return;
      }
    }

    // Suppression d'une chip avec Backspace : si le curseur est juste après une chip
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
        const textNode = range.startContainer;
        const offset = range.startOffset;
        // Si le curseur est au début du nœud texte, vérifier le nœud précédent
        if (offset === 0) {
          const prev = textNode.previousSibling;
          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
            const el = prev as HTMLElement;
            if (el.hasAttribute("data-enseigne-id")) {
              e.preventDefault();
              el.remove();
              // Supprimer aussi l'espace après la chip
              if (textNode.textContent?.startsWith("\u00A0")) {
                textNode.textContent = textNode.textContent.slice(1);
              }
              return;
            }
          }
        }
      }
    }

    // Envoi normal
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Gestion du contenteditable — détecte @ pour le dropdown enseigne */
  const handleContentEditableInput = useCallback(() => {
    const sel = window.getSelection();
    if (!sel?.rangeCount || !contentEditableRef.current) return;
    const range = sel.getRangeAt(0);
    const textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      setShowEnseigneDropdown(false);
      setEnseigneQuery("");
      return;
    }

    const text = textNode.textContent || "";
    const cursorPos = range.startOffset;
    const beforeCursor = text.slice(0, cursorPos);
    const atIdx = beforeCursor.lastIndexOf("@");

    if (atIdx >= 0) {
      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
        const afterAt = beforeCursor.slice(atIdx + 1);
        setEnseigneQuery(afterAt.split(/\s/)[0]);
        setShowEnseigneDropdown(true);
        setActiveEnseigneIdx(0);
        return;
      }
    }
    setShowEnseigneDropdown(false);
    setEnseigneQuery("");
  }, []);

  // ── Reconnaissance vocale ──
  const toggleListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
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
      // Insérer le texte transcrit dans le contenteditable
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

  const chatHeight = 280;
  const actionBarHeight = 34; // py-1.5 (~12px) + content (~22px)
  const inputBarHeight = 56;
  const collapsedSpacer = actionBarHeight + inputBarHeight + 10; // ~100px
  const expandedSpacer = collapsedSpacer + chatHeight + 4; // ~384px

  return (
    <>
      <div
        style={{ height: expanded ? expandedSpacer : collapsedSpacer }}
        aria-hidden="true"
      />

      {/* Footer fixe */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col">
          {/* ── Barre d'actions (TOUJOURS en haut du footer) ── */}
          {hasProjectWithoutCdc ? (
            /* Au moins une enseigne sans matériaux — bouton Discussion + Générer pleine largeur */
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
              {/* Générer le CDC — bouton vert pleine largeur */}
              <button
                type="button"
                onClick={handleGenerateCdc}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
                           bg-emerald-600 text-white
                           hover:bg-emerald-500
                           shadow-lg shadow-emerald-600/25 transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Wand2 size={16} />
                )}
                <span>
                  {loading ? "Génération en cours…" : "Générer le CDC"}
                </span>
              </button>

              {/* 💬 Discussion */}
              <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className={`shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-medium transition-all ${
                  expanded
                    ? "bg-indigo-500/40 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={expanded ? "Masquer la discussion" : "Afficher la discussion"}
              >
                <MessageSquare size={13} />
                {messages.length > 0 && !expanded && (
                  <span className="min-w-[16px] h-[16px] flex items-center justify-center
                                   bg-indigo-500 text-white text-[9px] font-bold rounded-full px-1">
                    {messages.length > 9 ? "9+" : messages.length}
                  </span>
                )}
              </button>
            </div>
          ) : (
            /* Action bar normale */
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
              {/* 💬 Discussion — toggle le chat */}
              <button
                type="button"
                onClick={() => setExpanded((p) => !p)}
                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
                  expanded
                    ? "bg-indigo-500/40 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={expanded ? "Masquer la discussion" : "Afficher la discussion"}
              >
                <MessageSquare size={13} />
                <span>Discussion</span>
                {messages.length > 0 && !expanded && (
                  <span className="min-w-[16px] h-[16px] flex items-center justify-center
                                   bg-indigo-500 text-white text-[9px] font-bold rounded-full px-1">
                    {messages.length > 9 ? "9+" : messages.length}
                  </span>
                )}
              </button>

              {/* Toggle Vue consolidée */}
              <button
                type="button"
                onClick={onToggleConsolidated}
                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
                  showConsolidated
                    ? "bg-indigo-500/40 text-white"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
                title={
                  showConsolidated
                    ? "Vue par enseigne"
                    : "Vue consolidée (toutes les enseignes)"
                }
              >
                <LayoutGrid size={13} />
                <span>Tout</span>
              </button>

              {/* Tout replier/déplier */}
              {!showConsolidated && (
                <button
                  type="button"
                  onClick={onToggleAllOpen}
                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
                  title={allOpen ? "Tout replier" : "Tout déplier"}
                >
                  <span className="text-xs">{allOpen ? "🔽" : "🔼"}</span>
                  <span>{allOpen ? "Replier" : "Déplier"}</span>
                </button>
              )}

              {/* Séparateur */}
              <div className="w-px h-4 bg-white/20 mx-0.5" />

              {/* Sauvegarde avec badge compteur */}
              <button
                type="button"
                onClick={onSave}
                disabled={saving || changeCount === 0}
                className="relative flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all
                           bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                title={
                  state.savedMessageId
                    ? "Mettre à jour le CDC"
                    : "Sauvegarder le CDC"
                }
              >
                {saving ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>{state.savedMessageId ? "MàJ" : "Sauver"}</span>
                {changeCount > 0 && !saving && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center
                               bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none"
                  >
                    {changeCount > 99 ? "99+" : changeCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* ── Chat expandé (ENTRE action bar et input) ── */}
          {expanded && !hasProjectWithoutCdc && (
            <div
              className="flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
              style={{ height: chatHeight }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  {mode === "modifier" ? (
                    <>
                      <Pencil size={13} className="text-indigo-400" />
                      <span className="font-medium text-gray-300">
                        Modifier{targetedEnseigne ? ` — ${targetedEnseigne.nom}` : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={13} className="text-gray-400" />
                      <span className="font-medium text-gray-300">
                        Discussion{targetedEnseigne ? ` — ${targetedEnseigne.nom}` : ""}
                      </span>
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
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5"
              >
                {messages.length === 0 && (
                  <div className="text-center text-xs text-gray-500 py-3">
                    {mode === "modifier"
                      ? "Demande à Brico de modifier le CDC. Tape @ pour cibler une enseigne."
                      : "Pose une question à Brico. Tape @ pour cibler une enseigne."}
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "ai" && msg.agent === "brico" && (
                      <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-indigo-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {msg.role === "ai" && msg.agent === "brico"
                        ? <span dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(msg.text) }} />
                        : msg.text}
                    </div>
                    {msg.role === "user" && (
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
                        <UserIcon size={12} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                ))}
                {loading && !hasProjectWithoutCdc && (
                  <div className="flex gap-1.5 justify-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-bl-sm">
                      {catalogLoading ? "Enrichissement catalogue…" : "Brico réfléchit…"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat pour le mode "Créer un CDC" */}
          {expanded && hasProjectWithoutCdc && (
            <div
              className="flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
              style={{ height: chatHeight }}
            >
              <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
                <div className="flex items-center gap-2 text-xs">
                  <Wand2 size={13} className="text-purple-400" />
                  <span className="font-medium text-gray-300">
                    Génération du CDC — {state.projectName}
                  </span>
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
              <div
                ref={chatRef}
                className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5"
              >
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "ai" && msg.agent === "brico" && (
                      <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-indigo-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed ${
                        msg.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-sm"
                          : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"
                      }`}
                    >
                      {msg.role === "ai" && msg.agent === "brico"
                        ? <span dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(msg.text) }} />
                        : msg.text}
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
                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
                    </div>
                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-bl-sm">
                      Brico génère le CDC…
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Barre de saisie (TOUJOURS en bas) ── */}
          <div className="bg-gradient-to-t from-gray-100/80 via-gray-50/60 to-transparent backdrop-blur-lg border-t border-gray-200/30">
            <div className="flex items-center gap-1.5 px-3 py-2.5 max-w-6xl mx-auto min-h-[56px]">
              {/* Input pill — contenteditable avec chips enseigne */}
              <div className="flex-1 relative min-w-0" ref={enseigneWrapperRef}>
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleContentEditableInput}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    // Rouvrir le dropdown @enseigne si @ est déjà présent
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
                    if (atIdx >= 0) {
                      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
                      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
                        const afterAt = beforeCursor.slice(atIdx + 1).split(/\s/)[0];
                        setEnseigneQuery(afterAt);
                        setShowEnseigneDropdown(true);
                      }
                    }
                  }}
                  data-placeholder={
                    mode === "demander"
                      ? "Poser une question… (@ pour cibler une enseigne)"
                      : "Décrire la modification… (@ pour cibler une enseigne)"
                  }
                  className="cdc-input w-full min-h-[40px] max-h-[120px] overflow-y-auto pl-9 pr-4 py-2 rounded-[20px] bg-white border border-gray-300
                             text-sm text-gray-700
                             focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none
                             shadow-sm transition-shadow
                             whitespace-pre-wrap break-words"
                />

                {/* Dropdown @enseigne — au-dessus de l'input */}
                {showEnseigneDropdown &&
                  filteredEnseignes.length > 0 &&
                  createPortal(
                    <div
                      ref={enseigneDropdownRef}
                      style={enseigneDropdownStyle}
                      className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1"
                    >
                      {filteredEnseignes.map((ens, idx) => {
                        const realIdx = state.enseignes.findIndex(
                          (e) => e.id === ens.id,
                        );
                        const isTargeted = ens.id === targetedEnseigneId;
                        const materiauxCount = Object.values(
                          state.materiauxByEnseigne[ens.id] || {},
                        ).flat().length;
                        return (
                          <button
                            key={ens.id}
                            type="button"
                            onMouseDown={(e) => {
                              // preventDefault + sélection dans le même handler → avant blur
                              e.preventDefault();
                              if (realIdx >= 0) handleSelectEnseigne(realIdx);
                            }}
                            className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                              idx === activeEnseigneIdx || isTargeted
                                ? "bg-indigo-50 text-indigo-700"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <Hash
                              size={12}
                              className={
                                isTargeted
                                  ? "text-indigo-400"
                                  : "text-gray-300"
                              }
                            />
                            <span className="font-medium flex-1">
                              {ens.nom}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {ens.dimensions.largeur}×{ens.dimensions.hauteur}
                              {ens.dimensions.profondeur
                                ? `×${ens.dimensions.profondeur}`
                                : ""}{" "}
                              cm
                            </span>
                            {materiauxCount > 0 && (
                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
                                {materiauxCount} mat.
                              </span>
                            )}
                            {isTargeted && (
                              <span className="text-[10px] text-indigo-400 font-medium">
                                ciblée
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>,
                    document.body,
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

              {/* Toggle Modifier / Demander — cercle */}
              <button
                type="button"
                onClick={() =>
                  setMode((prev) =>
                    prev === "modifier" ? "demander" : "modifier",
                  )
                }
                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0 ${
                  mode === "modifier"
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
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

              {/* Envoyer — cercle */}
              <button
                type="button"
                onClick={handleSend}
                disabled={loading}
                className="flex items-center justify-center w-8 h-8 rounded-full
                           bg-indigo-600 text-white hover:bg-indigo-500 transition-all shrink-0
                           disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-indigo-600/20"
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

export default CdcBuilderFooter;
