// src/components/facture/FactureFooter.tsx
// Footer sticky avec widget chat Wari — modes Modifier/Demander.
// Adapté de CdcBuilderFooter — simplifié (pas d'@enseigne, pas de matériaux).

import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { routeMessage } from "@/services/hermesRouter";
import type { FactureData, DetailItem, FactureAction, FactureFooterMessage } from "@/types";
import type { User } from "@/types/user";
import { formatCFA } from "@/utils/format";

export interface FactureFooterProps {
  data: FactureData;
  onDataChange: (data: FactureData) => void;
  user: User;
  persistentSessionId: string;
  onSave: () => void;
  saving: boolean;
  changeCount: number;
  messageId?: string;
  /** Facture vide (nouvelle, sans articles) → affiche bouton "Générer la facture" */
  isEmpty?: boolean;
  /** Callback appelé quand Wari a généré une facture complète */
  onFactureGenerated?: (data: FactureData) => void;
}

/** Parse la réponse Wari — extrait le JSON d'actions */
function parseWariResponse(
  response: { textFallback?: string; factureActions?: FactureAction[] }
): { message: string; actions?: FactureAction[] } {
  // Niveau 0 : le backend a déjà extrait les actions
  if (response.factureActions?.length) {
    return { message: response.textFallback || '', actions: response.factureActions };
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

  return { message: text };
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
  isEmpty = false,
  onFactureGenerated,
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

  // Autoscroll chat
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

  /** Construit le prompt Modifier */
  const buildModifierPrompt = (message: string): string => {
    const articlesText = (data.details || [])
      .map(
        (d, i) =>
          `  ${i + 1}. ${d.description || "(sans description)"} ×${d.quantite} = ${formatCFA(d.sous_total)}`,
      )
      .join("\n");

    return `[Facture Builder — Mode Modifier]
Tu es Wari. Voici la facture en cours d'édition.

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

Instruction de l'utilisateur: ${message}

⚠️ FORMAT DE RÉPONSE OBLIGATOIRE :
1. Une courte analyse (1-3 phrases) expliquant ce que tu modifies et pourquoi.
2. Le JSON d'actions — SANS triple-backticks autour, SANS markdown. Juste le JSON brut.

Actions disponibles :
- updateClientField : { field: "nom"|"adresse"|"telephone", value: "..." }
- addDetail : { item: { description: "...", quantite: 1, prixUnitaire: 50000 } }
- updateDetail : { index: 0, changes: { quantite: 3 } }
- removeDetail : { index: 0 }
- setRemise : { value: 15000 }
- setStatut : { value: "Brouillon"|"Vérifié"|"Payé"|"Livré" }
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

  /** Prompt pour la génération complète */
  const buildGenerationPrompt = (): string => {
    return `[Facture Builder — Génération complète]
Tu es Wari. Génère une facture complète et cohérente.

Client: ${data.client.nom || "(à définir)"}
Adresse: ${data.client.adresse || "(à définir)"}

⚠️ INSTRUCTIONS :
1. Propose des articles cohérents avec le domaine (signalétique, enseignes, impression).
2. Remplis TOUS les champs : statut, échéancier, délai de livraison.
3. Les prix doivent être réalistes pour le marché ivoirien (en CFA).
4. ⚠️ FORMAT DE RÉPONSE OBLIGATOIRE : analyse (2-3 phrases) + JSON d'actions.

Exemple :
Analyse : facture pour une enseigne drapeau avec installation. 3 articles : structure alu, vinyle imprimé, main d'œuvre.

{"actions": [
  {"type":"updateClientField","field":"nom","value":"Client Exemple"},
  {"type":"updateClientField","field":"adresse","value":"Abidjan, Cocody"},
  {"type":"addDetail","item":{"description":"Structure aluminium 3×1m","quantite":1,"prixUnitaire":180000}},
  {"type":"addDetail","item":{"description":"Vinyle imprimé","quantite":3,"prixUnitaire":45000}},
  {"type":"addDetail","item":{"description":"Main d'œuvre installation","quantite":1,"prixUnitaire":120000}},
  {"type":"setStatut","value":"Brouillon"},
  {"type":"setEcheancier","value":"50% à la commande, 50% à la livraison"},
  {"type":"setDelaiLivraison","value":"10 jours ouvrés"}
]}`;
  };

  /** Appliquer les actions Wari à la facture */
  const applyActions = useCallback(
    (actions: FactureAction[], isGeneration = false) => {
      let newData = JSON.parse(JSON.stringify(data)) as FactureData;

      for (const action of actions) {
        switch (action.type) {
          case "updateClientField": {
            if (action.field && action.value !== undefined) {
              newData = {
                ...newData,
                client: {
                  ...newData.client,
                  [action.field]: action.value,
                },
              };
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
            }
            break;
          }
          case "updateDetail": {
            if (action.index != null && action.changes && newData.details?.[action.index]) {
              const updated = {
                ...newData.details[action.index],
                ...action.changes,
              };
              updated.sous_total =
                Number(updated.quantite) * Number(updated.prixUnitaire);
              const newDetails = [...newData.details];
              newDetails[action.index] = updated;
              newData = { ...newData, details: newDetails };
            }
            break;
          }
          case "removeDetail": {
            if (action.index != null && newData.details?.[action.index]) {
              newData = {
                ...newData,
                details: newData.details.filter((_, i) => i !== action.index),
              };
            }
            break;
          }
          case "setRemise": {
            newData = { ...newData, reduction: action.value ?? 0 };
            break;
          }
          case "setStatut": {
            newData = { ...newData, statut: action.value };
            break;
          }
          case "setEcheancier": {
            newData = { ...newData, echeancier: action.value };
            break;
          }
          case "setDelaiLivraison": {
            newData = { ...newData, delaiLivraison: action.value };
            break;
          }
          case "updateField": {
            if (action.field) {
              (newData as any)[action.field] = action.value;
            }
            break;
          }
        }
      }

      // Recalculer le total
      const base = (newData.details || []).reduce(
        (sum, d) => sum + d.sous_total,
        0,
      );
      newData.total = base - (newData.reduction ?? 0);

      onDataChange(newData);

      if (isGeneration && onFactureGenerated) {
        onFactureGenerated(newData);
      }
    },
    [data, onDataChange, onFactureGenerated],
  );

  /** Envoyer un message */
  const handleSend = async () => {
    if (!contentEditableRef.current || loading) return;

    const text = contentEditableRef.current.innerText?.trim() || "";
    if (!text) return;

    const userMsg: FactureFooterMessage = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    // Vider le contenteditable
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = "";
    }

    setLoading(true);
    setExpanded(true);

    try {
      const prompt =
        mode === "modifier"
          ? buildModifierPrompt(text)
          : text;

      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
      };

      const response = await routeMessage(payload, "wari");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      if (mode === "modifier") {
        const parsed = parseWariResponse({
          textFallback: responseText,
          factureActions: (response.response as any).factureActions,
        });
        setMessages((prev) => [
          ...prev,
          { role: "wari", text: parsed.message || responseText },
        ]);
        if (parsed.actions?.length) {
          applyActions(parsed.actions, false);
        } else {
          console.warn(
            "[FactureFooter] Réponse Wari sans actions parsables:",
            responseText.slice(0, 200),
          );
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

  /** Génération complète de la facture via Wari */
  const handleGenerateFacture = async () => {
    if (loading) return;
    setLoading(true);
    setExpanded(true);

    const prompt = buildGenerationPrompt();

    setMessages([
      {
        role: "user",
        text: `🪄 Génère la facture complète`,
      },
    ]);

    try {
      const payload = {
        userId: user.id,
        sessionId: persistentSessionId,
        timestamp: new Date().toISOString(),
        message: { type: "text" as const, content: prompt, attachments: [] },
      };

      const response = await routeMessage(payload, "wari");
      const responseText =
        response.response.textFallback || "Aucune réponse.";

      const parsed = parseWariResponse({
        textFallback: responseText,
        factureActions: (response.response as any).factureActions,
      });
      setMessages((prev) => [
        ...prev,
        { role: "wari", text: parsed.message || responseText },
      ]);

      if (parsed.actions?.length) {
        applyActions(parsed.actions, true);
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
          contentEditableRef.current.appendChild(
            document.createTextNode(transcript + " "),
          );
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

  // ── Hauteurs (identiques à CdcBuilderFooter) ──
  const chatHeight = 280;
  const actionBarHeight = 34;
  const inputBarHeight = 56;
  const collapsedSpacer = actionBarHeight + inputBarHeight + 10; // ~100px
  const expandedSpacer = collapsedSpacer + chatHeight + 4; // ~384px

  return (
    <>
      {/* Spacer pour éviter que le contenu passe sous le footer */}
      <div
        style={{ height: expanded ? expandedSpacer : collapsedSpacer }}
        aria-hidden="true"
      />

      {/* Footer fixe */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-6xl mx-auto flex flex-col">
          {/* ── Barre d'actions ── */}
          {isEmpty ? (
            /* Facture vide → bouton Discussion + Générer */
            <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-900/50 border-b border-white/10">
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

              {/* Générer la facture — bouton vert large */}
              <button
                type="button"
                onClick={handleGenerateFacture}
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
                  {loading ? "Génération en cours…" : "Générer la facture"}
                </span>
              </button>
            </div>
          ) : (
            /* Action bar normale */
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

              {/* Séparateur */}
              <div className="w-px h-4 bg-white/20 mx-0.5" />

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
          )}

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
                      <span className="font-medium text-gray-300">
                        Modifier la facture
                      </span>
                    </>
                  ) : (
                    <>
                      <MessageCircle size={13} className="text-gray-400" />
                      <span className="font-medium text-gray-300">
                        Discussion
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
                      ? "Décris les modifications à apporter à la facture. Wari les appliquera automatiquement."
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

          {/* ── Barre de saisie ── */}
          <div className="bg-gradient-to-t from-gray-100/80 via-gray-50/60 to-transparent backdrop-blur-lg border-t border-gray-200/30">
            <div className="flex items-center gap-1.5 px-3 py-2.5 max-w-6xl mx-auto min-h-[56px]">
              {/* Input pill — contenteditable simple (sans @enseigne) */}
              <div className="flex-1 relative min-w-0">
                <div
                  ref={contentEditableRef}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyDown={handleKeyDown}
                  data-placeholder={
                    mode === "demander"
                      ? "Poser une question…"
                      : "Décrire la modification…"
                  }
                  className="w-full min-h-[40px] max-h-[120px] overflow-y-auto pl-9 pr-4 py-2 rounded-[20px] bg-white border border-gray-300
                             text-sm text-gray-700
                             focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400 outline-none
                             shadow-sm transition-shadow
                             whitespace-pre-wrap break-words
                             empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
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
