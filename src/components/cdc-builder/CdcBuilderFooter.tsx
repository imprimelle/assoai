// src/components/cdc-builder/CdcBuilderFooter.tsx
// Footer sticky avec widget chat Brico — modes Modifier/Demander.
// v5: mode compact repensé (input + send + toggles + micro), transparence, chat réduit.
// Envoie le CDC state à Hermes Brico, parse la réponse JSON, applique les actions.

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  MessageCircle,
  ChevronUp,
  Send,
  Loader2,
  User as UserIcon,
  Mic,
  MicOff,
  Wand2,
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
  /** Callback après application d'actions Brico — passe les highlights pour flash animation */
  onHighlightsChange?: (
    highlights: Record<string, "added" | "modified">,
  ) => void;
}

/** Parse la réponse texte de Brico pour extraire les actions JSON */
function parseBricoResponse(
  text: string,
): { message: string; actions?: BricoAction[] } {
  // Chercher un bloc JSON contenant "actions"
  const jsonMatch = text.match(/\{[\s\S]*"actions"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        message: text.replace(jsonMatch[0], "").trim(),
        actions: parsed.actions,
      };
    } catch {
      // JSON invalide — on retourne le texte brut
    }
  }
  return { message: text };
}

const CdcBuilderFooter: React.FC<CdcBuilderFooterProps> = ({
  state,
  onStateChange,
  user,
  persistentSessionId,
  onHighlightsChange,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"modifier" | "demander" | null>(null);
  const [messages, setMessages] = useState<CdcBuilderFooterMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Micro
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Autoscroll au nouveau message
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input quand on expand
  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  // Nettoyage reconnaissance vocale au démontage
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const activeEnseigne = state.enseignes[state.activeEnseigneIndex];
  const materiauxSections =
    state.materiauxByEnseigne[activeEnseigne?.id] || {};
  const rows: FlatMaterialRow[] = sectionsToRows(materiauxSections);

  /** Construire le prompt « Modifier » avec le CDC complet */
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

  /** Appliquer les actions Brico sur le state et émettre les highlights */
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
    [
      activeEnseigne,
      materiauxSections,
      state,
      onStateChange,
      onHighlightsChange,
    ],
  );

  /** Envoyer un message à Brico */
  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const effectiveMode = mode || "modifier";

    const userMsg: CdcBuilderFooterMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const prompt =
        effectiveMode === "modifier"
          ? buildModifierPrompt(text)
          : text;

      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: {
          type: "text" as const,
          content: prompt,
          attachments: [],
        },
      };

      const response = await routeMessage(payload, "brico");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      if (effectiveMode === "modifier") {
        const parsed = parseBricoResponse(responseText);
        const bricoMsg: CdcBuilderFooterMessage = {
          role: "brico",
          text: parsed.message || responseText,
        };
        setMessages((prev) => [...prev, bricoMsg]);

        if (parsed.actions && parsed.actions.length > 0) {
          applyActions(parsed.actions);
        }
      } else {
        const bricoMsg: CdcBuilderFooterMessage = {
          role: "brico",
          text: responseText,
        };
        setMessages((prev) => [...prev, bricoMsg]);
      }
    } catch (err: any) {
      const errorMsg: CdcBuilderFooterMessage = {
        role: "brico",
        text: `❌ Erreur: ${err.message || "Impossible de contacter Brico."}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
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

  const handleCollapse = () => {
    setExpanded(false);
  };

  const chatHeight = 220;

  return (
    <>
      {/* Spacer pour éviter que le contenu passe sous le footer */}
      <div
        style={{ height: expanded ? chatHeight + 10 : 60 }}
        aria-hidden="true"
      />

      {/* Footer fixe — translucide */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 border-t border-gray-300/50 shadow-lg transition-colors duration-200 ${
          expanded
            ? "bg-gray-100/95 backdrop-blur-md"
            : "bg-gray-100/60 backdrop-blur-sm"
        }`}
      >
        {/* Mode compact : input + send + toggles + micro */}
        {!expanded ? (
          <div className="flex items-center gap-2 px-4 h-[60px] max-w-6xl mx-auto">
            {/* Input texte */}
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === "demander"
                  ? "Pose ta question…"
                  : "Décris la modification…"
              }
              className="flex-1 h-10 border border-gray-300/60 bg-white/80 backdrop-blur rounded-xl px-4 text-sm
                         focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none
                         placeholder:text-gray-400"
            />

            {/* Bouton Envoyer */}
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-xl
                         bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              title="Envoyer"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>

            {/* Séparateur */}
            <div className="w-px h-6 bg-gray-300/50 shrink-0" />

            {/* Mode Modifier */}
            <button
              type="button"
              onClick={() => setMode("modifier")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all shrink-0 ${
                mode === "modifier" || mode === null
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white/70 text-gray-600 border border-gray-200/50 hover:bg-white"
              }`}
              title="Brico modifie le CDC selon tes instructions"
            >
              <Wand2 size={14} />
              <span className="hidden sm:inline">Modifier</span>
            </button>

            {/* Mode Demander */}
            <button
              type="button"
              onClick={() => setMode("demander")}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all shrink-0 ${
                mode === "demander"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white/70 text-gray-600 border border-gray-200/50 hover:bg-white"
              }`}
              title="Pose une question à Brico"
            >
              <MessageCircle size={14} />
              <span className="hidden sm:inline">Demander</span>
            </button>

            {/* Séparateur */}
            <div className="w-px h-6 bg-gray-300/50 shrink-0" />

            {/* Microphone */}
            <button
              type="button"
              onClick={toggleListening}
              className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all shrink-0 ${
                isListening
                  ? "bg-red-500 text-white animate-pulse shadow-sm shadow-red-200"
                  : "bg-white/70 text-gray-500 border border-gray-200/50 hover:text-indigo-600 hover:bg-white"
              }`}
              title={isListening ? "Arrêter l'écoute" : "Dicter"}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>
        ) : (
          /* Mode expanded */
          <div
            className="max-w-6xl mx-auto flex flex-col"
            style={{ height: chatHeight }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-10 border-b border-gray-300/50 bg-white/50 shrink-0">
              <div className="flex items-center gap-2 text-sm">
                {mode === "modifier" ? (
                  <>
                    <Wand2 size={15} className="text-indigo-600" />
                    <span className="font-medium text-indigo-900 text-xs">
                      ✨ Modifier — Brico modifie le CDC
                    </span>
                  </>
                ) : (
                  <>
                    <MessageCircle size={15} className="text-gray-600" />
                    <span className="font-medium text-gray-700 text-xs">
                      💬 Discussion — {activeEnseigne?.nom || "—"}
                    </span>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={handleCollapse}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                title="Réduire"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={chatRef}
              className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5 bg-gray-50/30"
            >
              {messages.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-3">
                  {mode === "modifier"
                    ? "Demande à Brico de modifier le CDC — il peut ajouter, modifier ou supprimer des matériaux."
                    : "Pose une question à Brico sur le CDC en cours."}
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "brico" && (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot size={12} className="text-indigo-600" />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] px-2.5 py-1.5 rounded-lg text-xs whitespace-pre-wrap leading-relaxed
                      ${msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm"
                      }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                      <UserIcon size={12} className="text-gray-600" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-1.5 justify-start">
                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Loader2 size={12} className="text-indigo-600 animate-spin" />
                  </div>
                  <div className="px-2.5 py-1.5 rounded-lg text-xs bg-white border border-gray-200 text-gray-400 rounded-bl-sm">
                    Brico réfléchit…
                  </div>
                </div>
              )}
            </div>

            {/* Input bar en mode expanded */}
            <div className="flex items-center gap-2 px-4 h-11 border-t border-gray-300/50 bg-white/50 shrink-0">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder={
                  mode === "modifier"
                    ? "Ex: Ajoute 2m de LED 6000K…"
                    : "Pose ta question…"
                }
                className="flex-1 h-8 border border-gray-200 rounded-lg px-3 bg-white text-sm
                           focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none
                           disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-all shrink-0 ${
                  isListening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-gray-400 hover:text-indigo-600"
                }`}
                title={isListening ? "Arrêter" : "Dicter"}
              >
                {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center w-8 h-8 rounded-lg
                           bg-indigo-600 text-white hover:bg-indigo-700 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CdcBuilderFooter;
