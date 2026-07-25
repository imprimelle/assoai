// src/components/facture/FactureBuilderHeader.tsx
// Header collapsible pour le FactureBuilder — informations du document hors items.
// v3: Mode dual facture/commande, champs adaptés selon le mode.
// Inspiré de CdcBuilderHeader : barre résumée cliquable + contenu dépliable.

import React, { useState, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Receipt,
  ShoppingCart,
  User,
  Calendar,
  Tag,
  Upload,
  Loader2,
} from "lucide-react";
import type { FactureData, CommandeData } from "@/types";
import type { DeliveryAddress } from "@/types/material";
import { formatCFA } from "@/utils/format";
import UnifiedAtInput from "@/components/shared/UnifiedAtInput";
import type { AtSuggestion } from "@/components/shared/UnifiedAtInput";
import AddressPicker from "@/components/shared/AddressPicker";
import type { BuilderMode } from "@/pages/FactureBuilder";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";

export interface FactureBuilderHeaderProps {
  data: FactureData | CommandeData;
  onChange: (data: FactureData | CommandeData) => void;
  mode?: BuilderMode;
  messageId?: string;
  /** Force l'expansion (toggle externe tout déplier/replier) */
  forceOpen?: boolean;
  /** Facture verrouillée (commande déjà créée) */
  isLocked?: boolean;
}

function statutColor(s: string) {
  const l = (s || "").toLowerCase();
  if (l === "validé" || l === "terminée" || l === "terminé") return "bg-green-100 text-green-700";
  if (l === "vérification" || l === "confirmée" || l === "confirmé") return "bg-amber-100 text-amber-700";
  if (l === "en attente" || l === "en_cours") return "bg-blue-100 text-blue-700";
  if (l === "annulée" || l === "annulé") return "bg-red-100 text-red-700";
  return "bg-gray-100 text-gray-600";
}

