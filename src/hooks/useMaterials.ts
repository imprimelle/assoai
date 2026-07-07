// src/hooks/useMaterials.ts
// Miroir de useProducts : lecture via client supabase, create/update via fetch
// PostgREST brut (comme useProducts), delete via client. Table `materials`.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { appLogger } from "@/utils/logger";
import {
  MaterialCatalogEntry,
  MaterialCatalogFormData,
} from "@/types/materialCatalog";

const SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co";
const ANON_KEY = "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7";

const toEntry = (item: any): MaterialCatalogEntry => ({
  id: item.id,
  external_id: item.external_id ?? null,
  categorie: item.categorie || "Découpe",
  materiau: item.materiau || "",
  epaisseur: item.epaisseur ?? null,
  format_standard: item.format_standard ?? null,
  largeur_std: item.largeur_std != null ? Number(item.largeur_std) : null,
  hauteur_std: item.hauteur_std != null ? Number(item.hauteur_std) : null,
  cout_min: item.cout_min != null ? Number(item.cout_min) : null,
  cout_max: item.cout_max != null ? Number(item.cout_max) : null,
  cout_usinage: item.cout_usinage != null ? Number(item.cout_usinage) : null,
  unite: item.unite || "plaque",
  couleurs: Array.isArray(item.couleurs) ? item.couleurs.map(String) : [],
  image_url: item.image_url ?? null,
  puissance_volt: item.puissance_volt ?? null,
  etancheite: item.etancheite ?? null,
  indications: item.indications ?? null,
  created_at: item.created_at,
  updated_at: item.updated_at,
});

export function useMaterials(searchTerm: string = "", categorie: string = "ALL") {
  const [materials, setMaterials] = useState<MaterialCatalogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchMaterials = useCallback(async () => {
    try {
      setIsLoading(true);
      let query = supabase.from("materials").select("*");
      if (categorie !== "ALL") query = query.eq("categorie", categorie);
      if (searchTerm) query = query.ilike("materiau", `%${searchTerm}%`);
      const { data, error: fetchError } = await query.order("materiau", {
        ascending: true,
      });
      if (fetchError) throw fetchError;
      setMaterials((data || []).map(toEntry));
      setError(null);
    } catch (err) {
      console.error("Error in useMaterials:", err);
      setError(err as Error);
      toast({
        title: "Erreur de chargement des matériaux",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, categorie, toast]);

  const createMaterial = async (data: MaterialCatalogFormData) => {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/materials`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
          Prefer: "return=representation",
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      const result = await response.json();
      toast({ title: "Matériau créé", description: data.materiau });
      fetchMaterials();
      return result?.[0] ? toEntry(result[0]) : null;
    } catch (err) {
      appLogger.error("createMaterial error", { err });
      toast({
        title: "Erreur lors de la création",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateMaterial = async (
    id: string,
    data: Partial<MaterialCatalogFormData>,
  ) => {
    try {
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/materials?id=eq.${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: ANON_KEY,
            Authorization: `Bearer ${ANON_KEY}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({ ...data, updated_at: new Date().toISOString() }),
        },
      );
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errText}`);
      }
      toast({ title: "Matériau mis à jour" });
      fetchMaterials();
    } catch (err) {
      appLogger.error("updateMaterial error", { err });
      toast({
        title: "Erreur lors de la mise à jour",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteMaterial = async (id: string) => {
    try {
      const { error: delError } = await supabase
        .from("materials")
        .delete()
        .eq("id", id);
      if (delError) throw delError;
      toast({ title: "Matériau supprimé" });
      fetchMaterials();
    } catch (err) {
      toast({
        title: "Erreur lors de la suppression",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchMaterials();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, categorie]);

  return {
    materials,
    isLoading,
    error,
    refetch: fetchMaterials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
  };
}
