// src/pages/FactureListe.tsx
// Page liste des factures — recherche dynamique, cartes esthétiques, PDF discret.

import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Receipt,
  Calendar,
  Loader2,
  Search,
  FileDown,
  Pencil,
  Trash2,
} from "lucide-react";
import NouvelleFactureDialog from "@/components/facture/NouvelleFactureDialog";
import type { User } from "@/types/user";
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

interface FactureListeProps {
  user: User | null;
}

const FactureListe: React.FC<FactureListeProps> = ({ user }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [showNewDialog, setShowNewDialog] = useState(false);

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
          for (const p of projects) projectNames[p.id] = p.name;
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

  // ── Recherche dynamique ──
  const filteredFactures = useMemo(() => {
    if (!factures) return [];
    if (!search.trim()) return factures;
    const q = search.toLowerCase().trim();
    return factures.filter(
      (f) =>
        f.clientNom.toLowerCase().includes(q) ||
        f.factureNumero.toLowerCase().includes(q) ||
        (f.projectName && f.projectName.toLowerCase().includes(q)),
    );
  }, [factures, search]);

  const handleDownload = async (facture: FactureListItem) => {
    if (downloadingIds.has(facture.id)) return;
    setDownloadingIds((prev) => new Set(prev).add(facture.id));
    try {
      const { data: msg } = await supabase
        .from("messages")
        .select("template_data")
        .eq("id", facture.id)
        .single();
      const factureData = msg?.template_data?.data as FactureData;
      if (!factureData) throw new Error("Données facture introuvables");
      const result = await generatePDFClient("facture", factureData, "liste", `facture-${facture.id}`);
      if (result.success && result.pdfBlob) {
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

  const formatDate = (ts: string) => {
    try {
      return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    } catch { return ""; }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600" title="Retour">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-800">Factures</h1>
            {factures && (
              <p className="text-xs text-gray-500">
                {filteredFactures.length} facture{filteredFactures.length !== 1 ? "s" : ""}
                {search && factures.length !== filteredFactures.length && ` sur ${factures.length}`}
              </p>
            )}
          </div>
        </div>
        <Button size="sm" onClick={() => setShowNewDialog(true)} className="bg-orange-600 hover:bg-orange-700 text-white">
          <Plus className="h-4 w-4 mr-1.5" /> Nouvelle
        </Button>
      </div>

      {/* Barre de recherche */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par client, N° facture ou projet…"
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm bg-gray-50
                       placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500/40 focus:border-orange-400
                       outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Contenu */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (<Skeleton key={i} className="h-20 w-full rounded-lg" />))}
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">Erreur : {(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && filteredFactures.length === 0 && (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              {search ? "Aucune facture ne correspond à votre recherche" : "Aucune facture pour le moment"}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={() => setShowNewDialog(true)}
                className="text-orange-600 border-orange-200 hover:bg-orange-50">
                <Plus className="h-4 w-4 mr-1.5" /> Créer une facture
              </Button>
            )}
          </div>
        )}

        {!isLoading && !error && filteredFactures.length > 0 && (
          <div className="space-y-2">
            {filteredFactures.map((f) => (
              <FactureCard
                key={f.id}
                facture={f}
                onOpen={() => navigate(`/facture-builder?messageId=${f.id}`)}
                onDownload={() => handleDownload(f)}
                downloading={downloadingIds.has(f.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogue nouvelle facture */}
      {user && (
        <NouvelleFactureDialog
          open={showNewDialog}
          onClose={() => setShowNewDialog(false)}
          user={user}
        />
      )}
    </div>
  );
};

// ── Carte Facture (esthétique, sans redondance) ──

const FactureCard: React.FC<{
  facture: FactureListItem;
  onOpen: () => void;
  onDownload: () => void;
  downloading: boolean;
}> = ({ facture, onOpen, onDownload, downloading }) => {
  const st = (facture.statut || "").toLowerCase();
  const statusBadge =
    st === "payé" || st === "livré" ? "bg-emerald-100 text-emerald-700"
    : st === "vérifié" || st === "validé" ? "bg-amber-100 text-amber-700"
    : st === "demande" ? "bg-blue-100 text-blue-700"
    : "bg-gray-100 text-gray-500";

  const formatDate = (ts: string) => {
    try { return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return ""; }
  };

  return (
    <div
      onClick={onOpen}
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-orange-300
                 transition-all duration-150 cursor-pointer group"
    >
      <div className="px-4 py-3">
        {/* Ligne 1 : Client + Statut + Version */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Receipt className="h-4 w-4 text-orange-400 shrink-0" />
            <h4 className="font-semibold text-gray-800 text-sm truncate">{facture.clientNom}</h4>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statusBadge}`}>
              {facture.statut}
            </span>
          </div>
          <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">v{facture.version}</span>
        </div>

        {/* Ligne 2 : N° facture + Total */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-orange-600">{facture.factureNumero}</span>
          <span className="text-sm font-bold text-green-600">{formatCFA(facture.total)}</span>
        </div>

        {/* Ligne 3 : Projet + Date + Actions */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
          <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
            {facture.projectName && (
              <span className="truncate bg-gray-100 px-1.5 py-0.5 rounded">{facture.projectName}</span>
            )}
            <span className="flex items-center gap-1 shrink-0">
              <Calendar className="h-3 w-3" />
              {formatDate(facture.timestamp)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {/* Bouton Modifier (visible au hover) */}
            <button
              onClick={(e) => { e.stopPropagation(); onOpen(); }}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 rounded-md
                         hover:text-orange-600 hover:bg-orange-50 transition-colors opacity-0 group-hover:opacity-100"
              title="Modifier"
            >
              <Pencil className="h-3 w-3" />
            </button>

            {/* Bouton PDF — discret, vert */}
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
              disabled={downloading}
              className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md
                         text-emerald-600 hover:bg-emerald-50 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              title="Télécharger PDF"
            >
              {downloading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <FileDown className="h-3 w-3" />
              )}
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FactureListe;
