// src/pages/FactureBuilder.tsx
// Page d'édition de facture avec footer Wari conversationnel.
// v3: Toggle Commande — dérivation déterministe Facture→Commande, page dual-mode éditable.
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
  ArrowRightLeft,
  ShoppingCart,
} from "lucide-react";
import FactureTemplate from "@/components/templates/FactureTemplate";
import FactureFooter from "@/components/facture/FactureFooter";
import FactureBuilderHeader from "@/components/facture/FactureBuilderHeader";
import type { FactureData, CommandeData, CommandeItem } from "@/types";
import type { User } from "@/types/user";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
      return text.replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.warn("RPC next_document_number failed:", e);
  }
  return `F-${Date.now().toString().slice(-6)}`;
}

/** Génère un numéro de commande via RPC Supabase */
async function fetchNextCommandeNumber(): Promise<string> {
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
        body: JSON.stringify({ p_doc_type: "commande" }),
      },
    );
    if (response.ok) {
      const text = await response.text();
      return text.replace(/^"|"$/g, "");
    }
  } catch (e) {
    console.warn("RPC next_document_number (commande) failed:", e);
  }
  return `CMD-${Date.now().toString().slice(-6)}`;
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

/** Dérivation déterministe Facture → Commande (sans LLM) */
function deriveFactureToCommandeData(
  facData: FactureData,
  commandeNumero: string,
): CommandeData {
  const derivedItems: CommandeItem[] = (facData.details || []).map((d) => ({
    id: d.id || crypto.randomUUID(),
    nom: d.description || "",
    quantite: d.quantite ?? 1,
    prixUnitaire: d.prixUnitaire ?? 0,
    sous_total: d.sous_total ?? ((d.quantite ?? 1) * (d.prixUnitaire ?? 0)),
    ...((d as any).image_url ? { image_url: (d as any).image_url } : {}),
  }));

  const reductionSrc = facData.reduction ?? 0;
  const itemsSum = derivedItems.reduce((s, it) => s + (it.sous_total ?? 0), 0);
  const derivedTotal = Math.max(0, itemsSum - reductionSrc);

  return {
    commandeNumero,
    dateCommande: new Date().toISOString().split("T")[0],
    dateLivraison: "",
    client: { ...facData.client },
    items: derivedItems,
    total: derivedTotal,
    statut: "en_attente",
    version: 1,
    is_latest: true,
    linked_facture_id: facData.factureNumero || null,
    reduction: reductionSrc,
    echeancier: facData.echeancier,
    deliveryAddress: facData.deliveryAddress,
    recu_image_url: null,
    montantAvance: 0,
  };
}

const LS_KEY_PREFIX = "assoai-facture-builder";

export type BuilderMode = "facture" | "commande";

