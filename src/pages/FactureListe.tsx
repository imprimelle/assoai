// src/pages/FactureListe.tsx
// Page liste des factures — avec indicateurs de version, statut, et téléchargement PDF.
// Inspiré de CdcListe.tsx — même layout, adapté au contexte facture.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  FileText,
  Receipt,
  Download,
  Calendar,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { generatePDFClient } from "@/services/pdfGenerator";
import { formatCFA } from "@/utils/format";
import type { FactureData } from "@/types";

interface FactureListItem {
  id: string;
  projectId: string | null;
  projectName: string | null;
  factureNumero: string;
  clientNom: string;
  statut: string;
  total: number;
  timestamp: string;
  version: number;
}

const FactureListe: React.FC = () => {
  const navigate = useNavigate();
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

  const {
    data: factures,
    isLoading,
    error,
  } = useQuery<FactureListItem[]>({
    queryKey: ["factureListe"],
    queryFn: async () => {
      const { data: messages, error: msgErr } = await supabase
        .from("messages")
        .select("id, project_id, template_data, template_type, timestamp")
        .eq("template_type", "facture")
        .order("timestamp", { ascending: false })
        .limit(50);

      if (msgErr) throw new Error(msgErr.message);

      // Collecter les project_id pour les noms
      const projectIds = [
        ...new Set(
          messages
            ?.map((m: any) => m.project_id)
            .filter((id: string | null): id is string => !!id) || [],
        ),
      ];

      let projectNames: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, name")
          .in("id", projectIds);

        if (projects) {
          for (const p of projects) {
            projectNames[p.id] = p.name;
          }
        }
      }

      return (messages || []).map((m: any) => {
        const data = m.template_data?.data || {};
        return {
          id: m.id,
          projectId: m.project_id || null,
          projectName: m.project_id ? projectNames[m.project_id] || null : null,
          factureNumero: data.factureNumero || "Brouillon",
          clientNom: data.client?.nom || "—",
          statut: data.statut || "Brouillon",
          total: data.total || 0,
          timestamp: m.timestamp,
          version: m.template_data?.version || data.version || 1,
        };
      });
    },
    staleTime: 30_000,
  });

  const handleDownload = async (facture: FactureListItem) => {
    if (downloadingIds.has(facture.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(facture.id));

    try {
      // Charger les données complètes de la facture
      const { data: msg } = await supabase
        .from("messages")
        .select("template_data")
        .eq("id", facture.id)
        .single();

      const factureData = msg?.template_data?.data as FactureData;
      if (!factureData) throw new Error("Données facture introuvables");

      const result = await generatePDFClient(
        "facture",
        factureData,
        "liste",
        `facture-${facture.id}`,
      );

      if (result.success && result.pdfBlob) {
        // Téléchargement automatique
        const url = URL.createObjectURL(result.pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename || `facture_${facture.factureNumero}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Erreur téléchargement PDF:", err);
    } finally {
      setDownloadingIds((prev) => {
        const next = new Set(prev);
        next.delete(facture.id);
        return next;
      });
    }
  };

  // Format date
  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Statut badge
  const statusBadgeStyle = (statut: string) => {
    const s = (statut || "").toLowerCase();
    if (s === "payé" || s === "validé" || s === "livré")
      return "bg-green-100 text-green-700";
    if (s === "vérifié" || s === "infographie")
      return "bg-amber-100 text-amber-700";
    if (s === "demande") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  const statusIcon = (statut: string) => {
    const s = (statut || "").toLowerCase();
    if (s === "payé" || s === "validé")
      return <CheckCircle2 className="h-3 w-3" />;
    if (s === "livré") return <CheckCircle2 className="h-3 w-3" />;
    if (s === "brouillon") return <Clock className="h-3 w-3" />;
    return <AlertCircle className="h-3 w-3" />;
  };

  const linkedFactures = factures?.filter((f) => !!f.projectId) || [];
  const draftFactures = factures?.filter((f) => !f.projectId) || [];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Retour"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Factures</h1>
            {factures && (
              <p className="text-xs text-gray-500">
                {factures.length} facture{factures.length > 1 ? "s" : ""}
                {linkedFactures.length > 0 &&
                  ` · ${linkedFactures.length} liée${linkedFactures.length > 1 ? "s" : ""} à un projet`}
                {draftFactures.length > 0 &&
                  ` · ${draftFactures.length} brouillon${draftFactures.length > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/facture-builder")}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nouvelle facture
        </Button>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">
              Erreur lors du chargement : {(error as Error).message}
            </p>
          </div>
        )}

        {!isLoading && !error && factures && factures.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              Aucune facture pour le moment
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/facture-builder")}
              className="text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Créer une facture
            </Button>
          </div>
        )}

        {!isLoading && !error && factures && factures.length > 0 && (
          <div className="space-y-3">
            {/* Section factures liées à un projet */}
            {linkedFactures.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                  <Receipt className="h-3 w-3 inline mr-1" />
                  Liées à un projet
                </h3>
                <div className="space-y-2">
                  {linkedFactures.map((f) => (
                    <FactureCard
                      key={f.id}
                      facture={f}
                      onView={() => navigate(`/public/doc/${f.id}`)}
                      onEdit={() =>
                        navigate(`/facture-builder?messageId=${f.id}`)
                      }
                      onDownload={() => handleDownload(f)}
                      downloading={downloadingIds.has(f.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section brouillons */}
            {draftFactures.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1 mt-4">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Brouillons
                </h3>
                <div className="space-y-2">
                  {draftFactures.map((f) => (
                    <FactureCard
                      key={f.id}
                      facture={f}
                      onView={() => navigate(`/public/doc/${f.id}`)}
                      onEdit={() =>
                        navigate(`/facture-builder?messageId=${f.id}`)
                      }
                      onDownload={() => handleDownload(f)}
                      downloading={downloadingIds.has(f.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Carte Facture ──

const FactureCard: React.FC<{
  facture: FactureListItem;
  onView: () => void;
  onEdit: () => void;
  onDownload: () => void;
  downloading: boolean;
}> = ({ facture, onView, onEdit, onDownload, downloading }) => {
  const statusColor = (statut: string) => {
    const s = (statut || "").toLowerCase();
    if (s === "payé" || s === "validé" || s === "livré")
      return "bg-green-100 text-green-700";
    if (s === "vérifié" || s === "infographie")
      return "bg-amber-100 text-amber-700";
    if (s === "demande") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-600";
  };

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-150">
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icône facture */}
          <div className="shrink-0 bg-orange-100 p-2 rounded-lg">
            <Receipt className="h-5 w-5 text-orange-600" />
          </div>

          {/* Infos principales */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-800 text-sm truncate">
                {facture.clientNom}
              </h4>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusColor(facture.statut)}`}
              >
                {facture.statut}
              </span>
            </div>
            <p className="text-xs text-orange-600 font-mono mb-1">
              {facture.factureNumero}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              {facture.projectName && (
                <span className="flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
                  <span className="truncate">{facture.projectName}</span>
                </span>
              )}
              <span className="flex items-center gap-1 text-gray-400">
                <Calendar className="h-3 w-3" />
                {formatDate(facture.timestamp)}
              </span>
            </div>
          </div>

          {/* Total + Version */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-sm font-bold text-gray-800">
              {formatCFA(facture.total)}
            </span>
            <span className="text-[10px] text-gray-400">v{facture.version}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
          <button
            onClick={onView}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-gray-600
                       rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            Aperçu
          </button>
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-orange-600
                       rounded-lg hover:bg-orange-50 transition-colors"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Modifier
          </button>
          <button
            onClick={onDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium
                       bg-orange-600 text-white rounded-lg
                       hover:bg-orange-500 transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default FactureListe;
