// src/hooks/useChatPersistence.ts
// Hook générique de persistance des fils de discussion (CDC, Facture, Devis, Commande).
// Architecture hybride : localStorage (cache instantané) + Supabase (source de vérité).
//
// Utilisation :
//   const { messages, setMessages, loading } = useChatPersistence({
//     chatIdentity: "draft-xxx" | "abc-123",
//     documentMessageId: state.savedMessageId || null,
//     documentType: "cdc",
//     agent: "brico",
//   });

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──

export interface ChatMessage {
  role: "user" | "ai";
  text: string;
  agent?: string;
}

export interface UseChatPersistenceOptions {
  /** Identité stable du thread (draft UUID ou savedMessageId) */
  chatIdentity: string;
  /** ID du message Supabase quand le document est sauvegardé (null = brouillon) */
  documentMessageId: string | null;
  /** Type de document : "cdc" | "facture" | "devis" | "commande" */
  documentType: string;
  /** Agent conversationnel : "brico" | "wari" | "pm" */
  agent?: string;
}

const LS_PREFIX = "assoai-thread-";

// ── Helpers Supabase ──

async function loadFromSupabase(
  chatIdentity: string,
  documentMessageId: string | null,
): Promise<ChatMessage[]> {
  try {
    let query = supabase
      .from("message_threads")
      .select("role, text, agent")
      .order("timestamp", { ascending: true });

    if (documentMessageId) {
      query = query.eq("document_message_id", documentMessageId);
    } else {
      query = query.eq("thread_identity", chatIdentity);
    }

    const { data, error } = await query;
    if (error || !data) return [];
    return data as ChatMessage[];
  } catch {
    return [];
  }
}

async function insertMessages(
  chatIdentity: string,
  documentMessageId: string | null,
  documentType: string,
  agent: string | undefined,
  messages: ChatMessage[],
): Promise<void> {
  if (messages.length === 0) return;

  const rows = messages.map((m) => ({
    document_type: documentType,
    document_message_id: documentMessageId || null,
    thread_identity: chatIdentity,
    role: m.role,
    text: m.text,
    agent: agent || null,
  }));

  try {
    await supabase.from("message_threads").insert(rows);
  } catch {
    // Silencieux — localStorage reste le fallback
  }
}

async function updateDocumentMessageId(
  chatIdentity: string,
  newDocumentMessageId: string,
): Promise<void> {
  try {
    await supabase
      .from("message_threads")
      .update({ document_message_id: newDocumentMessageId })
      .eq("thread_identity", chatIdentity)
      .is("document_message_id", null);
  } catch {
    // Silencieux
  }
}

// ── Hook ──

export function useChatPersistence(options: UseChatPersistenceOptions) {
  const { chatIdentity, documentMessageId, documentType, agent } = options;

  // localStorage key
  const lsKey = LS_PREFIX + chatIdentity;

  // Messages state — chargement initial depuis localStorage (instantané)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem(lsKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(false);

  // Track last synced index to only sync new messages
  const lastSyncedRef = useRef(0);
  // Track previous documentMessageId to detect "first save"
  const prevDocIdRef = useRef(documentMessageId);

  // ── Load from Supabase on mount / identity change ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadFromSupabase(chatIdentity, documentMessageId).then((serverMessages) => {
      if (cancelled) return;
      if (serverMessages.length > 0) {
        // Supabase a des données → source de vérité
        setMessages(serverMessages);
        lastSyncedRef.current = serverMessages.length;
      } else {
        // Pas de données Supabase → charger depuis localStorage pour la NOUVELLE identité
        try {
          const cached = localStorage.getItem(lsKey);
          const localMessages: ChatMessage[] = cached ? JSON.parse(cached) : [];
          setMessages(localMessages);
          lastSyncedRef.current = localMessages.length;
        } catch {
          setMessages([]);
          lastSyncedRef.current = 0;
        }
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatIdentity, documentMessageId]);

  // ── Save to localStorage on every change ──
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem(lsKey, JSON.stringify(messages));
      }
    } catch {
      // localStorage plein
    }
  }, [messages, lsKey]);

  // ── Sync new messages to Supabase (debounced) ──
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const newMessages = messages.slice(lastSyncedRef.current);
    if (newMessages.length === 0) return;

    // Debounce 2 secondes pour éviter des INSERT par frappe
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const toSync = messages.slice(lastSyncedRef.current);
      if (toSync.length > 0) {
        insertMessages(chatIdentity, documentMessageId, documentType, agent, toSync);
        lastSyncedRef.current = messages.length;
      }
    }, 2000);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [messages, chatIdentity, documentMessageId, documentType, agent]);

  // ── Handle first save: link draft messages to the saved document ──
  useEffect(() => {
    const prev = prevDocIdRef.current;
    if (prev === null && documentMessageId !== null && messages.length > 0) {
      // First save detected! Link thread messages to the new document ID
      updateDocumentMessageId(chatIdentity, documentMessageId);
    }
    prevDocIdRef.current = documentMessageId;
  }, [documentMessageId, chatIdentity, messages.length]);

  return { messages, setMessages, loading };
}