const FactureBuilder: React.FC<FactureBuilderProps> = ({
  user,
  persistentSessionId,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const messageId = searchParams.get("messageId") || undefined;

  // ── Mode (facture ou commande) ──
  const [mode, setMode] = useState<BuilderMode>("facture");

  // ── État ──
  const [data, setData] = useState<FactureData | CommandeData>(getDefaultFactureData());
  const [originalData, setOriginalData] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string>("");
  const [allOpen, setAllOpen] = useState(true);
  const [headerOpen, setHeaderOpen] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // 🆕 État commande
  const [commandeMessageId, setCommandeMessageId] = useState<string | null>(null);
  const [isDeriving, setIsDeriving] = useState(false);
  const [factureMessageId] = useState<string | undefined>(messageId);
  const factureSnapshotRef = useRef<FactureData | null>(null);

  // 🆕 Highlights (feedback visuel après actions Wari)
  const [highlights, setHighlights] = useState<Record<string, "added" | "modified">>({});
  const highlightsTimestampRef = useRef(0);

  // 🆕 Compteur : nombre de modifs non sauvegardées
  const [changeCount, setChangeCount] = useState(0);
  const lastSavedHashRef = useRef(JSON.stringify(getDefaultFactureData()));

  // 🆕 isDirty : true si data ≠ dernier état sauvegardé
  const isDirty = useMemo(() => {
    return JSON.stringify(data) !== lastSavedHashRef.current;
  }, [data]);

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

  // ── ID actif (dépend du mode) ──
  const activeMessageId = mode === "commande" ? commandeMessageId : messageId;

  // Session dédiée pour le footer chat
  const footerSessionId = activeMessageId
    ? `facture-${activeMessageId}`
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
        .select("template_data, template_type")
        .eq("id", messageId)
        .single();

      if (error || !msg?.template_data?.data) {
        throw new Error(error?.message || "Document introuvable");
      }
      return {
        data: msg.template_data.data as FactureData,
        templateType: msg.template_type as string,
      };
    },
    enabled: !!messageId,
    staleTime: 10_000,
  });

  // 🆕 Recherche de la commande liée au chargement
  const {
    data: linkedCommande,
    isLoading: loadingLinked,
  } = useQuery({
    queryKey: ["linkedCommande", loadedData?.data?.factureNumero],
    queryFn: async () => {
      if (!loadedData?.data?.factureNumero) return null;
      // Chercher une commande qui référence cette facture
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("id, template_data")
        .eq("template_type", "commande")
        .filter(
          "template_data->data->>linked_facture_id",
          "eq",
          loadedData.data.factureNumero,
        )
        .order("timestamp", { ascending: false })
        .limit(1);

      if (error || !msgs || msgs.length === 0) return null;
      return {
        messageId: msgs[0].id,
        data: msgs[0].template_data?.data as CommandeData,
      };
    },
    enabled: !!loadedData?.data?.factureNumero,
    staleTime: 30_000,
  });

  // Appliquer les données chargées
  useEffect(() => {
    if (loadedData) {
      const normalized = {
        ...loadedData.data,
        statut: loadedData.data.statut || "Brouillon",
        details: loadedData.data.details || [],
        client: loadedData.data.client || { nom: "", adresse: "" },
        dateEmission: loadedData.data.dateEmission?.split("T")[0] || "",
      };
      factureSnapshotRef.current = { ...normalized };
      setData(normalized);
      setOriginalData(JSON.stringify(normalized));
      lastSavedHashRef.current = JSON.stringify(normalized);
      setChangeCount(0);
      try { localStorage.removeItem(lsKey); } catch {}
    }
  }, [loadedData]);

  // 🆕 Si une commande liée existe → basculer automatiquement en mode commande
  useEffect(() => {
    if (linkedCommande && !loadingLinked && !commandeMessageId) {
      setMode("commande");
      setCommandeMessageId(linkedCommande.messageId);
      setData(linkedCommande.data);
      setOriginalData(JSON.stringify(linkedCommande.data));
      lastSavedHashRef.current = JSON.stringify(linkedCommande.data);
      setChangeCount(0);
    }
  }, [linkedCommande, loadingLinked]);

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

  // 🆕 Compteur incrémental : incrémente à chaque modif non sauvegardée
  useEffect(() => {
    if (isDirty) {
      setChangeCount((c) => c + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ── Toggle Commande ──
  const handleToggleCommande = useCallback(async () => {
    if (isDeriving) return;

    if (mode === "commande") {
      // Revenir en mode facture (lecture seule)
      setMode("facture");
      if (factureSnapshotRef.current) {
        setData(factureSnapshotRef.current);
        setOriginalData(JSON.stringify(factureSnapshotRef.current));
        lastSavedHashRef.current = JSON.stringify(factureSnapshotRef.current);
        setChangeCount(0);
      }
      return;
    }

    // 🆕 Si une commande existe déjà (créée dans cette session), re-basculer sans re-créer
    if (commandeMessageId) {
      setIsDeriving(true);
      try {
        const { data: msg } = await supabase
          .from("messages")
          .select("template_data")
          .eq("id", commandeMessageId)
          .single();
        if (msg?.template_data?.data) {
          const cmdData = msg.template_data.data as CommandeData;
          setData(cmdData);
          setOriginalData(JSON.stringify(cmdData));
          lastSavedHashRef.current = JSON.stringify(cmdData);
          setChangeCount(0);
          setMode("commande");
        }
      } catch {
        // Si le fetch échoue, on laisse l'état existant
        setMode("commande");
      } finally {
        setIsDeriving(false);
      }
      return;
    }

    // 🔒 Garde-fou : la facture doit avoir un client et un numéro
    const facData = data as FactureData;
    if (!factureMessageId) {
      toast({
        variant: "destructive",
        title: "Facture non sauvegardée",
        description: "Sauvegardez d'abord la facture avant de créer une commande.",
        className: "bg-white rounded-md",
      });
      return;
    }
    if (!facData.client?.nom) {
      toast({
        variant: "destructive",
        title: "Client requis",
        description: "Ajoutez un client avant de créer une commande.",
        className: "bg-white rounded-md",
      });
      return;
    }

    setIsDeriving(true);
    try {
      // 1. Allouer le numéro de commande
      const commandeNumero = await fetchNextCommandeNumber();

      // 2. Sauvegarder la facture d'abord (si elle n'a pas de numéro)
      let finalFacData = { ...facData };
      if (!finalFacData.factureNumero) {
        finalFacData.factureNumero = await fetchNextFactureNumber();
      }

      // Mettre à jour la facture avec son numéro si nécessaire
      if (finalFacData.factureNumero !== facData.factureNumero) {
        const template_data = {
          data: finalFacData,
          metadata: {
            displayName: "Facture",
            availableActions: ["save", "download"],
            mode: "editable",
          },
        };
        await supabase
          .from("messages")
          .update({ template_data })
          .eq("id", factureMessageId);
      }

      // 3. Dériver la facture en commande (déterministe)
      const commandeData = deriveFactureToCommandeData(
        finalFacData,
        commandeNumero,
      );

      // 4. Insérer la commande dans messages
      const newCommandeId = crypto.randomUUID();
      const commandeMessage = {
        id: newCommandeId,
        session_id: `commande-${newCommandeId}`,
        user_id: user.id,
        content: `Commande — ${commandeNumero}`,
        sender: "user",
        timestamp: new Date().toISOString(),
        template_type: "commande",
        template_data: {
          data: commandeData,
          metadata: {
            displayName: "Commande",
            availableActions: ["save", "download"],
            mode: "editable",
          },
        },
        project_id: (loadedData as any)?.project_id || null,
      };

      const { error: insertErr } = await supabase
        .from("messages")
        .insert(commandeMessage);
      if (insertErr) throw insertErr;

      // 5. Mettre à jour la facture pour marquer qu'elle a été dérivée
      // (La commande stocke linked_facture_id, la facture n'a besoin que du flag interne)
      factureSnapshotRef.current = { ...finalFacData };
      
      // Invalider les queries pour que la FactureListe reflète le badge
      queryClient.invalidateQueries({ queryKey: ["factureListe"] });

      // 6. Basculer en mode commande
      setCommandeMessageId(newCommandeId);
      setMode("commande");
      setData(commandeData);
      setOriginalData(JSON.stringify(commandeData));
      lastSavedHashRef.current = JSON.stringify(commandeData);
      setChangeCount(0);

      toast({
        title: "Commande créée ✅",
        description: `Commande ${commandeNumero} créée depuis la facture ${finalFacData.factureNumero}.`,
        className: "bg-orange-500 text-white border-orange-600 rounded-lg",
      });

      // Invalider les queries pour que la FactureListe reflète le badge
      queryClient.invalidateQueries({ queryKey: ["factureListe"] });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible de créer la commande.",
        className: "bg-white rounded-md",
      });
    } finally {
      setIsDeriving(false);
    }
  }, [mode, data, isDeriving, factureMessageId, user.id, toast, queryClient, loadedData]);

  // ── Sauvegarde ──
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    setSaveError("");

    let finalData = { ...data };
    let currentMessageId = activeMessageId;

    try {
      if (mode === "facture") {
        const facData = finalData as FactureData;
        // Générer le numéro si vide
        if (!facData.factureNumero) {
          facData.factureNumero = await fetchNextFactureNumber();
          setData(facData);
        }

        const numero = facData.factureNumero;

        if (currentMessageId) {
          const template_data = {
            data: facData,
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
              data: facData,
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
          setSearchParams({ messageId: newMessageId }, { replace: true });
        }
      } else {
        // Mode commande
        const cmdData = finalData as CommandeData;
        if (!currentMessageId || !cmdData.commandeNumero) {
          throw new Error("ID de commande manquant");
        }

        const template_data = {
          data: cmdData,
          metadata: {
            displayName: "Commande",
            availableActions: ["save", "download"],
            mode: "editable",
          },
        };
        const { error } = await supabase
          .from("messages")
          .update({ template_data })
          .eq("id", currentMessageId);
        if (error) throw error;
      }

      setOriginalData(JSON.stringify(finalData));
      lastSavedHashRef.current = JSON.stringify(finalData);
      setSaveStatus("saved");
      setChangeCount(0);
      try { localStorage.removeItem(lsKey); } catch {}
      setTimeout(() => setSaveStatus("idle"), 3000);

      const docLabel = mode === "commande" ? "Commande" : "Facture";
      const docNum =
        mode === "commande"
          ? (finalData as CommandeData).commandeNumero
          : (finalData as FactureData).factureNumero;

      toast({
        title: "Enregistré ✅",
        description: `${docLabel} « ${docNum || "Brouillon"} » enregistrée.`,
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
  }, [data, activeMessageId, mode, footerSessionId, user.id, setSearchParams, toast, lsKey]);

  const handleDataChange = useCallback(
    (newData: FactureData | CommandeData) => {
      console.log(
        "[FactureBuilder] handleDataChange: reçu",
        mode === "commande"
          ? (newData as CommandeData).items?.length || 0
          : (newData as FactureData).details?.length || 0,
        "articles, mode:",
        mode,
      );
      setData(newData);
    },
    [mode],
  );

  // ── Téléchargement PDF ──
  const handleDownloadPDF = useCallback(async () => {
    if (downloadingPDF) return;
    setDownloadingPDF(true);
    try {
      const pdfType = mode === "commande" ? "commande" : "facture";
      const result = await generatePDFClient(pdfType, data, user.id, persistentSessionId);
      if (result.success && result.pdfBlob) {
        const url = URL.createObjectURL(result.pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        const docNum =
          mode === "commande"
            ? (data as CommandeData).commandeNumero
            : (data as FactureData).factureNumero;
        a.download = result.filename || `${pdfType}_${docNum || "brouillon"}.pdf`;
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
  }, [data, user.id, persistentSessionId, downloadingPDF, mode]);

  const isLocked = mode === "facture" && !!commandeMessageId;

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
            {(loadError as Error)?.message || "Document introuvable"}
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
        {/* Barre de retour + Toggle Commande */}
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

          <div className="flex items-center gap-2">
            {/* 🔒 Bandeau facture verrouillée */}
            {isLocked && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
                🔒 Facture convertie en commande
              </span>
            )}

            {/* Aperçu (uniquement en mode facture, sans commande) */}
            {messageId && mode === "facture" && !commandeMessageId && (
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

            {/* Toggle Facture ↔ Commande */}
            {messageId && (
              <button
                type="button"
                onClick={handleToggleCommande}
                disabled={isDeriving}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                  transition-all disabled:opacity-50 ${
                    mode === "commande"
                      ? "bg-purple-100 text-purple-700 border border-purple-300 hover:bg-purple-200"
                      : "bg-white text-gray-600 border border-gray-300 hover:border-orange-400 hover:text-orange-600"
                  }`}
                title={
                  mode === "commande"
                    ? "Revenir à la facture"
                    : "Transformer en commande"
                }
              >
                {isDeriving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : mode === "commande" ? (
                  <ShoppingCart className="h-4 w-4" />
                ) : (
                  <ArrowRightLeft className="h-4 w-4" />
                )}
                <span>
                  {mode === "commande" ? "Commande" : "Commande"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Header — adapté selon le mode */}
        <FactureBuilderHeader
          data={data}
          onChange={handleDataChange}
          mode={mode}
          messageId={activeMessageId || undefined}
          forceOpen={headerOpen}
          isLocked={isLocked}
        />

        {/* Contenu : Template (articles uniquement) */}
        <div className="pb-24">
          <FactureTemplate
            data={data}
            isEditable={!isLocked}
            onChange={handleDataChange}
            hideHeader={true}
            hideMobileBar={true}
            hideInfoBlocks={true}
            articlesOpen={allOpen}
            mode={mode}
          />
        </div>

        {/* Footer Wari — masqué si facture verrouillée */}
        {!isLocked && (
          <FactureFooter
            data={data}
            onDataChange={handleDataChange}
            user={user}
            persistentSessionId={persistentSessionId}
            onSave={handleSave}
            saving={saveStatus === "saving"}
            changeCount={changeCount}
            messageId={activeMessageId || undefined}
            allOpen={allOpen}
            onToggleAllOpen={() => {
              setAllOpen((p) => !p);
              setHeaderOpen((p) => !p);
            }}
            onDownloadPDF={handleDownloadPDF}
            downloadingPDF={downloadingPDF}
            onHighlightsChange={setHighlights}
            builderMode={mode}
          />
        )}

        {/* Footer placeholder quand facture verrouillée */}
        {isLocked && (
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <div className="max-w-6xl mx-auto">
              <div className="flex items-center justify-center gap-2 px-3 py-3 bg-amber-50 border-t border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <span className="text-sm text-amber-700">
                  Cette facture est verrouillée — basculez sur le mode Commande pour éditer.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FactureBuilder;
