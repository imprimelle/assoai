
import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCreateDemande } from "../../hooks/useDemandes";
import { cn } from "@/lib/utils";
import { Loader2, Check, ChevronUp, ChevronDown, Lock, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/* ── Props ── */
interface DemandesFooterProps {
  onSuccess?: () => void;
  /** Si fourni, le demandeur est verrouillé sur ce contact (technicien, commerciale...) */
  lockedApplicant?: { name: string; id: string };
  /** Monnaie (surplus) disponible pour cet applicant — prélevée en priorité */
  monnaieDisponible?: number;
}

/* ── Composant principal ── */
export function DemandesFooter({ onSuccess, lockedApplicant, monnaieDisponible = 0 }: DemandesFooterProps) {
  const createDemande = useCreateDemande();
  const [expanded, setExpanded] = useState(false);
  const [applicantName, setApplicantName] = useState(lockedApplicant?.name || "");
  const [applicantId, setApplicantId] = useState<string | null>(lockedApplicant?.id || null);
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([
    { description: "", amount: "" },
  ]);
  const [submitted, setSubmitted] = useState(false);
  const prevFirstDesc = useRef("");

  // Quand lockedApplicant change, mettre à jour
  useEffect(() => {
    if (lockedApplicant) {
      setApplicantName(lockedApplicant.name);
      setApplicantId(lockedApplicant.id);
    }
  }, [lockedApplicant]);

  // Auto-remplir le motif avec la première ligne d'item (si verrouillé)
  useEffect(() => {
    const firstDesc = lines[0]?.description?.trim() || "";
    if (lockedApplicant && firstDesc && firstDesc !== prevFirstDesc.current) {
      setDescription(firstDesc);
      prevFirstDesc.current = firstDesc;
    }
    if (!lockedApplicant) {
      prevFirstDesc.current = "";
    }
  }, [lines, lockedApplicant]);

  // Fetch contacts for applicant selector (seulement si non verrouillé)
  const { data: contacts } = useQuery({
    queryKey: ["contacts-for-demande"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("human_contacts")
        .select("id, name, role")
        .eq("is_active", true)
        .order("name") as any);
      if (error) return [];
      return data;
    },
    staleTime: 60_000,
    enabled: !lockedApplicant,
  });

  // Fetch projects
  const { data: projects } = useQuery({
    queryKey: ["projects-for-demande"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("projects")
        .select("id, name")
        .order("name") as any);
      if (error) return [];
      return data;
    },
    staleTime: 60_000,
  });

  const subTotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const monnaieUtilisee = Math.min(monnaieDisponible, subTotal);
  const caisseDebitee = subTotal - monnaieUtilisee;

  const formatDisplay = (raw: string): string => {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    return Number(digits).toLocaleString("fr-FR").replace(/\u202f/g, " ");
  };

  const updateLine = (idx: number, field: "description" | "amount", value: string) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { description: "", amount: "" }]);
  };

  const removeLine = (idx: number) => {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const resetForm = () => {
    if (!lockedApplicant) {
      setApplicantName("");
      setApplicantId(null);
    }
    setDescription("");
    setProjectId("");
    setLines([{ description: "", amount: "" }]);
    prevFirstDesc.current = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = lines.filter(
      (l) => l.description.trim() && Number(l.amount) > 0
    );
    if (!applicantName.trim() || validLines.length === 0) return;

    try {
      const items = validLines.map((l) => ({
        description: l.description.trim(),
        amount: Math.round(Number(l.amount)),
      }));
      const total = items.reduce((s, i) => s + i.amount, 0);

      // Motif = description manuelle si non verrouillé, sinon auto (première ligne)
      const motif = lockedApplicant
        ? validLines[0].description.trim()
        : description.trim();

      await createDemande.mutateAsync({
        applicant_name: applicantName.trim(),
        applicant_id: applicantId || undefined,
        project_id: projectId || undefined,
        description: motif,
        items,
        total_amount: total,
        monnaie_disponible: monnaieDisponible,
      });

      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 2000);
      resetForm();
      setExpanded(false);
      onSuccess?.();
    } catch (err) {
      console.error("Erreur création demande:", err);
    }
  };

  const validCount = lines.filter(
    (l) => l.description.trim() && Number(l.amount) > 0
  ).length;

  return (
    <>
      <div style={{ height: expanded ? Math.max(240, 140 + lines.length * 56) : 56 }} aria-hidden="true" />

      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 shadow-lg z-50">
        {/* Barre d'action */}
        <div className="flex items-center gap-2 px-3 pt-2 pb-1">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex-1 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white border border-orange-500 shadow-sm"
          >
            📤 Nouvelle demande
          </button>
          {monnaieDisponible > 0 && (
            <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-1 rounded font-medium whitespace-nowrap">
              💰 {monnaieDisponible.toLocaleString("fr-FR")} FCFA
            </span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className={cn(
              "p-2 transition-colors rounded-lg",
              expanded
                ? "text-gray-500 hover:text-gray-700"
                : "text-gray-500 hover:text-gray-700 bg-white border border-gray-300"
            )}
          >
            {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </button>
        </div>

        {expanded && (
          <form onSubmit={handleSubmit} className="px-3 pb-3 space-y-2.5">
            {/* 🆕 Ligne 1 : Demandeur + Projet côte à côte */}
            <div className="flex gap-2">
              {/* Demandeur */}
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">
                  {lockedApplicant ? (
                    <span className="flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> 👤 Demandeur
                    </span>
                  ) : (
                    "👤 Demandeur"
                  )}
                </label>
                {lockedApplicant ? (
                  <div className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{applicantName}</span>
                  </div>
                ) : (
                  <select
                    value={applicantName}
                    onChange={(e) => {
                      const selectedName = e.target.value;
                      setApplicantName(selectedName);
                      const contact = contacts?.find((c: any) => c.name === selectedName);
                      setApplicantId(contact?.id || null);
                    }}
                    className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700"
                  >
                    <option value="">Sélectionner un contact...</option>
                    {contacts?.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name} — {c.role}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Projet */}
              <div className="flex-1">
                <label className="text-[10px] text-gray-400 block mb-1">📁 Projet (optionnel)</label>
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white text-gray-700"
                >
                  <option value="">Pas de projet</option>
                  {projects?.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 🆕 Motif : masqué si verrouillé, visible pour directeur/adjointe */}
            {!lockedApplicant && (
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">📝 Motif</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Achat matériaux enseigne Hôtel Ivoire"
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                />
              </div>
            )}

            {/* Lignes (items de la demande) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  📝 Lignes
                </p>
                {lines.length > 1 && (
                  <span className="text-[10px] text-gray-400 bg-gray-200/50 px-2 py-0.5 rounded-full">
                    {lines.length} lignes
                  </span>
                )}
              </div>
              {lines.map((line, idx) => (
                <div key={idx}
                  className="flex items-start gap-2 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow transition-all p-2.5"
                >
                  {/* Description */}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={line.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      placeholder="Quoi ?"
                      className="w-full h-10 px-3 border-0 bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    />
                  </div>

                  {/* Divider */}
                  <div className="w-px h-10 bg-gray-100 shrink-0" />

                  {/* Montant */}
                  <div className="w-32 flex-shrink-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.amount ? formatDisplay(line.amount) : ""}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, "").replace(/\D/g, "");
                        updateLine(idx, "amount", raw);
                      }}
                      placeholder="Combien ?"
                      className="w-full h-10 px-0 border-0 bg-transparent text-sm font-bold text-gray-900 placeholder:text-gray-300 text-right focus:outline-none"
                    />
                  </div>

                  {/* Supprimer */}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="h-10 w-10 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                Ajouter une ligne
              </button>
            </div>

            {/* 🆕 Prélèvement Monnaie / Caisse */}
            {subTotal > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[10px]">
                  {monnaieUtilisee > 0 && (
                    <span className="text-amber-600 bg-amber-50 px-2 py-1 rounded font-medium">
                      💰 Monnaie utilisée : {monnaieUtilisee.toLocaleString("fr-FR")} FCFA
                    </span>
                  )}
                  {caisseDebitee > 0 && (
                    <span className="text-red-600 bg-red-50 px-2 py-1 rounded font-medium">
                      🏦 Caisse débitée : {caisseDebitee.toLocaleString("fr-FR")} FCFA
                    </span>
                  )}
                </div>
                {validCount > 0 && (
                  <div className="text-[10px] text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block font-medium">
                    📋 {validCount} demande{validCount > 1 ? "s" : ""} à enregistrer
                  </div>
                )}
              </div>
            )}

            {/* 🆕 Aide contextuelle — montre pourquoi le bouton est grisé */}
            {(validCount === 0 || !applicantName.trim()) && (
              <div className="text-[10px] text-gray-400 space-y-0.5">
                {!applicantName.trim() && (
                  <p>👤 Sélectionne un demandeur</p>
                )}
                {validCount === 0 && (
                  <p>📝 Remplis au moins un article avec un montant</p>
                )}
              </div>
            )}

            {/* Sous-total + Envoyer */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center justify-between bg-white rounded-lg border border-gray-200 px-3 py-2">
                <span className="text-xs text-gray-500">Total</span>
                <span className="text-sm font-bold text-gray-900">
                  {subTotal.toLocaleString("fr-FR").replace(/,/g, " ")} FCFA
                </span>
              </div>
              <button
                type="submit"
                disabled={createDemande.isPending || !applicantName.trim() || validCount === 0}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {createDemande.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitted ? <Check className="h-4 w-4" /> : null}
                {submitted ? "Envoyé !" : `📤 Enregistrer${validCount > 1 ? ` (${validCount})` : ""}`}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-5 py-2.5 border border-gray-300 text-gray-500 rounded-lg text-sm hover:bg-white transition-colors"
              >
                🔄
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
