// src/components/facture/NouvelleFactureDialog.tsx
// Dialogue compact pour créer une nouvelle facture avec infos client.
// Champs : nom client (@ suggestions), téléphone, adresse.
// Design identique aux champs de FactureBuilderHeader.
// Au clic sur Confirmer → alloue un N° via RPC → sauvegarde → ouvre FactureBuilder.

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, User, Phone, MapPin, Loader2 } from "lucide-react";
import UnifiedAtInput from "@/components/shared/UnifiedAtInput";
import type { AtSuggestion } from "@/components/shared/UnifiedAtInput";
import type { FactureData } from "@/types";
import type { User as AppUser } from "@/types/user";
import { supabase } from "@/integrations/supabase/client";

export interface NouvelleFactureDialogProps {
  open: boolean;
  onClose: () => void;
  user: AppUser;
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

const NouvelleFactureDialog: React.FC<NouvelleFactureDialogProps> = ({
  open,
  onClose,
  user,
}) => {
  const navigate = useNavigate();

  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [adresse, setAdresse] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSuggestionSelect = (sugg: AtSuggestion) => {
    if (sugg.kind === "client" && sugg.data) {
      // Remplissage auto des champs depuis le client suggéré
      setNom(sugg.data.nom || sugg.label);
      if (sugg.data.telephone && !telephone)
        setTelephone(sugg.data.telephone);
      if (sugg.data.adresse && !adresse) setAdresse(sugg.data.adresse);
    }
  };

  const handleConfirm = async () => {
    if (!nom.trim()) {
      setError("Le nom du client est requis.");
      return;
    }
    setCreating(true);
    setError("");

    try {
      // 1. Allouer un numéro
      const numero = await fetchNextFactureNumber();

      // 2. Construire les données initiales
      const factureData: FactureData = {
        factureNumero: numero,
        dateEmission: new Date().toISOString().split("T")[0],
        client: {
          nom: nom.trim(),
          adresse: adresse.trim(),
          telephone: telephone.trim() || undefined,
        },
        details: [],
        total: 0,
        version: 1,
        is_latest: true,
      };

      // 3. Sauvegarder dans Supabase
      const newMessageId = crypto.randomUUID();
      const message = {
        id: newMessageId,
        session_id: `facture-${newMessageId}`,
        user_id: user.id,
        content: `Facture — ${numero}`,
        sender: user.name || user.id,
        timestamp: new Date().toISOString(),
        template_type: "facture",
        template_data: {
          data: factureData,
          metadata: {
            displayName: "Facture",
            availableActions: ["save", "download"],
            mode: "editable",
          },
        },
      };

      const { error: insertErr } = await supabase
        .from("messages")
        .insert(message);

      if (insertErr) throw insertErr;

      // 4. Fermer + naviguer vers FactureBuilder
      onClose();
      navigate(`/facture-builder?messageId=${newMessageId}`);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création.");
    } finally {
      setCreating(false);
    }
  };

  // Styles identiques à FactureBuilderHeader
  const inputClass =
    "h-9 border border-gray-200 rounded-lg px-3 bg-white text-sm text-gray-700 placeholder:text-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-orange-400 outline-none w-full";
  const labelClass = "block text-[11px] font-medium text-gray-400 mb-1";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
      onClick={onClose}
    >
      {/* Carte centrale */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 fade-in duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Nouvelle facture
          </h2>
          <button
            onClick={onClose}
            disabled={creating}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Formulaire */}
        <div className="px-5 py-4 space-y-4">
          {/* Nom client */}
          <div>
            <label className={labelClass}>
              <User size={11} className="inline mr-1 text-gray-300" /> Nom du
              client
            </label>
            <UnifiedAtInput
              value={nom}
              onChange={setNom}
              onSuggestionSelect={handleSuggestionSelect}
              mode="client"
              placeholder="Nom du client… @ pour chercher dans l'historique"
            />
          </div>

          {/* Téléphone */}
          <div>
            <label className={labelClass}>
              <Phone size={11} className="inline mr-1 text-gray-300" />{" "}
              Téléphone
            </label>
            <input
              type="text"
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              className={inputClass}
              placeholder="+225 …"
            />
          </div>

          {/* Adresse */}
          <div>
            <label className={labelClass}>
              <MapPin size={11} className="inline mr-1 text-gray-300" /> Adresse
            </label>
            <input
              type="text"
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              className={inputClass}
              placeholder="Adresse"
            />
          </div>

          {/* Erreur */}
          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleConfirm}
            disabled={creating || !nom.trim()}
            className="w-full h-10 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300
                       text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2
                       transition-colors shadow-sm"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Création…
              </>
            ) : (
              "Confirmer"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NouvelleFactureDialog;
