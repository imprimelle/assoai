// src/components/cdc-builder/CdcBuilderFooter.tsx
// Footer sticky avec widget chat Brico — modes Modifier/Demander.
// v6: redesign — fond sombre, input pill avec micro intégré, toggle ✏️/💬, chat compact.
// Envoie le CDC state à Hermes Brico, parse la réponse JSON, applique les actions.

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  MessageCircle,
  ChevronDown,
  Send,
  Loader2,
  User as UserIcon,
  Mic,
  MicOff,
  Pencil,
  LayoutGrid,
  Save,
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

  const activeEnseigne = state.enseignes[state.activeEnseigneIndex];
  const materiauxSections =
    state.materiauxByEnseigne[activeEnseigne?.id] || {};
  const rows: FlatMaterialRow[] = sectionsToRows(materiauxSections);

  /** Prompt Modifier avec le CDC complet */
  const buildModifierPrompt = (message: string): string => {
    const materialsText = rows
      .map(
        (r) =>
          `[${r.section}] ${r.item.nom} | Qté:${r.item.quantite} ${r.item.unite || ""} | ${r.item.largeur || "-"}×${r.item.hauteur || "-"} | ${r.item.couleur || "-"} ${r.item.epaisseur || ""}`,
      )
      .join("\n");

    return `[CDC Builder — Mode Modifier]
Tu es Brico. Voici le CDC en cours de construction.

Projet: ${state.projectName || "Sans titre"}
Enseigne active: ${activeEnseigne?.nom || "—"}
Dimensions: ${activeEnseigne?.dimensions.largeur || "?"}×${activeEnseigne?.dimensions.hauteur || "?"}cm

Matériaux actuels (par section):
${materialsText || "(aucun matériau)"}

Instruction de l'utilisateur: ${message}

Réponds avec tes suggestions. Si tu modifies le CDC, inclus UNIQUEMENT un bloc JSON:
\`\`\`json
{"actions": [
  {"type":"add","section":"Découpe","item":{"nom":"...","quantite":1,"unite":"plaque","largeur":400,"hauteur":150}},
  {"type":"update","section":"Découpe","index":0,"changes":{"quantite":2}},
  {"type":"delete","section":"Éclairage","index":0}
]}
\`\`\``;
  };

  /** Appliquer les actions Brico */
  const applyActions = useCallback(
    (actions: BricoAction[]) => {
      if (!activeEnseigne) return;

      const currentSections = { ...materiauxSections };
      const highlights: Record<string, "added" | "modified"> = {};
      let modified = false;

      for (const action of actions) {
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
      }

      if (modified) {
        onStateChange({
          ...state,
          materiauxByEnseigne: {
            ...state.materiauxByEnseigne,
            [activeEnseigne.id]: currentSections,
          },
        });
        if (onHighlightsChange && Object.keys(highlights).length > 0) {
          onHighlightsChange(highlights);
          setTimeout(() => onHighlightsChange({}), 2200);
        }
      }
    },
    [activeEnseigne, materiauxSections, state, onStateChange, onHighlightsChange],
  );

  /** Envoyer un message */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: CdcBuilderFooterMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setExpanded(true);

    try {
      const prompt =
        mode === "modifier" ? buildModifierPrompt(text) : text;

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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

  return (
    <>
      <div
        style={{ height: expanded ? chatHeight + 10 : 96 }}
        aria-hidden="true"
      />

      {/* Footer fixe — fond sombre */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        {/* Chat expandé */}
        {expanded && (
          <div
            className="max-w-6xl mx-auto flex flex-col bg-gray-900/70 backdrop-blur-lg border-t border-gray-700/20 shadow-2xl"
            style={{ height: chatHeight }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-9 border-b border-gray-700/50 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                {mode === "modifier" ? (
                  <>
                    <Pencil size={13} className="text-indigo-400" />
                    <span className="font-medium text-gray-300">
                      Modifier — {activeEnseigne?.nom || "—"}
                    </span>
                  </>
                ) : (
                  <>
                    <MessageCircle size={13} className="text-gray-400" />
                    <span className="font-medium text-gray-300">
                      Discussion — {activeEnseigne?.nom || "—"}
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
                    ? "Demande à Brico de modifier le CDC."
                    : "Pose une question à Brico."}
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
              {loading && (
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

        {/* Barre d'actions — icônes + labels compacts */}
        <div className="flex items-center justify-center gap-1 px-3 py-1.5 bg-gradient-to-t from-gray-900/50 via-gray-900/30 to-transparent border-b border-gray-700/10">
          {/* Toggle Vue consolidée */}
          <button
            type="button"
            onClick={onToggleConsolidated}
            className={`flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all ${
              showConsolidated
                ? "bg-indigo-500/25 text-indigo-300"
                : "text-white/80 hover:text-white hover:bg-white/10"
            }`}
            title={showConsolidated ? "Vue par enseigne" : "Vue consolidée (toutes les enseignes)"}
          >
            <LayoutGrid size={13} />
            <span className="hidden sm:inline">Tout</span>
          </button>

          {/* Tout replier/déplier */}
          {!showConsolidated && (
            <button
              type="button"
              onClick={onToggleAllOpen}
              className="flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
              title={allOpen ? "Tout replier" : "Tout déplier"}
            >
              <span className="text-xs">{allOpen ? "🔽" : "🔼"}</span>
              <span className="hidden sm:inline">{allOpen ? "Replier" : "Déplier"}</span>
            </button>
          )}

          {/* Séparateur */}
          <div className="w-px h-4 bg-white/15 mx-0.5" />

          {/* Compteur enseignes */}
          <span className="text-xs text-white/60 font-medium min-w-[20px] text-center select-none">
            {state.enseignes.length}
          </span>

          {/* Sauvegarde avec badge compteur */}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="relative flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium transition-all
                       text-white/80 hover:text-emerald-300 hover:bg-white/10 disabled:opacity-50"
            title={state.savedMessageId ? "Mettre à jour le CDC" : "Sauvegarder le CDC"}
          >
            {saving ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Save size={13} />
            )}
            <span className="hidden sm:inline">
              {state.savedMessageId ? "MàJ" : "Sauver"}
            </span>
            {changeCount > 0 && !saving && (
              <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] flex items-center justify-center
                               bg-red-500 text-white text-[9px] font-bold rounded-full px-0.5 leading-none">
                {changeCount > 99 ? "99+" : changeCount}
              </span>
            )}
          </button>
        </div>

        {/* Barre de saisie compacte — fond dégradé vers transparent, input blanc */}
        <div className="bg-gradient-to-t from-gray-100/80 via-gray-50/60 to-transparent backdrop-blur-lg border-t border-gray-200/30">
          <div className="flex items-center gap-1.5 px-3 py-2.5 max-w-6xl mx-auto min-h-[56px]">
            {/* Input pill avec micro intégré à gauche — fond blanc */}
            <div className="flex-1 relative min-w-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  mode === "demander"
                    ? "Poser une question…"
                    : "Décrire la modification…"
                }
                className="w-full h-10 pl-9 pr-4 rounded-full bg-white border border-gray-300
                           text-sm text-gray-700 placeholder:text-gray-400
                           focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 outline-none
                           shadow-sm transition-shadow"
              />
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
                setMode((prev) => (prev === "modifier" ? "demander" : "modifier"))
              }
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-all shrink-0 ${
                mode === "modifier"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "bg-white text-gray-400 border border-gray-300 hover:text-gray-600 hover:border-gray-400"
              }`}
              title={mode === "modifier" ? "Mode Modifier — clic pour Demander" : "Mode Demander — clic pour Modifier"}
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
    </>
  );
};

export default CdcBuilderFooter;
