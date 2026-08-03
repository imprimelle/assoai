1|// src/components/cdc-builder/CdcBuilderFooter.tsx
2|// Footer sticky avec widget chat Brico — modes Modifier/Demander.
3|// v7: bouton Discussion dans l'action bar, chat repositionné entre action bar et saisie.
4|//     Gestion @enseigne dans l'input. Bouton "Générer le CDC" quand projet sans CDC.
5|
6|import React, { useState, useRef, useEffect, useCallback } from "react";
7|import { createPortal } from "react-dom";
8|import {
9|  Bot,
10|  MessageCircle,
11|  MessageSquare,
12|  ChevronDown,
13|  Send,
14|  Loader2,
15|  User as UserIcon,
16|  Mic,
17|  MicOff,
18|  Pencil,
19|  LayoutGrid,
20|  Save,
21|  Wand2,
22|  Hash,
23|} from "lucide-react";
24|import { routeMessage } from "@/services/hermesRouter";
25|import { rowsToSections, sectionsToRows } from "./CdcBuilderTable";
26|import type {
27|  CdcBuilderState,
28|  BricoAction,
29|} from "@/types/cdcBuilder";
30|import type { MaterialItem } from "@/types";
31|import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
32|import type { User } from "@/types/user";
33|import { supabase } from "@/integrations/supabase/client";
34|import { useChatPersistence } from "@/hooks/useChatPersistence";
35|import type { ChatMessage } from "@/hooks/useChatPersistence";
36|
37|/**
38| * ⚠️ ZONE CRITIQUE — Contenteditable avec chips @enseigne
39| *
40| * Ce composant manipule directement le DOM (contenteditable + chips contentEditable="false").
41| * Toute modification des handlers handleKeyDown / handleSelectEnseigne / handleContentEditableInput
42| * doit respecter ces contraintes :
43| *
44| * 1. Les chips sont des <span contentEditable="false" data-enseigne-id="...">
45| * 2. Backspace en position 0 d'un nœud texte suivant une chip → supprime la chip entière
46| * 3. @ n'est détecté QUE si précédé d'un espace ou début de ligne
47| * 4. Le dropdown @enseigne utilise onMouseDown (pas onClick) pour éviter le blur avant sélection
48| * 5. extractContent() traverse le DOM — ne pas utiliser innerText
49| */
50|
51|export interface CdcBuilderFooterProps {
52|  state: CdcBuilderState;
53|  onStateChange: (state: CdcBuilderState) => void;
54|  user: User;
55|  persistentSessionId: string;
56|  /** 🆕 Identité stable du CDC — fournie par le parent, change uniquement quand on passe à un CDC différent */
57|  chatIdentity: string;
58|  /** 🆕 ID du projet lié (null si aucun projet) */
59|  projectId?: string | null;
60|  onHighlightsChange?: (
61|    highlights: Record<string, "added" | "modified">,
62|  ) => void;
63|  // ── Action bar props ──
64|  showConsolidated: boolean;
65|  onToggleConsolidated: () => void;
66|  allOpen: boolean;
67|  onToggleAllOpen: () => void;
68|  onSave: () => void;
69|  saving: boolean;
70|  changeCount: number;
71|  /** true = projet lié mais aucun CDC (pas de matériaux) — affiche le bouton "Créer un CDC" */
72|  hasProjectWithoutCdc?: boolean;
73|  /** Callback appelé quand Brico a généré un CDC depuis le bouton "Créer un CDC" */
74|  onCdcGenerated?: (state: CdcBuilderState) => void;
75|  /** 🆕 ID de l'enseigne à régénérer — déclenche un envoi auto à Brico */
76|  regenerateEnseigneId?: string | null;
77|  /** 🆕 Message utilisateur optionnel pour préciser la régénération */
78|  regenerateMessage?: string;
79|  /** 🆕 Callback pour vider l'ID après traitement */
80|  onClearRegenerate?: () => void;
81|}
82|
83|/** Formate le nom d'une enseigne en version courte pour la chip : "Neon Tra..." */
84|function formatChipName(name: string): string {
85|  const parts = name.trim().split(/\s+/);
86|  if (parts.length === 1) return parts[0].slice(0, 12) + (parts[0].length > 12 ? "…" : "");
87|  return parts[0] + " " + parts[1].slice(0, 2) + "…";
88|}
89|
90|/** Extrait le contenu du contenteditable : texte + chips */
91|function extractContent(container: HTMLElement): {
92|  text: string;
93|  chips: { enseigneId: string; name: string; shortName: string }[];
94|} {
95|  const chips: { enseigneId: string; name: string; shortName: string }[] = [];
96|  let text = "";
97|
98|  function walk(node: Node) {
99|    if (node.nodeType === Node.TEXT_NODE) {
100|      text += node.textContent || "";
101|    } else if (node.nodeType === Node.ELEMENT_NODE) {
102|      const el = node as HTMLElement;
103|      if (el.hasAttribute("data-enseigne-id")) {
104|        const eid = el.getAttribute("data-enseigne-id")!;
105|        const ename = el.getAttribute("data-enseigne-name") || "";
106|        chips.push({ enseigneId: eid, name: ename, shortName: el.textContent || "" });
107|        text += " @" + ename + " ";
108|      } else if (el.tagName === "BR") {
109|        text += "\n";
110|      } else {
111|        el.childNodes.forEach(walk);
112|      }
113|    }
114|  }
115|
116|  container.childNodes.forEach(walk);
117|  return { text: text.replace(/\u00A0/g, " ").trim(), chips };
118|}
119|
120|/** 🆕 Convertit le markdown en HTML pour l'affichage dans le chat.
121| *  Supporte : titres (###), **gras**, *italique*, `code`, listes à puces,
122| *  tableaux simples, > citations, [liens](url). */
123|function renderMarkdownToHtml(md: string): string {
124|  let html = md;
125|
126|  // Échapper le HTML existant
127|  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
128|
129|  // ── Phase 1 : blocs (titres, citations, tableaux, listes) ──
130|  const lines = html.split("\n");
131|  const result: string[] = [];
132|  let inTable = false;
133|  let inList = false;
134|
135|  for (let i = 0; i < lines.length; i++) {
136|    const line = lines[i];
137|    const trimmed = line.trim();
138|
139|    // Fermer table si on était dedans
140|    if (inTable && !/^\|(.+)\|$/.test(trimmed)) {
141|      result.push("</tbody></table>");
142|      inTable = false;
143|    }
144|
145|    // Fermer liste si on était dedans
146|    if (inList && !/^[\-\*]\s/.test(trimmed)) {
147|      result.push("</ul>");
148|      inList = false;
149|    }
150|
151|    // Titres ### (h1-h6 en markdown)
152|    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
153|    if (headingMatch) {
154|      const level = Math.min(headingMatch[1].length, 6);
155|      result.push(`<h${level} class="text-white font-semibold mt-2 mb-1 ${level <= 2 ? "text-sm" : "text-xs"}">${headingMatch[2]}</h${level}>`);
156|      continue;
157|    }
158|
159|    // Citations >
160|    if (/^>\s?(.+)$/.test(trimmed)) {
161|      const quoteContent = trimmed.replace(/^>\s?/, "");
162|      result.push(`<blockquote class="border-l-2 border-gray-500 pl-3 my-1 text-gray-400 italic text-xs">${quoteContent}</blockquote>`);
163|      continue;
164|    }
165|
166|    // Tableaux
167|    if (/^\|(.+)\|$/.test(trimmed)) {
168|      if (/^\|[\s\-:]+\|/.test(trimmed)) continue; // skip separator
169|      if (!inTable) {
170|        result.push('<table class="w-full text-[11px] border-collapse border border-gray-600 rounded overflow-hidden my-1"><tbody>');
171|        inTable = true;
172|      }
173|      const cells = trimmed.slice(1, -1).split("|").map(c => c.trim());
174|      result.push("<tr>" + cells.map(c => `<td class="border border-gray-600 px-2 py-1 text-gray-300">${c}</td>`).join("") + "</tr>");
175|      continue;
176|    }
177|
178|    // Listes à puces
179|    if (/^[\-\*]\s(.+)$/.test(trimmed)) {
180|      if (!inList) {
181|        result.push('<ul class="list-disc ml-4 my-1 text-gray-200 text-xs space-y-0.5">');
182|        inList = true;
183|      }
184|      const itemText = trimmed.replace(/^[\-\*]\s/, "");
185|      result.push(`<li>${itemText}</li>`);
186|      continue;
187|    }
188|
189|    // Ligne normale
190|    result.push(trimmed || "<br>");
191|  }
192|
193|  // Fermer les blocs ouverts
194|  if (inTable) result.push("</tbody></table>");
195|  if (inList) result.push("</ul>");
196|
197|  html = result.join("\n");
198|
199|  // ── Phase 2 : inline (dans l'ordre) ──
200|
201|  // Liens [texte](url)
202|  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-400 underline hover:text-indigo-300">$1</a>');
203|
204|  // Code inline
205|  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-700 text-amber-400 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');
206|
207|  // Gras
208|  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
209|
210|  // Italique
211|  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');
212|
213|  // Sauts de ligne restants
214|  html = html.replace(/\n/g, "<br>");
215|
216|  return html;
217|}
218|
219|function parseBricoResponse(
220|  response: { textFallback?: string; cdcActions?: BricoAction[] }
221|): { message: string; actions?: BricoAction[] } {
222|  // Niveau 0 : le backend a déjà extrait les actions → pas de re-parsing
223|  if (response.cdcActions?.length) {
224|    return { message: response.textFallback || '', actions: response.cdcActions };
225|  }
226|
227|  const text = response.textFallback || '';
228|  if (!text) return { message: text };
229|
230|  // Niveau 1 : la réponse entière est un JSON valide contenant "actions"
231|  try {
232|    const parsed = JSON.parse(text);
233|    if (parsed.actions && Array.isArray(parsed.actions)) {
234|      return { message: '', actions: parsed.actions };
235|    }
236|  } catch {}
237|
238|  // Niveau 2 : extraction multi-patterns (```json, JSON inline)
239|  const patterns: RegExp[] = [
240|    /```(?:json)?\s*(\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?\})\s*```/,
241|    /\{[\s\S]*?"actions"\s*:\s*\[[\s\S]*?\][\s\S]*?\}/,
242|  ];
243|
244|  for (const pattern of patterns) {
245|    const match = text.match(pattern);
246|    if (match) {
247|      const jsonStr = match[1] || match[0];
248|      try {
249|        const parsed = JSON.parse(jsonStr);
250|        if (Array.isArray(parsed.actions)) {
251|          return {
252|            message: text.replace(match[0], '').trim(),
253|            actions: parsed.actions,
254|          };
255|        }
256|      } catch {}
257|    }
258|  }
259|
260|  // Niveau 3 : échec — retour texte brut, pas d'actions
261|  return { message: text };
262|}
263|
264|// ── Enrichissement catalogue materials (post-processing des actions Brico) ──
265|
266|/** Mapping d'une entrée catalogue → MaterialItem partiel */
267|function catalogToMaterialFields(entry: any): Partial<MaterialItem> {
268|  return {
269|    nom: `${entry.materiau}${entry.epaisseur ? ` ${entry.epaisseur}` : ""}`,
270|    unite: entry.unite,
271|    epaisseur: entry.epaisseur || undefined,
272|    reference: entry.external_id != null ? String(entry.external_id) : undefined,
273|    material_id: entry.id,
274|    format_standard: entry.format_standard || undefined,
275|    cout_unitaire: entry.cout_min ?? undefined,
276|    couleurs_dispo: entry.couleurs?.length ? entry.couleurs : undefined,
277|  };
278|}
279|
280|/** Requête le catalogue materials pour un terme de recherche */
281|async function searchCatalog(query: string): Promise<any[]> {
282|  // Essayer d'abord par material_id (UUID exact)
283|  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query)) {
284|    const { data } = await supabase.from("materials").select("*").eq("id", query).limit(1);
285|    if (data?.length) return data;
286|  }
287|  // Recherche par nom (premier mot, ilike)
288|  const searchTerm = query.split(/\s+/)[0];
289|  if (searchTerm.length < 2) return [];
290|  const { data } = await supabase
291|    .from("materials")
292|    .select("*")
293|    .ilike("materiau", `%${searchTerm}%`)
294|    .limit(5);
295|  return data || [];
296|}
297|
298|/** Enrichit un MaterialItem avec les données du catalogue materials */
299|function applyCatalogMatch(item: MaterialItem, entry: any): MaterialItem {
300|  const fields = catalogToMaterialFields(entry);
301|  return {
302|    ...item,
303|    material_id: item.material_id || fields.material_id,
304|    reference: item.reference || fields.reference,
305|    cout_unitaire: item.cout_unitaire ?? fields.cout_unitaire,
306|    format_standard: item.format_standard || fields.format_standard,
307|    epaisseur: item.epaisseur || fields.epaisseur,
308|    unite: item.unite || fields.unite,
309|    couleurs_dispo: item.couleurs_dispo || fields.couleurs_dispo,
310|    // Ne pas écraser le nom s'il est déjà plus précis que le nom catalogue
311|    nom: item.nom || fields.nom || item.nom,
312|  };
313|}
314|
315|/**
316| * Post-processing : enrichit les actions Brico avec les données réelles
317| * du catalogue materials (material_id, prix, formats, couleurs).
318| * Garantit que chaque item a un material_id valide même si Brico a « oublié »
319| * de consulter le catalogue.
320| */
321|async function enrichActionsWithCatalog(
322|  actions: BricoAction[],
323|): Promise<BricoAction[]> {
324|  // 1. Collecter les items à enrichir (add, update, ET group)
325|  const itemsToEnrich: { actionIdx: number; item: MaterialItem }[] = [];
326|  for (let i = 0; i < actions.length; i++) {
327|    const a = actions[i];
328|    if ((a.type === "add" || a.type === "update") && a.item?.nom) {
329|      itemsToEnrich.push({ actionIdx: i, item: a.item });
330|    }
331|    // 🆕 Enrichir aussi les actions "group" (material_id de la feuille)
332|    if (a.type === "group" && a.groupe?.nom) {
333|      itemsToEnrich.push({
334|        actionIdx: i,
335|        item: {
336|          id: a.groupe.material_id || "",
337|          nom: a.groupe.nom,
338|          material_id: a.groupe.material_id,
339|          quantite: 1,
340|        } as MaterialItem,
341|      });
342|    }
343|  }
344|  if (itemsToEnrich.length === 0) return actions;
345|
346|  // 2. Requêter le catalogue pour chaque item (déduplication par material_id)
347|  const cache = new Map<string, any>();
348|  const enriched = [...actions];
349|
350|  for (const { actionIdx, item } of itemsToEnrich) {
351|    const searchKey = item.material_id || item.nom;
352|    if (!searchKey) continue;
353|
354|    if (!cache.has(searchKey)) {
355|      const results = await searchCatalog(searchKey);
356|      cache.set(searchKey, results.length > 0 ? results[0] : null);
357|    }
358|
359|    const match = cache.get(searchKey);
360|    if (match) {
361|      const a = enriched[actionIdx];
362|      if (a.type === "add") {
363|        enriched[actionIdx] = { ...a, item: applyCatalogMatch(item, match) };
364|      } else if (a.type === "update") {
365|        enriched[actionIdx] = {
366|          ...a,
367|          changes: {
368|            ...a.changes,
369|            material_id: a.changes?.material_id || match.id,
370|            reference: a.changes?.reference || String(match.external_id || ""),
371|            cout_unitaire: a.changes?.cout_unitaire ?? match.cout_min,
372|            format_standard: a.changes?.format_standard || match.format_standard,
373|            unite: a.changes?.unite || match.unite,
374|          },
375|        };
376|      } else if (a.type === "group" && a.groupe) {
377|        // 🆕 Enrichir la feuille du groupe avec les données catalogue
378|        const fields = catalogToMaterialFields(match);
379|        enriched[actionIdx] = {
380|          ...a,
381|          groupe: {
382|            ...a.groupe,
383|            material_id: a.groupe.material_id || match.id,
384|            nom: fields.nom || a.groupe.nom,
385|            format: fields.format_standard || a.groupe.format,
386|          },
387|        };
388|      }
389|    }
390|  }
391|
392|  console.log(
393|    `[enrichCatalog] ${itemsToEnrich.length} items vérifiés, ${cache.size} requêtes catalogue`,
394|  );
395|  return enriched;
396|}
397|
398|/** Scroll animé manuel — durée contrôlable (800ms, easing easeInOutCubic). */
399|function smoothScrollTo(el: HTMLElement, duration = 800) {
400|  const target =
401|    el.getBoundingClientRect().top +
402|    window.scrollY -
403|    window.innerHeight / 2;
404|  const start = window.scrollY;
405|  const distance = target - start;
406|  const startTime = performance.now();
407|
408|  function step(currentTime: number) {
409|    const elapsed = currentTime - startTime;
410|    const progress = Math.min(elapsed / duration, 1);
411|    // easeInOutCubic
412|    const eased =
413|      progress < 0.5
414|        ? 4 * progress * progress * progress
415|        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
416|    window.scrollTo(0, start + distance * eased);
417|    if (progress < 1) {
418|      requestAnimationFrame(step);
419|    }
420|  }
421|  requestAnimationFrame(step);
422|}
423|
424|const CdcBuilderFooter: React.FC<CdcBuilderFooterProps> = ({
425|  state,
426|  onStateChange,
427|  user,
428|  persistentSessionId,
429|  chatIdentity,
430|  projectId,
431|  onHighlightsChange,
432|  showConsolidated,
433|  onToggleConsolidated,
434|  allOpen,
435|  onToggleAllOpen,
436|  onSave,
437|  saving,
438|  changeCount,
439|  hasProjectWithoutCdc = false,
440|  onCdcGenerated,
441|  regenerateEnseigneId,
442|  regenerateMessage,
443|  onClearRegenerate,
444|}) => {
445|  const [expanded, setExpanded] = useState(false);
446|  const [mode, setMode] = useState<"modifier" | "demander">("modifier");
447|
448|  // 🆕 Persistence du fil de discussion via useChatPersistence
449|  // Architecture hybride : localStorage (cache instantané) + Supabase (source de vérité)
450|  const {
451|    messages,
452|    setMessages,
453|    loading: chatPersistenceLoading,
454|  } = useChatPersistence({
455|    chatIdentity,
456|    documentMessageId: state.savedMessageId || null,
457|    documentType: "cdc",
458|    agent: "brico",
459|  });
460|
461|  const [loading, setLoading] = useState(false);
462|  const [catalogLoading, setCatalogLoading] = useState(false); // enrichissement catalogue en cours
463|
464|  // Micro
465|  const [isListening, setIsListening] = useState(false);
466|  const recognitionRef = useRef<any>(null);
467|
468|  const contentEditableRef = useRef<HTMLDivElement>(null);
469|  const chatRef = useRef<HTMLDivElement>(null);
470|
471|  // ── @enseigne dropdown ──
472|  const [showEnseigneDropdown, setShowEnseigneDropdown] = useState(false);
473|  const [enseigneQuery, setEnseigneQuery] = useState("");
474|  const [activeEnseigneIdx, setActiveEnseigneIdx] = useState(0);
475|  /** Enseigne ciblée via @ dans l'input (null = Brico décide) */
476|  const [targetedEnseigneId, setTargetedEnseigneId] = useState<string | null>(null);
477|  const enseigneDropdownRef = useRef<HTMLDivElement>(null);
478|  const enseigneWrapperRef = useRef<HTMLDivElement>(null);
479|
480|  // Filtrer les enseignes pour le dropdown @
481|  const filteredEnseignes = React.useMemo(() => {
482|    if (!enseigneQuery) return state.enseignes;
483|    const q = enseigneQuery.toLowerCase();
484|    return state.enseignes.filter((ens) =>
485|      ens.nom.toLowerCase().includes(q),
486|    );
487|  }, [state.enseignes, enseigneQuery]);
488|
489|  // Position dropdown @enseigne
490|  const [enseigneDropdownStyle, setEnseigneDropdownStyle] = useState<React.CSSProperties>({});
491|  useEffect(() => {
492|    if (showEnseigneDropdown && contentEditableRef.current) {
493|      const rect = contentEditableRef.current.getBoundingClientRect();
494|      setEnseigneDropdownStyle({
495|        position: "fixed",
496|        left: `${rect.left}px`,
497|        top: `${rect.top - 8}px`, // au-dessus de l'input
498|        transform: "translateY(-100%)",
499|        minWidth: `${Math.max(rect.width, 250)}px`,
500|        zIndex: 9999,
501|      });
502|    }
503|  }, [showEnseigneDropdown, enseigneQuery]);
504|
505|  // Click outside @enseigne dropdown
506|  useEffect(() => {
507|    if (!showEnseigneDropdown) return;
508|    const handler = (e: MouseEvent) => {
509|      const target = e.target as Node;
510|      const insideWrapper = enseigneWrapperRef.current?.contains(target);
511|      const insideDropdown = enseigneDropdownRef.current?.contains(target);
512|      if (!insideWrapper && !insideDropdown) {
513|        setShowEnseigneDropdown(false);
514|      }
515|    };
516|    document.addEventListener("mousedown", handler);
517|    return () => document.removeEventListener("mousedown", handler);
518|  }, [showEnseigneDropdown]);
519|
520|  // Reset active enseigne idx quand la query change
521|  useEffect(() => {
522|    setActiveEnseigneIdx(0);
523|  }, [enseigneQuery]);
524|
525|  // Autoscroll
526|  useEffect(() => {
527|    if (chatRef.current) {
528|      chatRef.current.scrollTop = chatRef.current.scrollHeight;
529|    }
530|  }, [messages]);
531|
532|  useEffect(() => {
533|    return () => {
534|      recognitionRef.current?.abort();
535|    };
536|  }, []);
537|
538|  // 🆕 Régénération enseigne — auto-envoi d'un message à Brico
539|  useEffect(() => {
540|    if (!regenerateEnseigneId) return;
541|    const ens = state.enseignes.find((e) => e.id === regenerateEnseigneId);
542|    if (!ens) {
543|      onClearRegenerate?.();
544|      return;
545|    }
546|
547|    // Trouver l'index de l'enseigne
548|    const ensIdx = state.enseignes.findIndex((e) => e.id === regenerateEnseigneId);
549|
550|    // 🆕 Info produit pour la BOM
551|    const productInfo = ens.produits?.length
552|      ? `\n📦 Produit(s) lié(s): ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
553|      : "";
554|
555|    // Construire le prompt
556|    const prompt = `[CDC Builder — Mode Modifier]
557|Tu es Brico. Régénère TOUS les matériaux de cette enseigne à partir de zéro.
558|
559|⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).
560|
561|Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
562|CDC N°: ${state.cdcNumero || "?"}
563|
564|🎯 Enseigne à régénérer : ${ens.nom} (enseigneIndex = ${ensIdx})${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}
565|Dimensions : ${ens.dimensions.largeur}×${ens.dimensions.hauteur}${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}` : ""} cm${
566|      ens.produits?.length ? `\n📦 Produit(s) lié(s): ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}` : ""
567|    }${
568|      regenerateMessage ? `\n\n💬 Précision de l'utilisateur : ${regenerateMessage}` : ""
569|    }
570|
571|⚠️ INSTRUCTIONS :
572|1. Supprime TOUS les matériaux existants de cette enseigne (enseigneIndex=${ensIdx}) — utilise "delete" pour chaque item dans chaque section.
573|2. Recrée les 5 sections (Découpe, Éclairage, Outillage, Métal, Vinyl) avec des matériaux frais basés sur les règles de fabrication.
574|3. ${ens.produits?.length ? "Si un produit est lié, charge sa nomenclature (BOM) via product_bom." : "Utilise les règles de fabrication standards (manufacturing-rules)."}
575|4. 🔢 MULTIPLIE les quantités par le nombre d'exemplaires : cette enseigne doit être fabriquée en ${ens.quantite} exemplaire${ens.quantite > 1 ? "s" : ""}.
576|5. Respecte les dimensions de l'enseigne.${regenerateMessage ? "\n6. Applique la précision de l'utilisateur." : ""}
577|7. ⚠️ FORMAT : analyse + JSON actions (SANS triple-backticks).`;
578|
579|    // Message utilisateur dans le chat
580|    const chatLabel = regenerateMessage
581|      ? `🔄 Régénérer « ${ens.nom} » — "${regenerateMessage}"`
582|      : `🔄 Régénérer « ${ens.nom} »`;
583|    setMessages((prev) => [...prev, { role: "user", text: chatLabel }]);
584|    setExpanded(true);
585|    setLoading(true);
586|    setMode("modifier");
587|
588|    // Envoyer à Brico
589|    routeMessage(
590|      {
591|        userId: user.id,
592|        sessionId: persistentSessionId,
593|        timestamp: new Date().toISOString(),
594|        message: { type: "text" as const, content: prompt, attachments: [] },
595|        projectId: projectId || undefined,
596|      },
597|      "brico",
598|    )
599|      .then((response: any) => {
600|        const parsed = parseBricoResponse(response);
601|        setMessages((prev) => [
602|          ...prev,
603|          { role: "ai", agent: "brico", text: parsed.message || "✅ Matériaux régénérés." },
604|        ]);
605|        if (parsed.actions?.length) {
606|          applyActions(parsed.actions, false);
607|        }
608|        setLoading(false);
609|        onClearRegenerate?.();
610|      })
611|      .catch(() => {
612|        setMessages((prev) => [...prev, { role: "ai", agent: "brico", text: "❌ Erreur lors de la régénération." }]);
613|        setLoading(false);
614|        onClearRegenerate?.();
615|      });
616|    // eslint-disable-next-line react-hooks/exhaustive-deps
617|  }, [regenerateEnseigneId]);
618|
619|  /** Enseigne ciblée (via @ ou null = Brico décide) */
620|  const targetedEnseigne = targetedEnseigneId
621|    ? state.enseignes.find((e) => e.id === targetedEnseigneId)
622|    : null;
623|
624|  /** Filtre les matériaux valides (avec nom) pour éviter d'envoyer des lignes vides à Brico */
625|  const filterValidMaterials = (
626|    materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>>,
627|  ): Record<string, Record<string, MaterialItem[]>> => {
628|    const filtered: Record<string, Record<string, MaterialItem[]>> = {};
629|    for (const [ensId, sections] of Object.entries(materiauxByEnseigne)) {
630|      filtered[ensId] = {};
631|      for (const [section, items] of Object.entries(sections)) {
632|        const valid = items.filter((item) => item.nom && item.nom.trim());
633|        if (valid.length > 0) {
634|          filtered[ensId][section] = valid;
635|        }
636|      }
637|    }
638|    return filtered;
639|  };
640|
641|  /** 🆕 Formate les groupes existants pour le prompt Brico */
642|  const formatGroupsForPrompt = (
643|    materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>>,
644|  ): string => {
645|    const lines: string[] = [];
646|    for (const [ensId, sections] of Object.entries(materiauxByEnseigne)) {
647|      for (const [section, items] of Object.entries(sections)) {
648|        for (const item of items) {
649|          const enfants = item.groupe_enfants;
650|          if (!enfants || enfants.length === 0) continue;
651|          const feuilleL = item.largeur ?? item.groupe_largeur ?? "?";
652|          const feuilleH = item.hauteur ?? item.groupe_hauteur ?? "?";
653|          const feuilleSurface = (item.largeur || 0) * (item.hauteur || 0);
654|          const occupee = enfants
655|            .filter(e => e.nom !== "Chute")
656|            .reduce((sum, e) => sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1), 0);
657|          const chute = Math.max(0, feuilleSurface - occupee);
658|          lines.push(`📐 [${section}] Feuille ${item.nom} (${feuilleL}×${feuilleH}cm, surface ${feuilleSurface.toFixed(2)}cm²) :`);
659|          for (const e of enfants) {
660|            const dims = e.largeur != null && e.hauteur != null ? ` (${e.largeur}×${e.hauteur}cm)` : "";
661|            lines.push(`    • ${e.nom}${dims} ×${e.quantite} ${e.unite || ""}`);
662|          }
663|          if (chute > 0.001) lines.push(`    • Chute ~${chute.toFixed(2)}m²`);
664|        }
665|      }
666|    }
667|    return lines.join("\n");
668|  };
669|
670|  /** Construit le prompt Modifier — avec @ → focus + BOM, sans @ → toutes les enseignes */
671|  const buildModifierPrompt = (
672|    message: string,
673|    explicitTargetId?: string,
674|  ): string => {
675|    const targetId = explicitTargetId || targetedEnseigneId;
676|    const targetEns = targetId
677|      ? state.enseignes.find((e) => e.id === targetId)
678|      : null;
679|
680|    // Contexte détaillé de TOUTES les enseignes (toujours inclus, filtré des lignes vides)
681|    const validMateriaux = filterValidMaterials(state.materiauxByEnseigne);
682|    const allEnseignesText = state.enseignes
683|      .map((ens, ensIdx) => {
684|        const sections = validMateriaux[ens.id] || {};
685|        const productInfo = ens.produits?.length
686|          ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
687|          : "";
688|        const sectionsText = Object.entries(sections)
689|          .filter(([, items]) => items.length > 0)
690|          .map(([section, items]) => {
691|            const lines = items.map((m) => {
692|              const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
693|              const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
694|              const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
695|              return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
696|            });
697|            return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
698|          })
699|          .join("\n\n");
700|        return `- [${ensIdx}] ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}cm` : ""}${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}\n${sectionsText || "    (aucun matériau)"}`;
701|      })
702|      .join("\n\n");
703|
704|    // 🆕 Section groupes détaillés
705|    const groupsText = formatGroupsForPrompt(state.materiauxByEnseigne);
706|    const groupsBlock = groupsText
707|      ? `\n📐 Groupes Feuille existants (Découpe / Vinyl) :\n${groupsText}\n⚠️ Ces groupes existent déjà — ne pas les recréer. Tu peux ajouter des plaques dedans ou en créer de nouveaux si pertinent.`
708|      : "";
709|
710|    const focusBlock = targetEns
711|      ? `\n🎯 Enseigne mentionnée par l'utilisateur: ${targetEns.nom} (enseigneIndex = ${state.enseignes.findIndex(e => e.id === targetEns.id)})
712|Dimensions: ${targetEns.dimensions.largeur}×${targetEns.dimensions.hauteur}${targetEns.dimensions.profondeur ? `×${targetEns.dimensions.profondeur}` : ""} cm${
713|          targetEns.produits?.length ? `\n📦 Produit(s) lié(s): ${targetEns.produits.map(p => `${p.nom} (id: ${p.id})`).join(", ")}` : ""
714|        }
715|⚠️ Recherche aussi sa nomenclature (BOM) si un produit est lié (product_id → table product_bom).`
716|      : `\n📋 Aucune enseigne spécifique mentionnée avec @ — voici le CDC complet. Détermine toi-même quelle(s) enseigne(s) modifier en fonction de la demande de l'utilisateur. Tu as TOUTES les sections et matériaux ci-dessus pour prendre ta décision.`;
717|
718|    return `[CDC Builder — Mode Modifier]
719|Tu es Brico. Voici le CDC en cours de construction.
720|
721|⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm). Pour les feuilles (groupe), utilise des valeurs en cm aussi (ex: 305 au lieu de 3.05 pour 3,05m).
722|
723|Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
724|CDC N°: ${state.cdcNumero || "?"}
725|Commande N°: ${state.commandeId || "?"}
726|
727|📋 Toutes les enseignes du CDC (avec leurs matériaux):
728|${allEnseignesText}
729|${groupsBlock}
730|${focusBlock}
731|
732|Instruction de l'utilisateur: ${message}
733|
734|⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
735|1. Une courte analyse (1-3 phrases) expliquant ce que tu modifies et pourquoi.
736|2. Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.
737|
738|Exemple :
739|Analyse : j'ajoute du Forex 5mm dans la section Découpe car la demande concerne une bande rectangulaire. Quantité ajustée aux dimensions.
740|
741|{"actions": [
742|  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"Forex 5mm","quantite":1,"unite":"plaque","largeur":5,"hauteur":70}}
743|]}
744|
745|⚠️ Pour grouper des plaques en feuille, utilise le type "group" (sections Découpe et Vinyl uniquement). Les dimensions de la feuille (largeur_feuille, hauteur_feuille) et des plaques enfants sont en CM (ex: 305 pour 3,05m, 50 pour 0,5m).
746|⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne s'applique chaque action.
747|⚠️ 🔢 MULTIPLIE les quantités de TOUS les matériaux par le nombre d'exemplaires indiqué pour chaque enseigne.
748|   Ex: si [0] Façade ×3 exemplaires et qu'il faut 2 plaques par exemplaire → quantite=6 pour cette enseigne.
749|⚠️ Le JSON doit être valide — pas de virgule après le dernier élément, pas de commentaires.`;
750|
751|  };
752|
753|  /** Prompt pour la génération complète d'un CDC (bouton "Créer un CDC") */
754|  const buildGenerationPrompt = (): string => {
755|    const allEnseignesText = state.enseignes
756|      .map(
757|        (ens) => {
758|          const productInfo = ens.produits?.length
759|            ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
760|            : "";
761|          return `- ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}`;
762|        },
763|      )
764|      .join("\n");
765|
766|    return `[CDC Builder — Génération complète]
767|Tu es Brico. Génère un Cahier des Charges complet pour ce projet.
768|
769|⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm). Pour les feuilles (groupe), utilise des valeurs en cm (ex: 305 au lieu de 3.05 pour 3,05m).
770|
771|Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
772|CDC N°: ${state.cdcNumero || "?"}
773|Commande N°: ${state.commandeId || "?"}
774|
775|Enseignes à couvrir:
776|${allEnseignesText}
777|
778|⚠️ Pour chaque enseigne qui a un 📦 product_id, interroge la table product_bom pour obtenir la nomenclature exacte. C'est ta source de vérité.
779|
780|⚠️ INSTRUCTIONS CRITIQUES :
781|1. Pour CHAQUE enseigne, remplis les 5 sections (Découpe, Éclairage, Outillage, Métal, Vinyl) avec des matériaux pertinents.
782|2. Utilise tes connaissances des règles de fabrication (manufacturing-rules) pour déterminer les bons matériaux.
783|3. Les quantités doivent respecter les dimensions de chaque enseigne.
784|   🔢 MULTIPLIE les quantités par le nombre d'exemplaires (×N) de chaque enseigne.
785|4. 🆕 Pour les sections Découpe et Vinyl, regroupe les plaques compatibles en feuilles via des actions "group" quand c'est pertinent (même matériau, même épaisseur).
786|5. ⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
787|   a) Une analyse (2-4 phrases) résumant les matériaux générés pour chaque enseigne.
788|   b) Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.
789|
790|Exemple :
791|Analyse : génération complète du CDC. Façade lumineuse : Plexiglass 5mm + LED Samsung 12V + profilé alu + kit visserie. Enseigne drapeau : Forex 3mm + vinyle rouge.
792|
793|{"actions": [
794|  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"Plexiglass 5mm","quantite":1,"unite":"plaque","largeur":400,"hauteur":150}},
795|  {"type":"add","section":"Éclairage","enseigneIndex":0,"item":{"nom":"Bande LED 12V","quantite":12,"unite":"mètres"}},
796|  ...
797|]}
798|
799|⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne appartient chaque matériau.`;
800|  };
801|
802|  /** 🆕 Prompt Discussion — contexte CDC injecté directement (pas de JSON actions) */
803|  const buildDiscussionPrompt = (
804|    message: string,
805|    explicitTargetId?: string,
806|  ): string => {
807|    const targetId = explicitTargetId || targetedEnseigneId;
808|    const targetEns = targetId
809|      ? state.enseignes.find((e) => e.id === targetId)
810|      : null;
811|
812|    const validMateriaux = filterValidMaterials(state.materiauxByEnseigne);
813|
814|    // ── Avec @enseigne : focus sur UNE seule enseigne, matériaux détaillés ──
815|    if (targetEns) {
816|      const ensIdx = state.enseignes.findIndex((e) => e.id === targetEns.id);
817|      const sections = validMateriaux[targetEns.id] || {};
818|      const productInfo = targetEns.produits?.length
819|        ? `\n📦 Produit(s) lié(s): ${targetEns.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
820|        : "";
821|
822|      const sectionsText = Object.entries(sections)
823|        .filter(([, items]) => items.length > 0)
824|        .map(([section, items]) => {
825|          const lines = items.map((m) => {
826|            const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
827|            const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
828|            const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
829|            return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
830|          });
831|          return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
832|        })
833|        .join("\n\n");
834|
835|      return `Tu es Brico, l'ingénieur de conception d'Imprimelle. Tu es en DISCUSSION avec l'utilisateur sur le CDC Builder.
836|
837|⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).
838|
839|📋 Contexte du CDC :
840|Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
841|CDC N°: ${state.cdcNumero || "Brouillon"}
842|Commande N°: ${state.commandeId || "?"}
843|
844|🎯 Enseigne mentionnée: ${targetEns.nom} (enseigneIndex=${ensIdx})
845|Dimensions: ${targetEns.dimensions.largeur}×${targetEns.dimensions.hauteur}${targetEns.dimensions.profondeur ? `×${targetEns.dimensions.profondeur}` : ""} cm${targetEns.quantite > 1 ? ` (×${targetEns.quantite} exemplaires)` : ""}${productInfo}
846|
847|📐 Matériaux de cette enseigne :
848|${sectionsText || "    (aucun matériau)"}
849|
850|💬 Question de l'utilisateur : ${message}
851|
852|⚠️ Tu es en mode DISCUSSION (pas en mode modification). Réponds de façon conversationnelle et structurée.
   Format conseillé :
   - **Titres** avec ### pour organiser ta réponse en sections
   - **Gras** pour les points clés, *italique* pour les nuances
   - Listes à puces (- item) pour énumérer des options ou étapes
   - Tableaux (| col1 | col2 |) pour comparer des données
   - > Citations pour référencer des règles de fabrication
   - Émojis pour rendre la réponse vivante
   N'utilise PAS de JSON d'actions. Base ta réponse sur le contexte ci-dessus.`;
853|    }
854|
855|    // ── Sans @enseigne : contexte complet de TOUTES les enseignes ──
856|    const allEnseignesDetailed = state.enseignes
857|      .map((ens, ensIdx) => {
858|        const sections = validMateriaux[ens.id] || {};
859|        const productInfo = ens.produits?.length
860|          ? ` | 📦 ${ens.produits.map(p => `${p.nom} (product_id: ${p.id})`).join(", ")}`
861|          : "";
862|        const sectionsText = Object.entries(sections)
863|          .filter(([, items]) => items.length > 0)
864|          .map(([section, items]) => {
865|            const lines = items.map((m) => {
866|              const isGroup = !!(m.groupe_enfants && m.groupe_enfants.length > 0);
867|              const prefix = isGroup ? "    📐 [GROUPE] " : "      • ";
868|              const dims = m.largeur != null && m.hauteur != null ? ` (${m.largeur}×${m.hauteur}cm)` : "";
869|              return `${prefix}${m.nom}${dims} ×${m.quantite} ${m.unite || ""}`;
870|            });
871|            return `    [${section}] (${items.length} matériau${items.length > 1 ? "x" : ""})\n${lines.join("\n")}`;
872|          })
873|          .join("\n\n");
874|        return `- [${ensIdx}] ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)${ens.dimensions.profondeur ? `×${ens.dimensions.profondeur}cm` : ""}${ens.quantite > 1 ? ` ×${ens.quantite} exemplaires` : ""}${productInfo}\n${sectionsText || "    (aucun matériau)"}`;
875|      })
876|      .join("\n\n");
877|
878|    const groupsText = formatGroupsForPrompt(state.materiauxByEnseigne);
879|    const groupsBlock = groupsText
880|      ? `\n📐 Groupes Feuille existants (Découpe / Vinyl) :\n${groupsText}`
881|      : "";
882|
883|    return `Tu es Brico, l'ingénieur de conception d'Imprimelle. Tu es en DISCUSSION avec l'utilisateur sur le CDC Builder.
884|
885|⚠️ RÈGLE : Toutes les dimensions sont en CENTIMÈTRES (cm).
886|
887|📋 Contexte complet du CDC :
888|Projet: ${state.projectName || "Sans titre"}${projectId ? ` (ID: ${projectId})` : ""}
889|CDC N°: ${state.cdcNumero || "Brouillon"}
890|Commande N°: ${state.commandeId || "?"}
891|
892|📋 Toutes les enseignes du CDC (avec leurs matériaux):
893|${allEnseignesDetailed}${groupsBlock}
894|
895|💬 Question de l'utilisateur : ${message}
896|
897|⚠️ Tu es en mode DISCUSSION (pas en mode modification). Réponds de façon conversationnelle et structurée.
   Format conseillé :
   - **Titres** avec ### pour organiser ta réponse en sections
   - **Gras** pour les points clés, *italique* pour les nuances
   - Listes à puces (- item) pour énumérer des options ou étapes
   - Tableaux (| col1 | col2 |) pour comparer des données
   - > Citations pour référencer des règles de fabrication
   - Émojis pour rendre la réponse vivante
   N'utilise PAS de JSON d'actions. Base ta réponse sur le contexte ci-dessus.`;
898|  };
899|
900|  /** 🆕 Validation géométrique 1D : vérifie que les plaques peuvent tenir dans la feuille.
901|   *  Approximation conservative : somme des côtés les plus longs ≤ côté le plus long de la feuille.
902|   *  Retourne { ok: boolean, warning: string | null }
903|   */
904|  const validateGroupFit = (
905|    feuilleL: number,
906|    feuilleH: number,
907|    enfants: MaterialItem[],
908|  ): { ok: boolean; warning: string | null } => {
909|    const feuilleMax = Math.max(feuilleL, feuilleH);
910|    const feuilleMin = Math.min(feuilleL, feuilleH);
911|    let totalLong = 0;
912|    let totalShort = 0;
913|    const oversized: string[] = [];
914|
915|    for (const e of enfants) {
916|      const el = e.largeur ?? 0;
917|      const eh = e.hauteur ?? 0;
918|      const eMax = Math.max(el, eh);
919|      const eMin = Math.min(el, eh);
920|
921|      if (eMax > feuilleMax || eMin > feuilleMin) {
922|        oversized.push(`${e.nom || "plaque"} (${el}×${eh}cm)`);
923|      }
924|      totalLong += eMax * (e.quantite ?? 1);
925|      totalShort += eMin * (e.quantite ?? 1);
926|    }
927|
928|    if (oversized.length > 0) {
929|      return {
930|        ok: false,
931|        warning: `⚠️ ${oversized.length} plaque(s) dépassent les dimensions de la feuille (${feuilleL}×${feuilleH}cm) : ${oversized.join(", ")}`,
932|      };
933|    }
934|
935|    // Vérification conservative : somme des grands côtés vs grand côté feuille
936|    if (totalLong > feuilleMax * 1.05) {
937|      return {
938|        ok: false,
939|        warning: `⚠️ La somme des longueurs des plaques (${totalLong.toFixed(2)}cm) dépasse la longueur de la feuille (${feuilleMax}cm). Les plaques risquent de ne pas tenir.`,
940|      };
941|    }
942|
943|    return { ok: true, warning: null };
944|  };
945|
946|  /** Appliquer les actions Brico — application immédiate + scroll séquentiel (v9.1).
947|   * Toutes les données sont appliquées en une fois, puis l'écran slide
948|   * séquentiellement vers chaque ligne modifiée (1s entre chaque).
949|   * @param isGeneration true = génération complète (CDC vierge → rempli), false = modification
950|   */
951|  const applyActions = useCallback(
952|    async (actions: BricoAction[], isGeneration = false) => {
953|      if (state.enseignes.length === 0) return;
954|
955|      // 🆕 Enrichir avec le catalogue materials (material_id, prix, formats)
956|      setCatalogLoading(true);
957|      const enrichedActions = await enrichActionsWithCatalog(actions);
958|      setCatalogLoading(false);
959|
960|      // ── Phase 1 : appliquer toutes les actions immédiatement ──
961|      const newMateriaux = JSON.parse(
962|        JSON.stringify(state.materiauxByEnseigne),
963|      ) as typeof state.materiauxByEnseigne;
964|      const allHighlights: Record<string, "added" | "modified"> = {};
965|      // Ordre de scroll : [ { ensId, highlightKey } ]
966|      const scrollOrder: { ensId: string; key: string }[] = [];
967|      let anyModified = false;
968|
969|      for (const action of enrichedActions) {
970|        const ensIdx =
971|          (action as any).enseigneIndex != null
972|            ? (action as any).enseigneIndex
973|            : 0;
974|        const targetEns = state.enseignes[ensIdx];
975|        if (!targetEns) continue;
976|
977|        const ensId = targetEns.id;
978|        const currentSections = { ...(newMateriaux[ensId] || {}) };
979|        const section = [...(currentSections[action.section] || [])];
980|        let highlightKey = "";
981|
982|        switch (action.type) {
983|          case "add": {
984|            if (action.item) {
985|              const newItem: MaterialItem = {
986|                id:
987|                  crypto.randomUUID?.() ||
988|                  `mat-${Date.now()}-${Math.random()
989|                    .toString(36)
990|                    .slice(2, 6)}`,
991|                nom: action.item.nom || "",
992|                quantite: action.item.quantite || 1,
993|                unite: action.item.unite || "",
994|                largeur: action.item.largeur,
995|                hauteur: action.item.hauteur,
996|                couleur: action.item.couleur,
997|                epaisseur: action.item.epaisseur,
998|                reference: action.item.reference,
999|                material_id: action.item.material_id,
1000|                format_standard: action.item.format_standard,
1001|                cout_unitaire: action.item.cout_unitaire,
1002|                couleurs_dispo: action.item.couleurs_dispo,
1003|              };
1004|              currentSections[action.section] = [...section, newItem];
1005|              highlightKey = `${action.section}-${section.length}`;
1006|              allHighlights[highlightKey] = "added";
1007|              anyModified = true;
1008|            }
1009|            break;
1010|          }
1011|          case "update": {
1012|            if (
1013|              action.index != null &&
1014|              action.index < section.length &&
1015|              action.changes
1016|            ) {
1017|              currentSections[action.section] = section.map((item, i) =>
1018|                i === action.index
1019|                  ? { ...item, ...action.changes }
1020|                  : item,
1021|              );
1022|              highlightKey = `${action.section}-${action.index}`;
1023|              allHighlights[highlightKey] = "modified";
1024|              anyModified = true;
1025|            }
1026|            break;
1027|          }
1028|          case "delete": {
1029|            if (action.index != null && action.index < section.length) {
1030|              currentSections[action.section] = section.filter(
1031|                (_, i) => i !== action.index,
1032|              );
1033|              anyModified = true;
1034|            }
1035|            break;
1036|          }
1037|          case "group": {
1038|            // 🆕 Action de groupe : fusionne N plaques en une feuille
1039|            // ⚠️ Brico renvoie les dimensions en CM (standardisé v95) — pas de conversion
1040|            if (action.groupe && action.indices && action.indices.length >= 2) {
1041|              const feuilleL_cm = action.groupe.largeur_feuille || 0;
1042|              const feuilleH_cm = action.groupe.hauteur_feuille || 0;
1043|              const feuilleSurface = feuilleL_cm * feuilleH_cm;
1044|              const occupee = action.groupe.enfants.reduce(
1045|                (sum, e) =>
1046|                  sum + (e.largeur || 0) * (e.hauteur || 0) * (e.quantite || 1),
1047|                0,
1048|              );
1049|              const chuteSurface = Math.max(0, feuilleSurface - occupee);
1050|
1051|              // 🆕 Validation géométrique (en cm)
1052|              const fit = validateGroupFit(
1053|                feuilleL_cm,
1054|                feuilleH_cm,
1055|                action.groupe.enfants.filter(e => e.nom !== "Chute").map(e => ({
1056|                  ...e,
1057|                  largeur: e.largeur || 0,
1058|                  hauteur: e.hauteur || 0,
1059|                })),
1060|              );
1061|              if (!fit.ok && fit.warning) {
1062|                console.warn("[applyActions group] Validation:", fit.warning);
1063|              }
1064|
1065|              const enfants: MaterialItem[] = [
1066|                ...action.groupe.enfants.map((e) => ({
1067|                  ...e,
1068|                  id:
1069|                    e.id ||
1070|                    crypto.randomUUID?.() ||
1071|                    `enf-${Date.now()}-${Math.random()
1072|                      .toString(36)
1073|                      .slice(2, 6)}`,
1074|                  unite: e.unite || "plaque",
1075|                  // Dimensions déjà en CM (standardisé v95)
1076|                  largeur: e.largeur || 0,
1077|                  hauteur: e.hauteur || 0,
1078|                })),
1079|                // Ajouter la chute si surface > 0 (en cm² → dimensions en cm)
1080|                ...(chuteSurface > 0.001
1081|                  ? [
1082|                      {
1083|                        id:
1084|                          crypto.randomUUID?.() ||
1085|                          `chu-${Date.now()}-${Math.random()
1086|                            .toString(36)
1087|                            .slice(2, 6)}`,
1088|                        nom: "Chute",
1089|                        quantite: 1,
1090|                        unite: "plaque",
1091|                        largeur:
1092|                          Math.round(Math.sqrt(chuteSurface)),
1093|                        hauteur:
1094|                          Math.round(Math.sqrt(chuteSurface)),
1095|                      } as MaterialItem,
1096|                    ]
1097|                  : []),
1098|              ];
1099|
1100|              const groupItem: MaterialItem = {
1101|                id:
1102|                  crypto.randomUUID?.() ||
1103|                  `grp-${Date.now()}-${Math.random()
1104|                    .toString(36)
1105|                    .slice(2, 6)}`,
1106|                nom: action.groupe.nom,
1107|                quantite: 1,
1108|                unite: "Feuille",
1109|                largeur: feuilleL_cm,
1110|                hauteur: feuilleH_cm,
1111|                material_id: action.groupe.material_id,
1112|                format_standard: action.groupe.format,
1113|                groupe_enfants: enfants,
1114|                groupe_material_id: action.groupe.material_id,
1115|                groupe_nom: action.groupe.nom,
1116|                groupe_format: action.groupe.format,
1117|                groupe_largeur: feuilleL_cm,
1118|                groupe_hauteur: feuilleH_cm,
1119|              };
1120|
1121|              // Supprimer les lignes aux indices spécifiés (ordre décroissant)
1122|              const sortedIndices = [...action.indices].sort((a, b) => b - a);
1123|              let newSection = [...section];
1124|              for (const idx of sortedIndices) {
1125|                if (idx >= 0 && idx < newSection.length) {
1126|                  newSection = newSection.filter((_, i) => i !== idx);
1127|                }
1128|              }
1129|              // Ajouter le groupe
1130|              newSection.push(groupItem);
1131|              currentSections[action.section] = newSection;
1132|              highlightKey = `${action.section}-${newSection.length - 1}`;
1133|              allHighlights[highlightKey] = "added";
1134|              anyModified = true;
1135|            }
1136|            break;
1137|          }
1138|        }
1139|
1140|        newMateriaux[ensId] = currentSections;
1141|
1142|        if (highlightKey) {
1143|          scrollOrder.push({ ensId, key: highlightKey });
1144|        }
1145|      }
1146|
1147|      if (!anyModified) return;
1148|
1149|      // Appliquer tout le state d'un coup
1150|      const finalState = {
1151|        ...state,
1152|        materiauxByEnseigne: newMateriaux,
1153|      };
1154|      onStateChange(finalState);
1155|
1156|      // Émettre tous les highlights d'un coup
1157|      if (onHighlightsChange && Object.keys(allHighlights).length > 0) {
1158|        onHighlightsChange({ ...allHighlights });
1159|      }
1160|
1161|      // Notifier pour génération complète
1162|      if (isGeneration && onCdcGenerated) {
1163|        onCdcGenerated(finalState);
1164|      }
1165|
1166|      // ── Phase 2 : scroll séquentiel avec 1s entre chaque ligne ──
1167|      // Attendre le render initial
1168|      await new Promise<void>((resolve) => {
1169|        requestAnimationFrame(() => setTimeout(resolve, 100));
1170|      });
1171|
1172|      for (const { ensId, key } of scrollOrder) {
1173|        const fullKey = `${ensId}-${key}`;
1174|        const el = document.querySelector(
1175|          `[data-highlight-key="${fullKey}"]`,
1176|        );
1177|        if (el) {
1178|          // Si l'accordéon parent est replié, l'ouvrir d'abord
1179|          const accordion = el.closest(
1180|            '[data-enseigne-accordion]',
1181|          ) as HTMLElement | null;
1182|          if (accordion) {
1183|            const content = accordion.querySelector(
1184|              '[data-accordion-content]',
1185|            ) as HTMLElement | null;
1186|            if (!content) {
1187|              // Accordéon replié → cliquer pour l'ouvrir
1188|              const btn = accordion.querySelector(
1189|                'button[data-toggle-accordion]',
1190|              ) as HTMLButtonElement | null;
1191|              if (btn) {
1192|                btn.click();
1193|                // Attendre que l'accordéon s'ouvre
1194|                await new Promise<void>((resolve) =>
1195|                  setTimeout(resolve, 400),
1196|                );
1197|              }
1198|            }
1199|          }
1200|          smoothScrollTo(el);
1201|        }
1202|        // Pause de 1,5 seconde entre chaque scroll
1203|        await new Promise<void>((resolve) => setTimeout(resolve, 1500));
1204|      }
1205|    },
1206|    [state, onStateChange, onHighlightsChange, onCdcGenerated],
1207|  );
1208|
1209|  /** Sélection d'une enseigne via @ → insère une chip dans le contenteditable */
1210|  const handleSelectEnseigne = (ensIdx: number) => {
1211|    setShowEnseigneDropdown(false);
1212|    setEnseigneQuery("");
1213|    const ens = state.enseignes[ensIdx];
1214|    if (!ens || !contentEditableRef.current) return;
1215|
1216|    setTargetedEnseigneId(ens.id);
1217|
1218|    // Remplacer le @query dans le contenteditable par une chip
1219|    const sel = window.getSelection();
1220|    if (!sel?.rangeCount) return;
1221|
1222|    // Trouver le nœud texte contenant @ et le curseur
1223|    const range = sel.getRangeAt(0);
1224|    const textNode = range.startContainer;
1225|    if (textNode.nodeType !== Node.TEXT_NODE) return;
1226|
1227|    const text = textNode.textContent || "";
1228|    const cursorPos = range.startOffset;
1229|
1230|    // Chercher le @ le plus proche avant le curseur
1231|    const beforeCursor = text.slice(0, cursorPos);
1232|    const atIdx = beforeCursor.lastIndexOf("@");
1233|    if (atIdx < 0) return;
1234|
1235|    // Vérifier que @ est précédé d'un espace ou début
1236|    const charBeforeAt = atIdx > 0 ? text[atIdx - 1] : " ";
1237|    if (charBeforeAt !== " " && charBeforeAt !== "\n" && atIdx > 0) return;
1238|
1239|    // Supprimer @query du nœud texte
1240|    textNode.textContent = text.slice(0, atIdx) + text.slice(cursorPos);
1241|
1242|    // Créer la chip
1243|    const chip = document.createElement("span");
1244|    const shortName = formatChipName(ens.nom);
1245|    chip.textContent = shortName;
1246|    chip.setAttribute("data-enseigne-id", ens.id);
1247|    chip.setAttribute("data-enseigne-name", ens.nom);
1248|    chip.contentEditable = "false";
1249|    chip.className =
1250|      "inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-medium " +
1251|      "bg-indigo-100 text-indigo-700 border border-indigo-200 select-none cursor-default " +
1252|      "align-middle whitespace-nowrap";
1253|
1254|    // Insérer la chip + un espace après
1255|    const space = document.createTextNode("\u00A0"); // espace insécable
1256|    const newRange = document.createRange();
1257|    newRange.setStart(textNode, atIdx);
1258|    newRange.collapse(true);
1259|    newRange.insertNode(chip);
1260|    chip.after(space);
1261|
1262|    // Placer le curseur après l'espace
1263|    const afterRange = document.createRange();
1264|    afterRange.setStartAfter(space);
1265|    afterRange.collapse(true);
1266|    sel.removeAllRanges();
1267|    sel.addRange(afterRange);
1268|
1269|    contentEditableRef.current.focus();
1270|  };
1271|
1272|  /** Envoyer un message */
1273|  const handleSend = async () => {
1274|    if (!contentEditableRef.current || loading) return;
1275|
1276|    const { text, chips } = extractContent(contentEditableRef.current);
1277|    if (!text && chips.length === 0) return;
1278|
1279|    const userMsg: ChatMessage = { role: "user", text: text || "(modifications demandées)" };
1280|    setMessages((prev) => [...prev, userMsg]);
1281|
1282|    // Vider le contenteditable
1283|    if (contentEditableRef.current) {
1284|      contentEditableRef.current.innerHTML = "";
1285|    }
1286|
1287|    setLoading(true);
1288|    setExpanded(true);
1289|    setTargetedEnseigneId(null);
1290|
1291|    // L'enseigne ciblée = première chip trouvée, ou null si aucune
1292|    const targetEnseigneId = chips.length > 0 ? chips[0].enseigneId : undefined;
1293|
1294|    try {
1295|      const prompt =
1296|        mode === "modifier"
1297|          ? buildModifierPrompt(text, targetEnseigneId)
1298|          : buildDiscussionPrompt(text, targetEnseigneId);
1299|
1300|      const payload = {
1301|        userId: user.id,
1302|        sessionId: persistentSessionId,
1303|        timestamp: new Date().toISOString(),
1304|        message: { type: "text" as const, content: prompt, attachments: [] },
1305|        projectId: projectId || undefined,
1306|      };
1307|
1308|      const response = await routeMessage(payload, "brico");
1309|      const responseText =
1310|        response.response.textFallback || "Aucune réponse.";
1311|
1312|      if (mode === "modifier") {
1313|        const parsed = parseBricoResponse({
1314|          textFallback: responseText,
1315|          cdcActions: (response.response as any).cdcActions,
1316|        });
1317|        setMessages((prev) => [
1318|          ...prev,
1319|          { role: "ai", agent: "brico", text: parsed.message || (parsed.actions?.length ? "✅ Modifications appliquées." : responseText) },
1320|        ]);
1321|        if (parsed.actions?.length) {
1322|          await applyActions(parsed.actions, false);
1323|        } else {
1324|          console.warn(
1325|            '[CdcBuilderFooter] Réponse Brico sans actions parsables:',
1326|            responseText.slice(0, 200),
1327|          );
1328|        }
1329|      } else {
1330|        setMessages((prev) => [
1331|          ...prev,
1332|          { role: "ai", agent: "brico", text: responseText },
1333|        ]);
1334|      }
1335|    } catch (err: any) {
1336|      setMessages((prev) => [
1337|        ...prev,
1338|        {
1339|          role: "ai", agent: "brico",
1340|          text: `❌ Erreur: ${err.message || "Impossible de contacter Brico."}`,
1341|        },
1342|      ]);
1343|    } finally {
1344|      setLoading(false);
1345|    }
1346|  };
1347|
1348|  /** Génération complète du CDC via Brico */
1349|  const handleGenerateCdc = async () => {
1350|    if (loading) return;
1351|    setLoading(true);
1352|    setExpanded(true);
1353|
1354|    const prompt = buildGenerationPrompt();
1355|
1356|    setMessages([
1357|      {
1358|        role: "user",
1359|        text: `🪄 Génère le CDC complet pour "${state.projectName}"`,
1360|      },
1361|    ]);
1362|
1363|    try {
1364|      const payload = {
1365|        userId: user.id,
1366|        sessionId: persistentSessionId,
1367|        timestamp: new Date().toISOString(),
1368|        message: { type: "text" as const, content: prompt, attachments: [] },
1369|      };
1370|
1371|      const response = await routeMessage(payload, "brico");
1372|      const responseText =
1373|        response.response.textFallback || "Aucune réponse.";
1374|
1375|      const parsed = parseBricoResponse({
1376|        textFallback: responseText,
1377|        cdcActions: (response.response as any).cdcActions,
1378|      });
1379|      setMessages((prev) => [
1380|        ...prev,
1381|        { role: "ai", agent: "brico", text: parsed.message || (parsed.actions?.length ? "✅ Modifications appliquées." : responseText) },
1382|      ]);
1383|
1384|      if (parsed.actions?.length) {
1385|        await applyActions(parsed.actions, true);
1386|      }
1387|    } catch (err: any) {
1388|      setMessages((prev) => [
1389|        ...prev,
1390|        {
1391|          role: "ai", agent: "brico",
1392|          text: `❌ Erreur: ${err.message || "Impossible de contacter Brico."}`,
1393|        },
1394|      ]);
1395|    } finally {
1396|      setLoading(false);
1397|    }
1398|  };
1399|
1400|  const handleKeyDown = (e: React.KeyboardEvent) => {
1401|    // Navigation dans le dropdown @enseigne
1402|    if (showEnseigneDropdown && filteredEnseignes.length > 0) {
1403|      if (e.key === "ArrowDown") {
1404|        e.preventDefault();
1405|        setActiveEnseigneIdx((p) => (p + 1) % filteredEnseignes.length);
1406|        return;
1407|      }
1408|      if (e.key === "ArrowUp") {
1409|        e.preventDefault();
1410|        setActiveEnseigneIdx(
1411|          (p) => (p - 1 + filteredEnseignes.length) % filteredEnseignes.length,
1412|        );
1413|        return;
1414|      }
1415|      if (e.key === "Enter") {
1416|        e.preventDefault();
1417|        const ens = filteredEnseignes[activeEnseigneIdx];
1418|        if (ens) {
1419|          const realIdx = state.enseignes.findIndex((e) => e.id === ens.id);
1420|          if (realIdx >= 0) handleSelectEnseigne(realIdx);
1421|        }
1422|        return;
1423|      }
1424|      if (e.key === "Escape") {
1425|        setShowEnseigneDropdown(false);
1426|        return;
1427|      }
1428|    }
1429|
1430|    // Suppression d'une chip avec Backspace : si le curseur est juste après une chip
1431|    if (e.key === "Backspace") {
1432|      const sel = window.getSelection();
1433|      if (!sel?.rangeCount) return;
1434|      const range = sel.getRangeAt(0);
1435|      if (range.collapsed && range.startContainer.nodeType === Node.TEXT_NODE) {
1436|        const textNode = range.startContainer;
1437|        const offset = range.startOffset;
1438|        // Si le curseur est au début du nœud texte, vérifier le nœud précédent
1439|        if (offset === 0) {
1440|          const prev = textNode.previousSibling;
1441|          if (prev && prev.nodeType === Node.ELEMENT_NODE) {
1442|            const el = prev as HTMLElement;
1443|            if (el.hasAttribute("data-enseigne-id")) {
1444|              e.preventDefault();
1445|              el.remove();
1446|              // Supprimer aussi l'espace après la chip
1447|              if (textNode.textContent?.startsWith("\u00A0")) {
1448|                textNode.textContent = textNode.textContent.slice(1);
1449|              }
1450|              return;
1451|            }
1452|          }
1453|        }
1454|      }
1455|    }
1456|
1457|    // Envoi normal
1458|    if (e.key === "Enter" && !e.shiftKey) {
1459|      e.preventDefault();
1460|      handleSend();
1461|    }
1462|  };
1463|
1464|  /** Gestion du contenteditable — détecte @ pour le dropdown enseigne */
1465|  const handleContentEditableInput = useCallback(() => {
1466|    const sel = window.getSelection();
1467|    if (!sel?.rangeCount || !contentEditableRef.current) return;
1468|    const range = sel.getRangeAt(0);
1469|    const textNode = range.startContainer;
1470|    if (textNode.nodeType !== Node.TEXT_NODE) {
1471|      setShowEnseigneDropdown(false);
1472|      setEnseigneQuery("");
1473|      return;
1474|    }
1475|
1476|    const text = textNode.textContent || "";
1477|    const cursorPos = range.startOffset;
1478|    const beforeCursor = text.slice(0, cursorPos);
1479|    const atIdx = beforeCursor.lastIndexOf("@");
1480|
1481|    if (atIdx >= 0) {
1482|      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
1483|      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
1484|        const afterAt = beforeCursor.slice(atIdx + 1);
1485|        setEnseigneQuery(afterAt.split(/\s/)[0]);
1486|        setShowEnseigneDropdown(true);
1487|        setActiveEnseigneIdx(0);
1488|        return;
1489|      }
1490|    }
1491|    setShowEnseigneDropdown(false);
1492|    setEnseigneQuery("");
1493|  }, []);
1494|
1495|  // ── Reconnaissance vocale ──
1496|  const toggleListening = useCallback(() => {
1497|    const SpeechRecognition =
1498|      (window as any).SpeechRecognition ||
1499|      (window as any).webkitSpeechRecognition;
1500|    if (!SpeechRecognition) return;
1501|
1502|    if (isListening) {
1503|      recognitionRef.current?.abort();
1504|      setIsListening(false);
1505|      return;
1506|    }
1507|
1508|    const recognition = new SpeechRecognition();
1509|    recognition.lang = "fr-FR";
1510|    recognition.interimResults = false;
1511|    recognition.maxAlternatives = 1;
1512|    recognition.onresult = (event: any) => {
1513|      const transcript = event.results[0][0].transcript;
1514|      // Insérer le texte transcrit dans le contenteditable
1515|      if (contentEditableRef.current) {
1516|        const sel = window.getSelection();
1517|        if (sel?.rangeCount) {
1518|          const range = sel.getRangeAt(0);
1519|          range.deleteContents();
1520|          const textNode = document.createTextNode(transcript + " ");
1521|          range.insertNode(textNode);
1522|          range.setStartAfter(textNode);
1523|          range.collapse(true);
1524|          sel.removeAllRanges();
1525|          sel.addRange(range);
1526|        } else {
1527|          contentEditableRef.current.appendChild(document.createTextNode(transcript + " "));
1528|        }
1529|        contentEditableRef.current.focus();
1530|      }
1531|    };
1532|    recognition.onend = () => setIsListening(false);
1533|    recognition.onerror = () => setIsListening(false);
1534|    recognitionRef.current = recognition;
1535|    recognition.start();
1536|    setIsListening(true);
1537|  }, [isListening]);
1538|
1539|  const chatHeight = 280;
1540|  const actionBarHeight = 34; // py-1.5 (~12px) + content (~22px)
1541|  const inputBarHeight = 56;
1542|  const collapsedSpacer = actionBarHeight + inputBarHeight + 10; // ~100px
1543|  const expandedSpacer = collapsedSpacer + chatHeight + 4; // ~384px
1544|
1545|  return (
1546|    <>
1547|      <div
1548|        style={{ height: expanded ? expandedSpacer : collapsedSpacer }}
1549|        aria-hidden="true"
1550|      />
1551|
1552|      {/* Footer fixe */}
1553|      <div className="fixed bottom-0 left-0 right-0 z-40">
1554|        <div className="max-w-6xl mx-auto flex flex-col">
1555|          {/* ── Barre d'actions (TOUJOURS en haut du footer) ── */}
1556|          {hasProjectWithoutCdc ? (
1557|            /* Au moins une enseigne sans matériaux — bouton Discussion + Générer pleine largeur */
1558|            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
1559|              {/* Générer le CDC — bouton vert pleine largeur */}
1560|              <button
1561|                type="button"
1562|                onClick={handleGenerateCdc}
1563|                disabled={loading}
1564|                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold
1565|                           bg-emerald-600 text-white
1566|                           hover:bg-emerald-500
1567|                           shadow-lg shadow-emerald-600/25 transition-all
1568|                           disabled:opacity-50 disabled:cursor-not-allowed"
1569|              >
1570|                {loading ? (
1571|                  <Loader2 size={16} className="animate-spin" />
1572|                ) : (
1573|                  <Wand2 size={16} />
1574|                )}
1575|                <span>
1576|                  {loading ? "Génération en cours…" : "Générer le CDC"}
1577|                </span>
1578|              </button>
1579|
1580|              {/* 💬 Discussion */}
1581|              <button
1582|                type="button"
1583|                onClick={() => setExpanded((p) => !p)}
1584|                className={`shrink-0 flex items-center gap-1.5 px-2.5 h-9 rounded-lg text-xs font-medium transition-all ${
1585|                  expanded
1586|                    ? "bg-indigo-500/40 text-white"
1587|                    : "bg-white/10 text-white hover:bg-white/20"
1588|                }`}
1589|                title={expanded ? "Masquer la discussion" : "Afficher la discussion"}
1590|              >
1591|                <MessageSquare size={13} />
1592|                {messages.length > 0 && !expanded && (
1593|                  <span className="min-w-[16px] h-[16px] flex items-center justify-center
1594|                                   bg-indigo-500 text-white text-[9px] font-bold rounded-full px-1">
1595|                    {messages.length > 9 ? "9+" : messages.length}
1596|                  </span>
1597|                )}
1598|              </button>
1599|            </div>
1600|          ) : (
1601|            /* Action bar normale */
1602|            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
1603|              {/* 💬 Discussion — toggle le chat */}
1604|              <button
1605|                type="button"
1606|                onClick={() => setExpanded((p) => !p)}
1607|                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
1608|                  expanded
1609|                    ? "bg-indigo-500/40 text-white"
1610|                    : "bg-white/10 text-white hover:bg-white/20"
1611|                }`}
1612|                title={expanded ? "Masquer la discussion" : "Afficher la discussion"}
1613|              >
1614|                <MessageSquare size={13} />
1615|                <span>Discussion</span>
1616|                {messages.length > 0 && !expanded && (
1617|                  <span className="min-w-[16px] h-[16px] flex items-center justify-center
1618|                                   bg-indigo-500 text-white text-[9px] font-bold rounded-full px-1">
1619|                    {messages.length > 9 ? "9+" : messages.length}
1620|                  </span>
1621|                )}
1622|              </button>
1623|
1624|              {/* Toggle Vue consolidée */}
1625|              <button
1626|                type="button"
1627|                onClick={onToggleConsolidated}
1628|                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
1629|                  showConsolidated
1630|                    ? "bg-indigo-500/40 text-white"
1631|                    : "bg-white/10 text-white hover:bg-white/20"
1632|                }`}
1633|                title={
1634|                  showConsolidated
1635|                    ? "Vue par enseigne"
1636|                    : "Vue consolidée (toutes les enseignes)"
1637|                }
1638|              >
1639|                <LayoutGrid size={13} />
1640|                <span>Tout</span>
1641|              </button>
1642|
1643|              {/* Tout replier/déplier */}
1644|              {!showConsolidated && (
1645|                <button
1646|                  type="button"
1647|                  onClick={onToggleAllOpen}
1648|                  className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
1649|                  title={allOpen ? "Tout replier" : "Tout déplier"}
1650|                >
1651|                  <span className="text-xs">{allOpen ? "🔽" : "🔼"}</span>
1652|                  <span>{allOpen ? "Replier" : "Déplier"}</span>
1653|                </button>
1654|              )}
1655|
1656|              {/* Séparateur */}
1657|              <div className="w-px h-4 bg-white/20 mx-0.5" />
1658|
1659|              {/* Sauvegarde avec badge compteur */}
1660|              <button
1661|                type="button"
1662|                onClick={onSave}
1663|                disabled={saving || changeCount === 0}
1664|                className="relative flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all
1665|                           bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
1666|                title={
1667|                  state.savedMessageId
1668|                    ? "Mettre à jour le CDC"
1669|                    : "Sauvegarder le CDC"
1670|                }
1671|              >
1672|                {saving ? (
1673|                  <Loader2 size={13} className="animate-spin" />
1674|                ) : (
1675|                  <Save size={13} />
1676|                )}
1677|                <span>{state.savedMessageId ? "MàJ" : "Sauver"}</span>
1678|                {changeCount > 0 && !saving && (
1679|                  <span
1680|                    className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center
1681|                               bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none"
1682|                  >
1683|                    {changeCount > 99 ? "99+" : changeCount}
1684|                  </span>
1685|                )}
1686|              </button>
1687|            </div>
1688|          )}
1689|
1690|          {/* ── Chat expandé (ENTRE action bar et input) ── */}
1691|          {expanded && !hasProjectWithoutCdc && (
1692|            <div
1693|              className="flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
1694|              style={{ height: chatHeight }}
1695|            >
1696|              {/* Header */}
1697|              <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
1698|                <div className="flex items-center gap-2 text-xs">
1699|                  {mode === "modifier" ? (
1700|                    <>
1701|                      <Pencil size={13} className="text-indigo-400" />
1702|                      <span className="font-medium text-gray-300">
1703|                        Modifier{targetedEnseigne ? ` — ${targetedEnseigne.nom}` : ""}
1704|                      </span>
1705|                    </>
1706|                  ) : (
1707|                    <>
1708|                      <MessageCircle size={13} className="text-gray-400" />
1709|                      <span className="font-medium text-gray-300">
1710|                        Discussion{targetedEnseigne ? ` — ${targetedEnseigne.nom}` : ""}
1711|                      </span>
1712|                    </>
1713|                  )}
1714|                </div>
1715|                <button
1716|                  type="button"
1717|                  onClick={() => setExpanded(false)}
1718|                  className="text-gray-500 hover:text-gray-300 p-1"
1719|                  title="Réduire"
1720|                >
1721|                  <ChevronDown size={15} />
1722|                </button>
1723|              </div>
1724|
1725|              {/* Messages */}
1726|              <div
1727|                ref={chatRef}
1728|                className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5"
1729|              >
1730|                {messages.length === 0 && (
1731|                  <div className="text-center text-xs text-gray-500 py-3">
1732|                    {mode === "modifier"
1733|                      ? "Demande à Brico de modifier le CDC. Tape @ pour cibler une enseigne."
1734|                      : "Pose une question à Brico. Tape @ pour cibler une enseigne."}
1735|                  </div>
1736|                )}
1737|                {messages.map((msg, idx) => (
1738|                  <div
1739|                    key={idx}
1740|                    className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
1741|                  >
1742|                    {msg.role === "ai" && msg.agent === "brico" && (
1743|                      <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
1744|                        <Bot size={12} className="text-indigo-400" />
1745|                      </div>
1746|                    )}
1747|                    <div
1748|                      className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed ${
1749|                        msg.role === "user"
1750|                          ? "bg-indigo-600 text-white rounded-br-sm"
1751|                          : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"
1752|                      }`}
1753|                    >
1754|                      {msg.role === "ai" && msg.agent === "brico"
1755|                        ? <span dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(msg.text) }} />
1756|                        : msg.text}
1757|                    </div>
1758|                    {msg.role === "user" && (
1759|                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
1760|                        <UserIcon size={12} className="text-gray-400" />
1761|                      </div>
1762|                    )}
1763|                  </div>
1764|                ))}
1765|                {loading && !hasProjectWithoutCdc && (
1766|                  <div className="flex gap-1.5 justify-start">
1767|                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
1768|                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
1769|                    </div>
1770|                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-bl-sm">
1771|                      {catalogLoading ? "Enrichissement catalogue…" : "Brico réfléchit…"}
1772|                    </div>
1773|                  </div>
1774|                )}
1775|              </div>
1776|            </div>
1777|          )}
1778|
1779|          {/* Chat pour le mode "Créer un CDC" */}
1780|          {expanded && hasProjectWithoutCdc && (
1781|            <div
1782|              className="flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
1783|              style={{ height: chatHeight }}
1784|            >
1785|              <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
1786|                <div className="flex items-center gap-2 text-xs">
1787|                  <Wand2 size={13} className="text-purple-400" />
1788|                  <span className="font-medium text-gray-300">
1789|                    Génération du CDC — {state.projectName}
1790|                  </span>
1791|                </div>
1792|                <button
1793|                  type="button"
1794|                  onClick={() => setExpanded(false)}
1795|                  className="text-gray-500 hover:text-gray-300 p-1"
1796|                  title="Réduire"
1797|                >
1798|                  <ChevronDown size={15} />
1799|                </button>
1800|              </div>
1801|              <div
1802|                ref={chatRef}
1803|                className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5"
1804|              >
1805|                {messages.map((msg, idx) => (
1806|                  <div
1807|                    key={idx}
1808|                    className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
1809|                  >
1810|                    {msg.role === "ai" && msg.agent === "brico" && (
1811|                      <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
1812|                        <Bot size={12} className="text-indigo-400" />
1813|                      </div>
1814|                    )}
1815|                    <div
1816|                      className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed ${
1817|                        msg.role === "user"
1818|                          ? "bg-indigo-600 text-white rounded-br-sm"
1819|                          : "bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-sm"
1820|                      }`}
1821|                    >
1822|                      {msg.role === "ai" && msg.agent === "brico"
1823|                        ? <span dangerouslySetInnerHTML={{ __html: renderMarkdownToHtml(msg.text) }} />
1824|                        : msg.text}
1825|                    </div>
1826|                    {msg.role === "user" && (
1827|                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
1828|                        <UserIcon size={12} className="text-gray-400" />
1829|                      </div>
1830|                    )}
1831|                  </div>
1832|                ))}
1833|                {loading && (
1834|                  <div className="flex gap-1.5 justify-start">
1835|                    <div className="w-6 h-6 rounded-full bg-indigo-900/50 flex items-center justify-center shrink-0 mt-0.5">
1836|                      <Loader2 size={12} className="text-indigo-400 animate-spin" />
1837|                    </div>
1838|                    <div className="px-2.5 py-1.5 rounded-lg text-xs bg-gray-800 border border-gray-700 text-gray-500 rounded-bl-sm">
1839|                      Brico génère le CDC…
1840|                    </div>
1841|                  </div>
1842|                )}
1843|              </div>
1844|            </div>
1845|          )}
1846|
1847|          {/* ── Barre de saisie (TOUJOURS en bas) ── */}
1848|          <div className="bg-gradient-to-t from-gray-100/80 via-gray-50/60 to-transparent backdrop-blur-lg border-t border-gray-200/30">
1849|            <div className="flex items-center gap-1.5 px-3 py-2.5 max-w-6xl mx-auto min-h-[56px]">
1850|              {/* Input pill — contenteditable avec chips enseigne */}
1851|              <div className="flex-1 relative min-w-0" ref={enseigneWrapperRef}>
1852|                <div
1853|                  ref={contentEditableRef}
1854|                  contentEditable
1855|                  suppressContentEditableWarning
1856|                  onInput={handleContentEditableInput}
1857|                  onKeyDown={handleKeyDown}
1858|                  onFocus={() => {
1859|                    // Rouvrir le dropdown @enseigne si @ est déjà présent
1860|                    if (!contentEditableRef.current) return;
1861|                    const sel = window.getSelection();
1862|                    if (!sel?.rangeCount) return;
1863|                    const range = sel.getRangeAt(0);
1864|                    const textNode = range.startContainer;
1865|                    if (textNode.nodeType !== Node.TEXT_NODE) return;
1866|                    const text = textNode.textContent || "";
1867|                    const cursorPos = range.startOffset;
1868|                    const beforeCursor = text.slice(0, cursorPos);
1869|                    const atIdx = beforeCursor.lastIndexOf("@");
1870|                    if (atIdx >= 0) {
1871|                      const charBefore = atIdx > 0 ? beforeCursor[atIdx - 1] : " ";
1872|                      if (charBefore === " " || charBefore === "\n" || atIdx === 0) {
1873|                        const afterAt = beforeCursor.slice(atIdx + 1).split(/\s/)[0];
1874|                        setEnseigneQuery(afterAt);
1875|                        setShowEnseigneDropdown(true);
1876|                      }
1877|                    }
1878|                  }}
1879|                  data-placeholder={
1880|                    mode === "demander"
1881|                      ? "Poser une question… (@ pour cibler une enseigne)"
1882|                      : "Décrire la modification… (@ pour cibler une enseigne)"
1883|                  }
1884|                  className="cdc-input w-full min-h-[40px] max-h-[120px] overflow-y-auto pl-9 pr-4 py-2 rounded-[20px] bg-white border border-gray-300
1885|                             text-sm text-gray-700
1886|                             focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none
1887|                             shadow-sm transition-shadow
1888|                             whitespace-pre-wrap break-words"
1889|                />
1890|
1891|                {/* Dropdown @enseigne — au-dessus de l'input */}
1892|                {showEnseigneDropdown &&
1893|                  filteredEnseignes.length > 0 &&
1894|                  createPortal(
1895|                    <div
1896|                      ref={enseigneDropdownRef}
1897|                      style={enseigneDropdownStyle}
1898|                      className="bg-white border border-gray-200 rounded-xl shadow-xl max-h-48 overflow-y-auto py-1"
1899|                    >
1900|                      {filteredEnseignes.map((ens, idx) => {
1901|                        const realIdx = state.enseignes.findIndex(
1902|                          (e) => e.id === ens.id,
1903|                        );
1904|                        const isTargeted = ens.id === targetedEnseigneId;
1905|                        const materiauxCount = Object.values(
1906|                          state.materiauxByEnseigne[ens.id] || {},
1907|                        ).flat().length;
1908|                        return (
1909|                          <button
1910|                            key={ens.id}
1911|                            type="button"
1912|                            onMouseDown={(e) => {
1913|                              // preventDefault + sélection dans le même handler → avant blur
1914|                              e.preventDefault();
1915|                              if (realIdx >= 0) handleSelectEnseigne(realIdx);
1916|                            }}
1917|                            className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
1918|                              idx === activeEnseigneIdx || isTargeted
1919|                                ? "bg-indigo-50 text-indigo-700"
1920|                                : "text-gray-700 hover:bg-gray-50"
1921|                            }`}
1922|                          >
1923|                            <Hash
1924|                              size={12}
1925|                              className={
1926|                                isTargeted
1927|                                  ? "text-indigo-400"
1928|                                  : "text-gray-300"
1929|                              }
1930|                            />
1931|                            <span className="font-medium flex-1">
1932|                              {ens.nom}
1933|                            </span>
1934|                            <span className="text-[10px] text-gray-400">
1935|                              {ens.dimensions.largeur}×{ens.dimensions.hauteur}
1936|                              {ens.dimensions.profondeur
1937|                                ? `×${ens.dimensions.profondeur}`
1938|                                : ""}{" "}
1939|                              cm
1940|                            </span>
1941|                            {materiauxCount > 0 && (
1942|                              <span className="text-[10px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
1943|                                {materiauxCount} mat.
1944|                              </span>
1945|                            )}
1946|                            {isTargeted && (
1947|                              <span className="text-[10px] text-indigo-400 font-medium">
1948|                                ciblée
1949|                              </span>
1950|                            )}
1951|                          </button>
1952|                        );
1953|                      })}
1954|                    </div>,
1955|                    document.body,
1956|                  )}
1957|
1958|                {/* Micro dans l'input */}
1959|                <button
1960|                  type="button"
1961|                  onClick={toggleListening}
1962|                  className={`absolute left-1.5 top-1/2 -translate-y-1/2 p-1 rounded-full transition-all ${
1963|                    isListening
1964|                      ? "text-red-500 animate-pulse"
1965|                      : "text-gray-400 hover:text-gray-600"
1966|                  }`}
1967|                  title={isListening ? "Arrêter l'écoute" : "Dicter"}
1968|                >
1969|                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
1970|                </button>
1971|              </div>
1972|
1973|              {/* Toggle Modifier / Demander — cercle */}
1974|              <button
1975|                type="button"
1976|                onClick={() =>
1977|                  setMode((prev) =>
1978|                    prev === "modifier" ? "demander" : "modifier",
1979|                  )
1980|                }
1981|                className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0 ${
1982|                  mode === "modifier"
1983|                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
1984|                    : "bg-white text-gray-400 border border-gray-300 hover:text-gray-600 hover:border-gray-400"
1985|                }`}
1986|                title={
1987|                  mode === "modifier"
1988|                    ? "Mode Modifier — clic pour Demander"
1989|                    : "Mode Demander — clic pour Modifier"
1990|                }
1991|              >
1992|                {mode === "modifier" ? (
1993|                  <Pencil size={15} />
1994|                ) : (
1995|                  <MessageCircle size={15} />
1996|                )}
1997|              </button>
1998|
1999|              {/* Envoyer — cercle */}
2000|              <button
2001|