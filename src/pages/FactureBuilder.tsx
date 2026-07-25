// src/pages/FactureBuilder.tsx
// Page d'édition de facture avec footer Wari conversationnel.
// v2: Highlights + scroll, localStorage, compteur incrémental, Wari décide génération/modification.
// Inspiré de CdcBuilder.tsx — layout pleine page avec footer sticky.

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  Save,
  Check,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import FactureTemplate from "@/components/templates/FactureTemplate";
import FactureFooter from "@/components/facture/FactureFooter";
import FactureBuilderHeader from "@/components/facture/FactureBuilderHeader";
import type { FactureData } from "@/types";
import type { User } from "@/types/user";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useMessages } from "@/hooks/use-messages";
import { generatePDFClient } from "@/services/pdfGenerator";

interface FactureBuilderProps {
  user: User;
  persistentSessionId: string;
}

/** Génère un numéro de facture via RPC Supabase */
async function fetchNextFactureNumber(): Promise<string> {
  const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://yqioyfuxviiximembver.supabase.co";
  const anonKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7";

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/next_document_number`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ p_doc_type: "facture" }),
      },
    );
    if (response.ok) {
      const text = await response.text();
      return text.replace(/^"|\"$/g, "");
    }
  } catch (e) {
    console.warn("RPC next_document_number failed:", e);
  }
  return `F-${Date.now().toString().slice(-6)}`;
}

/** Données par défaut pour une nouvelle facture */
function getDefaultFactureData(): FactureData {
  return {
    factureNumero: "",
    dateEmission: new Date().toISOString().split("T")[0],
    statut: "Brouillon",
    client: { nom: "", adresse: "" },
    details: [],
    total: 0,
    version: 1,
    is_latest: true,
  };
}

const LS_KEY_PREFIX = "assoai-facture-builder";

const FactureBuilder: React.FC<FactureBuilderProps> = ({
  user,
  persistentSessionId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const messageId = searchParams.get("messageId") || undefined;

  // ── État ──
  const [data, setData] = useState<FactureData>(getDefaultFactureData());
  const [originalData, setOriginalData] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [allOpen, setAllOpen] = useState(true);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // 🆕 Highlights (feedback visuel après actions Wari)
  const [highlights, setHighlights] = useState<Record<string, "added" | "modified">>({});
  const highlightsTimestampRef = useRef(0);

  // 🆕 Compteur incrémental
  const [changeCount, setChangeCount] = useState(0);
  const prevDataHashRef = useRef("");

  // Mettre à jour le timestamp quand les highlights changent
  useEffect(() => {
    if (Object.keys(highlights).length > 0) {
      highlightsTimestampRef.current = Date.now();
    }
  }, [highlights]);

  // 🆕 Clear highlights quand l'utilisateur interagit (identique CDC Builder)
  useEffect(() => {
    if (Object.keys(highlights).length === 0) return;
    const handleInteraction = (e: MouseEvent) => {
      if (Date.now() - highlightsTimestampRef.current < 600) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest('[contenteditable="true"]')
      ) {
        setHighlights({});
      }
    };
    document.addEventListener("mousedown", handleInteraction, true);
    return () => document.removeEventListener("mousedown", handleInteraction, true);
  }, [highlights]);

  // Session dédiée pour le footer chat
  const footerSessionId = messageId
    ? `facture-${messageId}`
    : `facture-new-${Date.now()}`;

  // useMessages pour persister les réponses Wari
  const { addMessage } = useMessages({ sessionId: footerSessionId });

  // ── localStorage key ──
  const lsKey = `${LS_KEY_PREFIX}-${messageId || "new"}`;

  // ── Chargement depuis Supabase ──
  const {
    data: loadedData,
    isLoading: loadingFacture,
    error: loadError,
  } = useQuery({
    queryKey: ["factureBuilder", messageId],
    queryFn: async () => {
      if (!messageId) return null;
      const { data: msg, error } = await supabase
        .from("messages")
        .select("template_data")
        .eq("id", messageId)
        .single();

      if (error || !msg?.template_data?.data) {
        throw new Error(error?.message || "Facture introuvable");
      }
      return msg.template_data.data as FactureData;
    },
    enabled: !!messageId,
    staleTime: 10_000,
  });

  // Appliquer les données chargées
  useEffect(() => {
    if (loadedData) {
      const normalized = {
        ...loadedData,
        statut: loadedData.statut || "Brouillon",
        details: loadedData.details || [],
        client: loadedData.client || { nom: "", adresse: "" },
        dateEmission: loadedData.dateEmission?.split("T")[0] || "",
      };
      setData(normalized);
      setOriginalData(JSON.stringify(normalized));
      // 🆕 Reset compteur après chargement initial
      prevDataHashRef.current = JSON.stringify(normalized);
      setChangeCount(0);
      // Nettoyer localStorage après chargement DB
      try { localStorage.removeItem(lsKey); } catch {}
    }
  }, [loadedData]);

  // 🆕 Restauration localStorage au mount (si pas de données chargées)
  useEffect(() => {
    if (loadedData || messageId) return; // DB a priorité
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) {
        const parsed = JSON.parse(saved) as FactureData;
        if (parsed.client?.nom || parsed.details?.length) {
          setData(parsed);
          setOriginalData(JSON.stringify(parsed));
        }
      }
    } catch {}
  }, []);

  // 🆕 Persistance localStorage auto (debounce 500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(lsKey, JSON.stringify(data));
      } catch {}
    }, 500);
    return () => clearTimeout(timer);
  }, [data, lsKey]);

  // 🆕 Compteur incrémental (hash-based)
  useEffect(() => {
    const hash = JSON.stringify(data);
    if (prevDataHashRef.current && prevDataHashRef.current !== hash) {
      setChangeCount((c) => c + 1);
    }
    prevDataHashRef.current = hash;
  }, [data]);

  // ── Sauvegarde ──
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError("");

    let finalData = { ...data };
    let currentMessageId = messageId;

    try {
      // Générer le numéro si vide
      if (!finalData.factureNumero) {
        finalData.factureNumero = await fetchNextFactureNumber();
        setData(finalData);
      }

      const numero = finalData.factureNumero;

      if (currentMessageId) {
        // Mise à jour d'une facture existante
        const template_data = {
          data: finalData,
          metadata: {
            displayName: "Facture",
            availableActions: ["save", "download"],
            mode: "editable",
          },
        };

        const { error } = await supabase
          .from("messages")
          .update({ template_data })
          .eq("id", currentMessageId);

        if (error) throw error;
      } else {
        // Création d'un nouveau message
        const newMessageId = crypto.randomUUID();
        const message = {
          id: newMessageId,
          session_id: footerSessionId,
          user_id: user.id,
          content: `Facture — ${numero || "Brouillon"}`,
          sender: "user",
          timestamp: new Date().toISOString(),
          template_type: "facture",
          template_data: {
            data: finalData,
            metadata: {
              displayName: "Facture",
              availableActions: ["save", "download"],
              mode: "editable",
            },
          },
        };

        const { error } = await supabase.from("messages").insert(message);
        if (error) throw error;

        currentMessageId = newMessageId;

        // Mettre à jour l'URL
        setSearchParams({ messageId: newMessageId }, { replace: true });
      }

      setOriginalData(JSON.stringify(finalData));
      setSaveStatus("saved");
      setChangeCount(0); // 🆕 reset compteur
      // 🆕 Nettoyer localStorage après sauvegarde réussie
      try { localStorage.removeItem(lsKey); } catch {}
      setTimeout(() => setSaveStatus("idle"), 3000);

      toast({
        title: "Enregistré ✅",
        description: `Facture « ${numero || "Brouillon"} » enregistrée.`,
        className: "bg-orange-500 text-white border-orange-600 rounded-lg",
      });
    } catch (error: any) {
      setSaveStatus("error");
      setSaveError(error.message || "Erreur inconnue");
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'enregistrer.",
        className: "bg-white rounded-md",
      });
    }
  }, [data, messageId, footerSessionId, user.id, setSearchParams, toast, lsKey]);

  const handleDataChange = useCallback((newData: FactureData) => {
    console.log("[FactureBuilder] handleDataChange: reçu", newData.details?.length || 0, "articles");
    setData(newData);
  }, []);

  // ── Téléchargement PDF ──
  const handleDownloadPDF = useCallback(async () => {
    if (downloadingPDF) return;
    setDownloadingPDF(true);
    try {
      const result = await generatePDFClient("facture", data, user.id, persistentSessionId);
      if (result.success && result.pdfBlob) {
        const url = URL.createObjectURL(result.pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || `facture_${data.factureNumero || "brouillon"}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("PDF error:", err);
    } finally {
      setDownloadingPDF(false);
    }
  }, [data, user.id, persistentSessionId, downloadingPDF]);

  // ── Rendu ──
  if (loadingFacture) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600 font-medium">Erreur de chargement</p>
          <p className="text-gray-500 text-sm mt-1">
            {(loadError as Error)?.message || "Facture introuvable"}
          </p>
          <button
            onClick={() => navigate("/wari")}
            className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm"
          >
            Retour à Wari
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 pt-4">

        {/* Barre de retour */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600
                       transition-colors px-2 py-1 -ml-2 rounded-lg hover:bg-orange-50"
            title="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Retour</span>
          </button>

          {messageId && (
            <button
              type="button"
              onClick={() =>
                window.open(`/public/doc/${messageId}`, "_blank")
              }
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600
                         transition-colors px-2 py-1 rounded-lg hover:bg-orange-50"
              title="Aperçu de la facture"
            >
              <Eye className="h-4 w-4" />
              <span>Aperçu</span>
            </button>
          )}
        </div>

        {/* Header facture — collapsible */}
        <FactureBuilderHeader
          data={data}
          onChange={handleDataChange}
          messageId={messageId}
          forceOpen={headerOpen}
        />

        {/* Contenu : FactureTemplate (articles uniquement) */}
        <div className="pb-24">
          <FactureTemplate
            data={data}
            isEditable={true}
            onChange={handleDataChange}
            hideHeader={true}
            hideMobileBar={true}
            hideInfoBlocks={true}
            articlesOpen={allOpen}
          />
        </div>

        {/* Footer Wari */}
        <FactureFooter
          data={data}
          onDataChange={handleDataChange}
          user={user}
          persistentSessionId={persistentSessionId}
          onSave={handleSave}
          saving={saveStatus === "saving"}
          changeCount={changeCount}
          messageId={messageId}
          allOpen={allOpen}
          onToggleAllOpen={() => { setAllOpen((p) => !p); setHeaderOpen((p) => !p); }}
          onDownloadPDF={handleDownloadPDF}
          downloadingPDF={downloadingPDF}
          onHighlightsChange={setHighlights}
        />
      </div>
    </div>
  );
};

export default FactureBuilder;
