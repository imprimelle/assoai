// src/pages/CdcListe.tsx
// Page intermédiaire : liste des CDC existants (liés à un projet ou brouillons).
// Remplacée par la navigation directe vers /cdc-builder auparavant.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  FileText,
  LinkIcon,
  FileEdit,
  ExternalLink,
  Calendar,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

interface CdcListItem {
  id: string;
  projectId: string | null;
  projectName: string | null;
  cdcNumero: string;
  titre: string;
  statut: string;
  timestamp: string;
  version: number;
  enseigneImages: string[];
}

const CdcListe: React.FC = () => {
  const navigate = useNavigate();

  const {
    data: cdcs,
    isLoading,
    error,
  } = useQuery<CdcListItem[]>({
    queryKey: ["cdcListe"],
    queryFn: async () => {
      // Récupérer tous les CDC, les plus récents d'abord
      const { data: messages, error: msgErr } = await supabase
        .from("messages")
        .select("id, project_id, template_data, template_type, timestamp")
        .eq("template_type", "cahier_des_charges")
        .order("timestamp", { ascending: false })
        .limit(50);

      if (msgErr) throw new Error(msgErr.message);

      // Collecter tous les project_id non-null pour les noms
      const projectIds = [
        ...new Set(
          messages
            ?.map((m: any) => m.project_id)
            .filter((id: string | null): id is string => !!id) || [],
        ),
      ];

      // Récupérer les noms des projets en une seule requête
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
        // Extraire les images des 3 premières enseignes
        const images: string[] = (data.enseignes || [])
          .map((ens: any) => ens.details?.image_url || ens.image_url)
          .filter((url: string | undefined): url is string => !!url)
          .slice(0, 3);
        return {
          id: m.id,
          projectId: m.project_id || null,
          projectName: m.project_id ? projectNames[m.project_id] || null : null,
          cdcNumero: data.cdcNumero || "?",
          titre: data.titre || "Cahier des Charges",
          statut: data.statut || "Brouillon",
          timestamp: m.timestamp,
          version: m.template_data?.version || data.version || 1,
          enseigneImages: images,
        };
      });
    },
    staleTime: 30_000,
  });

  const linkedCdcs =
    cdcs?.filter((c) => !!c.projectId) || [];
  const draftCdcs =
    cdcs?.filter((c) => !c.projectId) || [];

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
            <h1 className="text-lg font-semibold text-gray-800">
              Cahiers des Charges
            </h1>
            {cdcs && (
              <p className="text-xs text-gray-500">
                {cdcs.length} CDC{cdcs.length > 1 ? "s" : ""}
                {linkedCdcs.length > 0 && ` · ${linkedCdcs.length} lié${linkedCdcs.length > 1 ? "s" : ""} à un projet`}
                {draftCdcs.length > 0 && ` · ${draftCdcs.length} brouillon${draftCdcs.length > 1 ? "s" : ""}`}
              </p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => navigate("/cdc-builder")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nouveau CDC
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

        {!isLoading && !error && cdcs && cdcs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">Aucun CDC pour le moment</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/cdc-builder")}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Créer un CDC
            </Button>
          </div>
        )}

        {!isLoading && !error && cdcs && cdcs.length > 0 && (
          <div className="space-y-3">
            {/* Section CDCs liés à un projet */}
            {linkedCdcs.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1">
                  <LinkIcon className="h-3 w-3 inline mr-1" />
                  Liés à un projet
                </h3>
                <div className="space-y-2">
                  {linkedCdcs.map((cdc) => (
                    <CdcCard
                      key={cdc.id}
                      cdc={cdc}
                      onView={() => navigate(`/public/doc/${cdc.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Section CDCs brouillons */}
            {draftCdcs.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2 px-1 mt-4">
                  <FileEdit className="h-3 w-3 inline mr-1" />
                  Brouillons
                </h3>
                <div className="space-y-2">
                  {draftCdcs.map((cdc) => (
                    <CdcCard
                      key={cdc.id}
                      cdc={cdc}
                      onView={() => navigate(`/public/doc/${cdc.id}`)}
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

// ── Carte CDC ──

const CdcCard: React.FC<{
  cdc: CdcListItem;
  onView: () => void;
}> = ({ cdc, onView }) => {
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

  const statutBadge = (statut: string) => {
    switch (statut?.toLowerCase()) {
      case "validé":
      case "valide":
        return "bg-green-100 text-green-700";
      case "brouillon":
        return "bg-gray-100 text-gray-600";
      case "en cours":
      case "demande":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const hasImages = cdc.enseigneImages.length > 0;

  return (
    <button
      onClick={onView}
      className="w-full text-left bg-white rounded-lg border border-gray-200 p-4 shadow-sm
                 hover:shadow-md hover:border-indigo-200 transition-all duration-150
                 active:scale-[0.99] cursor-pointer"
    >
      <div className="flex gap-3">
        {/* Miniatures d'enseignes (si disponibles) */}
        {hasImages && (
          <div className="shrink-0 flex -space-x-2">
            {cdc.enseigneImages.map((img, i) => (
              <div
                key={i}
                className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm
                           bg-gray-100"
                style={{ zIndex: 3 - i }}
              >
                <img
                  src={img}
                  alt={`Enseigne ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-800 text-sm truncate">
              {cdc.titre}
            </h4>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${statutBadge(cdc.statut)}`}
            >
              {cdc.statut}
            </span>
          </div>
          <p className="text-xs text-indigo-600 font-mono mb-1">
            {cdc.cdcNumero}
          </p>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {cdc.projectName && (
              <span className="flex items-center gap-1">
                <LinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="truncate">{cdc.projectName}</span>
              </span>
            )}
            <span className="flex items-center gap-1 text-gray-400">
              <Calendar className="h-3 w-3" />
              {formatDate(cdc.timestamp)}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ExternalLink className="h-4 w-4 text-gray-300" />
          <span className="text-[10px] text-gray-300">v{cdc.version}</span>
        </div>
      </div>
    </button>
  );
};

export default CdcListe;
