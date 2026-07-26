// src/pages/CdcListe.tsx
// Page liste des CDC — recherche dynamique, cartes, swipe-to-delete (inspiré de FactureListe).

import React, { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  FileText,
  LinkIcon,
  Calendar,
  Loader2,
  Search,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"tout" | "production" | "brouillon" | "termine">("tout");

  const {
    data: cdcs,
    isLoading,
    error,
  } = useQuery<CdcListItem[]>({
    queryKey: ["cdcListe"],
    queryFn: async () => {
      const { data: messages, error: msgErr } = await supabase
        .from("messages")
        .select("id, project_id, template_data, template_type, timestamp")
        .eq("template_type", "cahier_des_charges")
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
          for (const p of projects) {
            projectNames[p.id] = p.name;
          }
        }
      }

      return (messages || []).map((m: any) => {
        const data = m.template_data?.data || {};
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

  // ── Recherche dynamique + filtre statut ──
  const filteredCdcs = useMemo(() => {
    if (!cdcs) return [];
    let result = cdcs;

    // Filtre par statut
    if (statusFilter !== "tout") {
      const s = (statut: string) => statut.toLowerCase().trim();
      result = result.filter((c) => {
        const st = s(c.statut);
        switch (statusFilter) {
          case "production":
            return ["vérification", "achat", "fabrication", "installation"].includes(st);
          case "brouillon":
            return st === "brouillon";
          case "termine":
            return ["terminé", "validé", "valide", "livré", "payé"].includes(st);
          default:
            return true;
        }
      });
    }

    // Filtre par recherche texte
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.titre.toLowerCase().includes(q) ||
          c.cdcNumero.toLowerCase().includes(q) ||
          (c.projectName && c.projectName.toLowerCase().includes(q)),
      );
    }

    return result;
  }, [cdcs, search, statusFilter]);

  const handleDelete = async (id: string) => {
    const { error: delErr } = await supabase
      .from("messages")
      .delete()
      .eq("id", id);
    if (delErr) {
      console.error("Erreur suppression CDC:", delErr.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["cdcListe"] });
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
                {filteredCdcs.length} CDC{filteredCdcs.length !== 1 ? "s" : ""}
                {search && cdcs.length !== filteredCdcs.length &&
                  ` sur ${cdcs.length}`}
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

      {/* Barre de recherche */}
      <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par titre, N° CDC ou projet…"
            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm bg-gray-50
                       placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400
                       outline-none transition-shadow"
          />
        </div>
      </div>

      {/* Filtres par statut */}
      <div className="px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <div className="flex gap-2">
          {(
            [
              { key: "tout", label: "Tout" },
              { key: "production", label: "Production" },
              { key: "brouillon", label: "Brouillon" },
              { key: "termine", label: "Terminé" },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                statusFilter === key
                  ? "border-orange-400 bg-orange-50 text-orange-600"
                  : "border-gray-300 bg-white text-gray-500 hover:border-gray-400 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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

        {!isLoading && !error && filteredCdcs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm mb-4">
              {search
                ? "Aucun CDC ne correspond à votre recherche"
                : "Aucun CDC pour le moment"}
            </p>
            {!search && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/cdc-builder")}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Créer un CDC
              </Button>
            )}
          </div>
        )}

        {!isLoading && !error && filteredCdcs.length > 0 && (
          <div className="space-y-2">
            {filteredCdcs.map((cdc) => (
              <CdcCard
                key={cdc.id}
                cdc={cdc}
                onEdit={() => navigate(`/cdc-builder?cdcId=${cdc.id}`)}
                onView={() => navigate(`/public/doc/${cdc.id}`)}
                onDelete={() => handleDelete(cdc.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Carte CDC avec swipe-to-delete ──

const SWIPE_THRESHOLD = 70;

const CdcCard: React.FC<{
  cdc: CdcListItem;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
}> = ({ cdc, onEdit, onView, onDelete }) => {
  const st = (cdc.statut || "").toLowerCase();
  const statusBadge =
    st === "terminé" || st === "validé" || st === "valide" || st === "livré" || st === "payé"
      ? "bg-green-100 text-green-700"
      : st === "fabrication"
        ? "bg-orange-100 text-orange-700"
        : st === "vérification"
          ? "bg-amber-100 text-amber-700"
          : st === "installation"
            ? "bg-indigo-100 text-indigo-700"
            : st === "achat"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600";

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

  // ── Swipe state ──
  const [translateX, setTranslateX] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isSwiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      isSwiping.current = true;
    }

    if (!isSwiping.current) return;

    if (translateX < 0) {
      setTranslateX(Math.max(-80, Math.min(0, translateX + dx * 0.3)));
    } else if (dx < 0) {
      setTranslateX(Math.max(dx, -100));
    }

    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (translateX < -SWIPE_THRESHOLD) {
      setTranslateX(-80);
    } else {
      setTranslateX(0);
    }
    isSwiping.current = false;
  };

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setShowConfirm(false);
  };

  const hasImages = cdc.enseigneImages.length > 0;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Fond rouge avec trash — révélé au swipe */}
      <div
        className="absolute inset-y-0 right-0 w-20 bg-red-500 flex items-center justify-center rounded-lg"
        style={{ opacity: translateX < -SWIPE_THRESHOLD ? 1 : 0.4 }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirm(true);
          }}
          className="text-white p-2"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* Carte glissante */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (Math.abs(translateX) < 10) onView();
          else setTranslateX(0);
        }}
        style={{ transform: `translateX(${translateX}px)` }}
        className="relative bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200
                   transition-transform duration-200 cursor-pointer group"
      >
        <div className="px-4 py-3">
          {/* Ligne 1 : Titre + Statut + Version */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 text-indigo-400 shrink-0" />
              <h4 className="font-semibold text-gray-800 text-sm truncate">
                {cdc.titre}
              </h4>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 inline-flex items-center gap-1 ${statusBadge}`}
              >
                {["vérification", "achat", "fabrication", "installation"].includes(st) && (
                  <Loader2 size={10} className="animate-spin" />
                )}
                {cdc.statut}
              </span>
            </div>
            <span className="text-[10px] text-gray-400 font-mono shrink-0 ml-2">
              v{cdc.version}
            </span>
          </div>

          {/* Ligne 2 : N° CDC + Miniatures */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-indigo-600">
              {cdc.cdcNumero}
            </span>
            {hasImages && (
              <div className="flex -space-x-1.5 shrink-0">
                {cdc.enseigneImages.map((img, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 rounded-md overflow-hidden border-2 border-white shadow-sm bg-gray-100"
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
          </div>

          {/* Ligne 3 : Projet + Date + Actions */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
            <div className="flex items-center gap-2 text-[11px] text-gray-400 min-w-0">
              {cdc.projectName && (
                <span className="flex items-center gap-1 truncate bg-gray-100 px-1.5 py-0.5 rounded">
                  <LinkIcon className="h-3 w-3 shrink-0" />
                  {cdc.projectName}
                </span>
              )}
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="h-3 w-3" />
                {formatDate(cdc.timestamp)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-gray-400 rounded-md
                           hover:text-indigo-600 hover:bg-indigo-50 transition-colors
                           opacity-0 group-hover:opacity-100"
                title="Modifier"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dialogue de confirmation */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
          onClick={() => setShowConfirm(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden animate-in zoom-in-95 fade-in duration-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-800">
                Supprimer le CDC ?
              </h3>
              <button
                onClick={() => setShowConfirm(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-sm text-gray-600">
                <span className="font-medium text-gray-800">{cdc.titre}</span>
                {" — "}
                <span className="font-mono text-indigo-600">
                  {cdc.cdcNumero}
                </span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Cette action est irréversible.
              </p>
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-9 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 h-9 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CdcListe;
