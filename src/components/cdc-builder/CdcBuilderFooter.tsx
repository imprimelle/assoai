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
  CdcBuilderFooterMessage,
  BricoAction,
} from "@/types/cdcBuilder";
import type { MaterialItem } from "@/types";
import type { FlatMaterialRow } from "@/components/templates/shared/MaterialTable";
import type { User } from "@/types/user";

export interface CdcBuilderFooterProps {
  state: CdcBuilderState;
  onStateChange: (state: CdcBuilderState) => void;
  user: User;
  persistentSessionId: string;
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
}

/** Parse la réponse texte de Brico pour extraire les actions JSON */
function parseBricoResponse(
  text: string,
): { message: string; actions?: BricoAction[] } {
  const jsonMatch = text.match(/\{[\s\S]*"actions"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: text.replace(jsonMatch[0], "").trim(),
        actions: parsed.actions,
      };
    } catch {}
  }
  return { message: text };
}

const CdcBuilderFooter: React.FC<CdcBuilderFooterProps> = ({
  state,
  onStateChange,
  user,
  persistentSessionId,
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
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"modifier" | "demander">("modifier");
  const [messages, setMessages] = useState<CdcBuilderFooterMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Micro
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
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
    if (showEnseigneDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
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

  /** Enseigne ciblée (via @ ou null = Brico décide) */
  const targetedEnseigne = targetedEnseigneId
    ? state.enseignes.find((e) => e.id === targetedEnseigneId)
    : null;

  /** Construit le prompt Modifier — avec @ → focus + BOM, sans @ → toutes les enseignes */
  const buildModifierPrompt = (
    message: string,
    explicitTargetId?: string,
  ): string => {
    const targetId = explicitTargetId || targetedEnseigneId;
    const targetEns = targetId
      ? state.enseignes.find((e) => e.id === targetId)
      : null;

    // Contexte détaillé de TOUTES les enseignes (toujours inclus)
    const allEnseignesText = state.enseignes
      .map((ens) => {
        const mats = Object.values(
          state.materiauxByEnseigne[ens.id] || {},
        ).flat();
        const matList =
          mats.length > 0
            ? mats
                .map(
                  (m) =>
                    `    [${/* section */ ""}] ${m.nom} ×${m.quantite} ${m.unite || ""}`,
                )
                .join("\n")
            : "    (aucun matériau)";
        return `- ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)\n${matList}`;
      })
      .join("\n\n");

    const focusBlock = targetEns
      ? `\n🎯 Enseigne mentionnée par l'utilisateur: ${targetEns.nom}
Dimensions: ${targetEns.dimensions.largeur}×${targetEns.dimensions.hauteur}cm
⚠️ Recherche aussi sa nomenclature (BOM) si pertinent.`
      : `\n📋 Aucune enseigne spécifique mentionnée — c'est toi qui détermines laquelle modifier selon la demande.`;

    return `[CDC Builder — Mode Modifier]
Tu es Brico. Voici le CDC en cours de construction.

Projet: ${state.projectName || "Sans titre"}
CDC N°: ${state.cdcNumero || "?"}
Commande N°: ${state.commandeId || "?"}

📋 Toutes les enseignes du CDC (avec leurs matériaux):
${allEnseignesText}
${focusBlock}

Instruction de l'utilisateur: ${message}

Réponds avec tes suggestions. Si tu modifies le CDC, inclus UNIQUEMENT un bloc JSON:
\`\`\`json
{"actions": [
  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"...","quantite":1,"unite":"plaque","largeur":400,"hauteur":150}},
  {"type":"update","section":"Découpe","enseigneIndex":0,"index":0,"changes":{"quantite":2}},
  {"type":"delete","section":"Éclairage","enseigneIndex":0,"index":0}
]}
\`\`\`
⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne s'applique chaque action.`;
  };

  /** Prompt pour la génération complète d'un CDC (bouton "Créer un CDC") */
  const buildGenerationPrompt = (): string => {
    const allEnseignesText = state.enseignes
      .map(
        (ens) =>
          `- ${ens.nom} (${ens.dimensions.largeur}×${ens.dimensions.hauteur}cm)`,
      )
      .join("\n");

    return `[CDC Builder — Génération complète]
Tu es Brico. Génère un Cahier des Charges complet pour ce projet.

Projet: ${state.projectName || "Sans titre"}
CDC N°: ${state.cdcNumero || "?"}
Commande N°: ${state.commandeId || "?"}

Enseignes à couvrir:
${allEnseignesText}

⚠️ INSTRUCTIONS CRITIQUES :
1. Pour CHAQUE enseigne, remplis les 5 sections (Découpe, Éclairage, Outillage, Métal, Vinyl) avec des matériaux pertinents.
2. Utilise tes connaissances des règles de fabrication (manufacturing-rules) pour déterminer les bons matériaux.
3. Les quantités doivent respecter les dimensions de chaque enseigne.
4. Produis UNIQUEMENT un bloc JSON avec TOUTES les actions pour TOUTES les enseignes :

\`\`\`json
{"actions": [
  {"type":"add","section":"Découpe","enseigneIndex":0,"item":{"nom":"Plexiglass 5mm","quantite":1,"unite":"plaque","largeur":400,"hauteur":150}},
  {"type":"add","section":"Éclairage","enseigneIndex":0,"item":{"nom":"Bande LED 12V","quantite":12,"unite":"mètres"}},
  {"type":"add","section":"Outillage","enseigneIndex":0,"item":{"nom":"Kit visserie inox","quantite":1,"unite":"lot"}},
  ...
]}
\`\`\`

⚠️ Utilise "enseigneIndex" (0, 1, 2...) pour indiquer à quelle enseigne appartient chaque matériau.`;
  };

  /** Appliquer les actions Brico — support multi-enseignes via enseigneIndex */
  const applyActions = useCallback(
    (actions: BricoAction[]) => {
      if (state.enseignes.length === 0) return;

      const newMateriaux = { ...state.materiauxByEnseigne };
      const highlights: Record<string, "added" | "modified"> = {};
      let modified = false;

      for (const action of actions) {
        // Déterminer l'enseigne cible (par défaut la 1ère enseigne)
        const ensIdx =
          (action as any).enseigneIndex != null
            ? (action as any).enseigneIndex
            : 0;
        const targetEns = state.enseignes[ensIdx];
        if (!targetEns) continue;

        const ensId = targetEns.id;
        const currentSections = { ...(newMateriaux[ensId] || {}) };
        const section = currentSections[action.section] || [];

        switch (action.type) {
          case "add": {
            if (action.item) {
              const newItem: MaterialItem = {
                id:
                  crypto.randomUUID?.() ||
                  `mat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
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
              highlights[`${action.section}-${section.length}`] = "added";
              modified = true;
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
                i === action.index ? { ...item, ...action.changes } : item,
              );
              highlights[`${action.section}-${action.index}`] = "modified";
              modified = true;
            }
            break;
          }
          case "delete": {
            if (action.index != null && action.index < section.length) {
              currentSections[action.section] = section.filter(
                (_, i) => i !== action.index,
              );
              modified = true;
            }
            break;
          }
        }

        newMateriaux[ensId] = currentSections;
      }

      if (modified) {
        onStateChange({
          ...state,
          materiauxByEnseigne: newMateriaux,
        });
        if (onHighlightsChange && Object.keys(highlights).length > 0) {
          onHighlightsChange(highlights);
          setTimeout(() => onHighlightsChange({}), 2200);
        }
        // Notifier le parent (pour le callback onCdcGenerated)
        if (onCdcGenerated) {
          onCdcGenerated({
            ...state,
            materiauxByEnseigne: newMateriaux,
          });
        }
      }
    },
    [state, onStateChange, onHighlightsChange, onCdcGenerated],
  );

  /** Sélection d'une enseigne via @ */
  const handleSelectEnseigne = (ensIdx: number) => {
    setShowEnseigneDropdown(false);
    setEnseigneQuery("");
    const ens = state.enseignes[ensIdx];
    // Définir l'enseigne ciblée pour le prochain message
    setTargetedEnseigneId(ens?.id || null);
    // Remplacer le @query dans l'input par le nom de l'enseigne
    const atPos = input.lastIndexOf("@");
    if (atPos >= 0) {
      const before = input.slice(0, atPos);
      // Garder le @nom pour le contexte
      const afterAt = input.slice(atPos).replace(/@\S*/, `@${ens.nom}`);
      setInput(before + afterAt + " ");
    }
    inputRef.current?.focus();
  };

  /** Envoyer un message */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: CdcBuilderFooterMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setExpanded(true);

    // Détecter si un @enseigne est présent pour cibler une enseigne spécifique
    let targetEnseigneId: string | undefined;
    const atMatch = text.match(/@(\S+)/);
    if (atMatch) {
      const refName = atMatch[1].toLowerCase();
      const matched = state.enseignes.find((ens) =>
        ens.nom.toLowerCase().includes(refName),
      );
      if (matched) {
        targetEnseigneId = matched.id;
      }
    }

    try {
      const prompt =
        mode === "modifier"
          ? buildModifierPrompt(text, targetEnseigneId)
          : text;

      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
      };

      const response = await routeMessage(payload, "brico");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      if (mode === "modifier") {
        const parsed = parseBricoResponse(responseText);
        setMessages((prev) => [
          ...prev,
          { role: "brico", text: parsed.message || responseText },
        ]);
        if (parsed.actions?.length) applyActions(parsed.actions);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "brico", text: responseText },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "brico",
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

      const parsed = parseBricoResponse(responseText);
      setMessages((prev) => [
        ...prev,
        { role: "brico", text: parsed.message || responseText },
      ]);

      if (parsed.actions?.length) {
        applyActions(parsed.actions);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "brico",
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

    // Envoi normal
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /** Gestion de l'input — détecte @ pour le dropdown enseigne */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInput(raw);

    // Détecter @ pour le dropdown enseigne
    const atIdx = raw.lastIndexOf("@");
    if (atIdx >= 0) {
      const afterAt = raw.slice(atIdx + 1);
      // Ne pas déclencher si c'est au milieu d'un mot (email, etc.)
      const charBefore = atIdx > 0 ? raw[atIdx - 1] : "";
      if (charBefore === "" || charBefore === " " || charBefore === "\n") {
        setEnseigneQuery(afterAt.split(/\s/)[0]); // premier mot après @
        setShowEnseigneDropdown(true);
        setActiveEnseigneIdx(0);
        return;
      }
    }
    setShowEnseigneDropdown(false);
    setEnseigneQuery("");
  };

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
      setInput((prev) => (prev ? prev + " " + transcript : transcript));
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
            /* Projet lié sans CDC — bouton Discussion + Générer */
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
              {/* 💬 Discussion — conservé */}
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

              {/* Générer le CDC — bouton vert large */}
              <button
                type="button"
                onClick={handleGenerateCdc}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold
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
                disabled={saving}
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
                    {msg.role === "brico" && (
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
                      {msg.text}
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
                      Brico réfléchit…
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
                    {msg.role === "brico" && (
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
              {/* Input pill avec micro intégré à gauche — fond blanc */}
              <div className="flex-1 relative min-w-0" ref={enseigneWrapperRef}>
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onFocus={() => {
                    // Rouvrir le dropdown @enseigne si @ est déjà présent
                    const atIdx = input.lastIndexOf("@");
                    if (atIdx >= 0) {
                      const charBefore = atIdx > 0 ? input[atIdx - 1] : "";
                      if (charBefore === "" || charBefore === " " || charBefore === "\n") {
                        const afterAt = input.slice(atIdx + 1).split(/\s/)[0];
                        setEnseigneQuery(afterAt);
                        setShowEnseigneDropdown(true);
                      }
                    }
                  }}
                  placeholder={
                    mode === "demander"
                      ? "Poser une question… (@ pour cibler une enseigne)"
                      : "Décrire la modification… (@ pour cibler une enseigne)"
                  }
                  className="w-full h-10 pl-9 pr-4 rounded-full bg-white border border-gray-300
                             text-sm text-gray-700 placeholder:text-gray-400
                             focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none
                             shadow-sm transition-shadow"
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
                              // preventDefault pour éviter que l'input perde le focus
                              e.preventDefault();
                            }}
                            onClick={() => {
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
                disabled={loading || !input.trim()}
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
