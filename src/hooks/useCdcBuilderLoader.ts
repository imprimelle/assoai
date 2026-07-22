// src/hooks/useCdcBuilderLoader.ts
// Charge les données initiales du CDC Builder à partir d'un projet,
// de sa commande validée, et de l'éventuel CDC existant.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CdcBuilderState, CdcBuilderEnseigne } from "@/types/cdcBuilder";
import type { MaterialItem } from "@/types/material";

// ── Types ──

export interface ProjectOption {
  id: string;
  name: string;
}

export interface CdcBuilderLoaderResult {
  /** State initial à injecter dans le CDC Builder */
  initialState: CdcBuilderState | null;
  /** Projet concerné (si trouvé) */
  project: ProjectOption | null;
  /** true = chargement en cours */
  isLoading: boolean;
  /** Message d'erreur éventuel */
  error: string | null;
}

// ── Helpers ──

const VALID_COMMANDE_STATUTS = ["Validée", "Confirmée", "En cours", "en_cours", "confirmée"];

function createEmptyEnseigneFromItem(item: {
  id: string;
  nom: string;
  image_url?: string;
}): CdcBuilderEnseigne {
  return {
    id: crypto.randomUUID?.() || `ens-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    nom: item.nom,
    dimensions: { largeur: 200, hauteur: 100 },
    image_url: item.image_url,
    technique: { type_structure: "", method_fabrication: "" },
    produits: [],
  };
}

// ── Hook ──

export function useCdcBuilderLoader(projectId?: string | null) {
  return useQuery<CdcBuilderLoaderResult>({
    queryKey: ["cdcBuilderLoader", projectId],
    queryFn: async (): Promise<CdcBuilderLoaderResult> => {
      if (!projectId) {
        return { initialState: null, project: null, isLoading: false, error: null };
      }

      // 1. Récupérer le projet
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .select("id, name")
        .eq("id", projectId)
        .single();

      if (projErr || !project) {
        return {
          initialState: null,
          project: null,
          isLoading: false,
          error: `Projet introuvable : ${projErr?.message || "ID inconnu"}`,
        };
      }

      // 2. Trouver la commande validée liée au projet
      const { data: commandeMsg, error: cmdErr } = await supabase
        .from("messages")
        .select("id, template_data")
        .eq("project_id", projectId)
        .eq("template_type", "commande")
        .not("template_data", "is", null)
        .order("timestamp", { ascending: false })
        .limit(1);

      if (cmdErr) {
        return {
          initialState: null,
          project: { id: project.id, name: project.name },
          isLoading: false,
          error: `Erreur commandes : ${cmdErr.message}`,
        };
      }

      // Filtrer sur le statut (côté JS car le statut est dans le JSONB)
      const validCommande = commandeMsg?.find((msg: any) => {
        const data = msg.template_data?.data;
        return data && VALID_COMMANDE_STATUTS.includes(data.statut);
      });

      const commandeData = validCommande?.template_data?.data;
      const commandeId = commandeData?.commandeNumero || "";

      // 3. Vérifier si un CDC existe déjà pour ce projet
      const { data: cdcMsg, error: cdcErr } = await supabase
        .from("messages")
        .select("id, template_data")
        .eq("project_id", projectId)
        .eq("template_type", "cahier_des_charges")
        .not("template_data", "is", null)
        .order("timestamp", { ascending: false })
        .limit(1);

      const cdcData = cdcMsg?.[0]?.template_data?.data;

      // 4. Construire le state initial
      let initialState: CdcBuilderState;

      if (cdcData && cdcData.enseignes?.length > 0) {
        // ── CDC existant → charger ses données ──
        const enseignes: CdcBuilderEnseigne[] = cdcData.enseignes.map(
          (ens: any): CdcBuilderEnseigne => ({
            id: ens.id || crypto.randomUUID(),
            nom: ens.nom || "",
            dimensions: ens.details?.dimensions || { largeur: 200, hauteur: 100 },
            image_url: ens.details?.image_url || ens.image_url,
            technique: ens.details?.technique || {
              type_structure: "",
              method_fabrication: "",
            },
            produits: ens.produits || [],
          }),
        );

        const materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>> =
          {};
        cdcData.enseignes.forEach((ens: any) => {
          materiauxByEnseigne[ens.id] = ens.materiauxSections || {};
        });

        initialState = {
          projectName: project.name,
          cdcNumero: cdcData.cdcNumero || "",
          commandeId: cdcData.commande_id || commandeId,
          enseignes,
          activeEnseigneIndex: 0,
          materiauxByEnseigne,
          equipe: cdcData.equipe || [],
          deliveryAddress: cdcData.deliveryAddress || commandeData?.deliveryAddress,
        };
      } else if (commandeData?.items?.length > 0) {
        // ── Pas de CDC, mais commande validée → créer enseignes depuis les items ──
        const enseignes: CdcBuilderEnseigne[] = commandeData.items.map(
          (item: any) => createEmptyEnseigneFromItem(item),
        );

        const materiauxByEnseigne: Record<string, Record<string, MaterialItem[]>> =
          {};
        enseignes.forEach((ens) => {
          materiauxByEnseigne[ens.id] = {};
        });

        initialState = {
          projectName: project.name,
          cdcNumero: "",
          commandeId,
          enseignes,
          activeEnseigneIndex: 0,
          materiauxByEnseigne,
          equipe: [],
          deliveryAddress: commandeData.deliveryAddress,
        };
      } else {
        // ── Ni CDC ni commande → état vide par défaut ──
        const emptyEnseigne = createEmptyEnseigneFromItem({
          id: "empty",
          nom: "Nouvelle enseigne",
        });

        initialState = {
          projectName: project.name,
          cdcNumero: "",
          commandeId: commandeId,
          enseignes: [emptyEnseigne],
          activeEnseigneIndex: 0,
          materiauxByEnseigne: { [emptyEnseigne.id]: {} },
          equipe: [],
          deliveryAddress: commandeData?.deliveryAddress,
        };
      }

      return {
        initialState,
        project: { id: project.id, name: project.name },
        isLoading: false,
        error: null,
      };
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
}