const FactureBuilderHeader: React.FC<FactureBuilderHeaderProps> = ({
  data,
  onChange,
  mode = "facture",
  messageId,
  forceOpen,
  isLocked = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isUploadingRecu, setIsUploadingRecu] = useState(false);
  const recuFileInputRef = useRef<HTMLInputElement>(null);

  // Synchroniser avec le toggle externe
  React.useEffect(() => {
    if (forceOpen !== undefined) setExpanded(forceOpen);
  }, [forceOpen]);

  const isCommande = mode === "commande";

  const title = data.client.nom || (isCommande ? "Nouvelle commande" : "Nouvelle facture");
  const docNumero = isCommande
    ? (data as CommandeData).commandeNumero
    : (data as FactureData).factureNumero;
  const summary = docNumero || "";

  const updateClient = (field: string, value: string) => {
    onChange({ ...data, client: { ...data.client, [field]: value } });
  };

  const handleClientSuggestion = (sugg: AtSuggestion) => {
    if (sugg.kind === "client" && sugg.data) {
      onChange({
        ...data,
        client: {
          nom: sugg.data.nom || sugg.label,
          adresse: sugg.data.adresse || data.client.adresse,
          telephone: sugg.data.telephone || data.client.telephone,
        },
      });
    }
  };

  const updateField = (field: string, value: any) => {
    onChange({ ...data, [field]: value });
  };

  // 🆕 Upload reçu vers Supabase Storage
  const handleRecuUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsUploadingRecu(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${uuidv4()}.${fileExt}`;
      const filePath = `public/${fileName}`;
      const { error: uploadErr } = await supabase.storage
        .from("images")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage
        .from("images")
        .getPublicUrl(filePath);
      updateField("recu_image_url", urlData.publicUrl);
    } catch {
      console.error("Erreur upload reçu");
    } finally {
      setIsUploadingRecu(false);
    }
  };

  const isEditable = !(mode === "facture" && isLocked);

  const inputClass =
    "h-9 border border-gray-300 rounded-lg px-3 bg-white text-sm text-gray-800 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 outline-none w-full";
  const inputDisabledClass =
    "h-9 border border-gray-200 rounded-lg px-3 bg-gray-100 text-sm text-gray-500 cursor-not-allowed w-full";
  const labelClass = "block text-xs font-semibold text-gray-700 mb-1.5";

  return (
    <div className="mb-4">
      {/* Barre résumée */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        disabled={!isEditable && !expanded}
        className={`w-full flex items-center justify-between px-4 py-2.5
                   border border-gray-200 rounded-lg shadow-sm
                   transition-all duration-150 ${
                     isCommande
                       ? "bg-purple-50/50 hover:border-purple-300 hover:shadow"
                       : isLocked
                         ? "bg-gray-50 cursor-default"
                         : "bg-white hover:border-orange-300 hover:shadow"
                   }`}
      >
        <div className="min-w-0 flex-1 text-left">
          {/* Ligne 1 : Titre + Icône */}
          <div className="flex items-center gap-2">
            <div
              className={`p-1 rounded-full shrink-0 ${
                isCommande ? "bg-purple-100" : "bg-orange-100"
              }`}
            >
              {isCommande ? (
                <ShoppingCart className="h-3.5 w-3.5 text-purple-600" />
              ) : (
                <Receipt className="h-3.5 w-3.5 text-orange-600" />
              )}
            </div>
            <span className="text-sm font-bold text-gray-800 truncate">
              {isCommande ? "COMMANDE" : "FACTURE"} — {title}
            </span>
            {isLocked && (
              <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                🔒 verrouillée
              </span>
            )}
          </div>
          {/* Ligne 2 : N° + total + statut */}
          <div className="flex items-center gap-2 mt-0.5 ml-6">
            {summary && (
              <span className="text-xs text-gray-400 font-mono">{summary}</span>
            )}
            {data.total > 0 && (
              <span className="text-xs font-bold text-green-600">
                {formatCFA(data.total)}
              </span>
            )}
            {data.statut && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statutColor(
                  data.statut,
                )}`}
              >
                {data.statut}
              </span>
            )}
          </div>
        </div>
        {isEditable && (
          <div className="shrink-0 ml-2">
            {expanded ? (
              <ChevronUp size={16} className="text-gray-400" />
            ) : (
              <ChevronDown size={16} className="text-gray-400" />
            )}
          </div>
        )}
      </button>

      {/* Contenu dépliable */}
      {expanded && (
        <div className="mt-2 bg-gray-50/80 border border-gray-300 rounded-lg shadow-sm p-4 space-y-4">
          {/* ── Bloc Client (unifié @) ── */}
          <div>
            <label className={labelClass}>
              <User size={11} className="inline mr-1 text-gray-400" /> Client
            </label>

            <div data-highlight-key="client-nom">
              <UnifiedAtInput
                value={data.client.nom}
                onChange={(v) => updateClient("nom", v)}
                onSuggestionSelect={handleClientSuggestion}
                mode="client"
                placeholder="Nom du client… @ pour chercher dans l'historique"
                disabled={!isEditable}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  Téléphone
                </label>
                <input
                  type="text"
                  data-highlight-key="client-telephone"
                  value={data.client.telephone || ""}
                  onChange={(e) => updateClient("telephone", e.target.value)}
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                  placeholder="+225 …"
                />
              </div>
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  Adresse
                </label>
                <input
                  type="text"
                  data-highlight-key="client-adresse"
                  value={data.client.adresse}
                  onChange={(e) => updateClient("adresse", e.target.value)}
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                  placeholder="Adresse"
                />
              </div>
            </div>
          </div>

          {/* ── Bloc Détails document ── */}
          <div>
            <label className={labelClass}>
              <Calendar size={11} className="inline mr-1 text-gray-400" />{" "}
              {isCommande ? "Détails commande" : "Détails"}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Date */}
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  {isCommande ? "Date commande" : "Date d'émission"}
                </label>
                <input
                  type="date"
                  value={
                    isCommande
                      ? (data as CommandeData).dateCommande?.split("T")[0] || ""
                      : (data as FactureData).dateEmission?.split("T")[0] || ""
                  }
                  onChange={(e) =>
                    updateField(
                      isCommande ? "dateCommande" : "dateEmission",
                      e.target.value,
                    )
                  }
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                />
              </div>

              {/* Statut */}
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  Statut
                </label>
                <select
                  data-highlight-key="statut"
                  value={data.statut || (isCommande ? "en_attente" : "Brouillon")}
                  onChange={(e) => updateField("statut", e.target.value)}
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                >
                  {isCommande ? (
                    <>
                      <option value="en_attente">En attente</option>
                      <option value="confirmée">Confirmée</option>
                      <option value="en_cours">En cours</option>
                      <option value="terminée">Terminée</option>
                      <option value="annulée">Annulée</option>
                    </>
                  ) : (
                    <>
                      <option value="Brouillon">Brouillon</option>
                      <option value="Vérification">Vérification</option>
                      <option value="En attente">En attente</option>
                      <option value="Validé">Validé</option>
                    </>
                  )}
                </select>
              </div>

              {/* Délai livraison — masqué en mode commande */}
              {!isCommande && (
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  Délai livraison
                </label>
                <input
                  type="text"
                  data-highlight-key="delaiLivraison"
                  value={
                    (data as any).delaiLivraison || ""
                  }
                  onChange={(e) => updateField("delaiLivraison", e.target.value)}
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                  placeholder="Ex: 2 semaines"
                />
              </div>
              )}

              {/* Échéancier — masqué en mode commande */}
              {!isCommande && (
              <div>
                <label className="text-[11px] text-gray-500 mb-0.5 block">
                  Échéancier
                </label>
                <input
                  type="text"
                  data-highlight-key="echeancier"
                  value={
                    (data as any).echeancier || ""
                  }
                  onChange={(e) => updateField("echeancier", e.target.value)}
                  className={isEditable ? inputClass : inputDisabledClass}
                  disabled={!isEditable}
                  placeholder="Ex: 50% à la commande"
                />
              </div>
              )}
            </div>
          </div>

          {/* 🆕 Section spécifique commande */}
          {isCommande && (
            <>
              {/* Ligne 1 : Date livraison + Reçu + Facture liée */}
              <div className="flex items-end gap-3 mb-3">
                {/* Date de livraison */}
                <div className="flex-1 min-w-0">
                  <label className="text-[11px] text-gray-500 mb-0.5 block">
                    Date de livraison
                  </label>
                  <input
                    type="date"
                    value={(data as CommandeData).dateLivraison?.split("T")[0] || ""}
                    onChange={(e) => updateField("dateLivraison", e.target.value)}
                    className={isEditable ? inputClass : inputDisabledClass}
                    disabled={!isEditable}
                  />
                </div>

                {/* Reçu : thumbnail compact */}
                <div className="shrink-0">
                  <label className="text-[11px] text-gray-500 mb-0.5 block">
                    Reçu
                  </label>
                  {isUploadingRecu ? (
                    <div className="w-[42px] h-[42px] rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin text-orange-500" />
                    </div>
                  ) : (data as CommandeData).recu_image_url ? (
                    <button
                      type="button"
                      onClick={() => recuFileInputRef.current?.click()}
                      className="w-[42px] h-[42px] rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm
                                 hover:shadow-md hover:scale-105 transition-all duration-200 cursor-pointer"
                      title="Voir/changer le reçu"
                    >
                      <img
                        src={(data as CommandeData).recu_image_url!}
                        alt="Reçu"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => recuFileInputRef.current?.click()}
                      disabled={!isEditable}
                      className="w-[42px] h-[42px] rounded-lg bg-gray-100 border border-gray-200
                                 flex items-center justify-center hover:bg-gray-200 transition-colors
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Ajouter un reçu"
                    >
                      <Upload size={15} className="text-gray-400" />
                    </button>
                  )}
                  <input
                    ref={recuFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleRecuUpload}
                  />
                </div>

                {/* Facture liée */}
                <div className="flex-1 min-w-0">
                  <label className="text-[11px] text-gray-500 mb-0.5 block">
                    Facture liée
                  </label>
                  <input
                    type="text"
                    value={(data as CommandeData).linked_facture_id || ""}
                    disabled
                    className={inputDisabledClass}
                    placeholder="N° facture source"
                  />
                </div>
              </div>

              {/* Ligne 2 : Avance + Reste */}
              <div className="mb-3">
                <label className={labelClass}>
                  Avance (FCFA)
                </label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={data.total}
                      value={(data as any).montantAvance ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        onChange({ ...data, montantAvance: val } as CommandeData);
                      }}
                      className="h-9 w-28 border border-gray-300 rounded-lg px-3 bg-white text-sm text-right font-medium focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 outline-none"
                      disabled={!isEditable}
                      placeholder="0"
                    />
                    <span className="text-xs text-gray-500 font-medium">CFA</span>
                  </div>
                  {((data as any).montantAvance ?? 0) > 0 && (
                    <span className="text-xs text-gray-500">
                      Reste :{" "}
                      <span className="font-bold text-green-700">
                        {formatCFA(data.total - ((data as any).montantAvance ?? 0))}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 🆕 Adresse de livraison (mode commande, dernière position) */}
          {isCommande && (
            <div>
              <label className={labelClass}>
                📍 Adresse de livraison
              </label>
              <AddressPicker
                value={(data as CommandeData).deliveryAddress}
                onChange={(addr) => updateField("deliveryAddress", addr)}
                isEditable={isEditable}
              />
            </div>
          )}

          {/* ── Bloc Remise ── */}
          <div>
            <label className={labelClass}>
              <Tag size={11} className="inline mr-1 text-gray-400" /> Remise
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  data-highlight-key="remise"
                  value={(data as any).reduction ?? 0}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    let base = 0;
                    if (isCommande) {
                      base = ((data as CommandeData).items || []).reduce(
                        (s, it) => s + it.sous_total,
                        0,
                      );
                    } else {
                      base = ((data as FactureData).details || []).reduce(
                        (s, d) => s + d.sous_total,
                        0,
                      );
                    }
                    onChange({ ...data, reduction: val, total: base - val });
                  }}
                  className={`h-9 w-28 border border-gray-300 rounded-lg px-3 text-sm text-right font-medium focus:ring-2 focus:ring-orange-500/60 focus:border-orange-400 outline-none ${
                    isEditable ? "bg-white" : "bg-gray-100 cursor-not-allowed"
                  }`}
                  disabled={!isEditable}
                />
                <span className="text-xs text-gray-500 font-medium">CFA</span>
              </div>
              <span className="text-xs text-gray-500">
                sur{" "}
                {formatCFA(
                  isCommande
                    ? ((data as CommandeData).items || []).reduce(
                        (s, it) => s + it.sous_total,
                        0,
                      )
                    : ((data as FactureData).details || []).reduce(
                        (s, d) => s + d.sous_total,
                        0,
                      ),
                )}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FactureBuilderHeader;
