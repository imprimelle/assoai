// src/hooks/useProductBom.ts
// Hook CRUD pour la table product_bom — miroir de useMaterials.ts
// Lecture via client Supabase, écriture via fetch PostgREST (service key)

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { appLogger } from "@/utils/logger";
import { ProductBomItem, ProductBomFormItem } from "@/types/productBom";

const SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co";
const ANON_KEY = "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7";

// ⚠️ La clé service role n'est pas exposée côté client.
// Les mutations passent par le client Supabase (auth RLS) pour INSERT/UPDATE/DELETE.
// La table product_bom a une RLS "authenticated" pour les mutations.

const toItem = (raw: any): ProductBomItem => ({
  id: raw.id,
  product_id: raw.product_id,
  variant_id: raw.variant_id ?? null,
  section: raw.section || "Découpe",
  material_id: raw.material_id ?? null,
  material_name: raw.material_name || "",
  formule: raw.formule ?? null,
  quantite_fixe: raw.quantite_fixe ?? null,
  unite: raw.unite || "unité",
  reference: raw.reference ?? null,
  ordre: raw.ordre || 0,
  condition_expr: raw.condition_expr ?? null,
  profile_group: raw.profile_group ?? null,
  profile_value: raw.profile_value ?? null,
  meta_variables: raw.meta_variables ?? null,
  created_at: raw.created_at,
  updated_at: raw.updated_at,
});

export function useProductBom(productId?: string) {
  const [items, setItems] = useState<ProductBomItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  // READ — toutes les entrées BOM pour ce produit
  const fetchBom = useCallback(async () => {
    if (!productId) {
      setItems([]);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("product_bom")
        .select("*")
        .eq("product_id", productId)
        .order("ordre", { ascending: true });

      if (err) throw err;
      setItems((data || []).map(toItem));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      appLogger.error("useProductBom.fetchBom", { error: msg });
      setError(e instanceof Error ? e : new Error(msg));
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    fetchBom();
  }, [fetchBom]);

  // CREATE — insère un nouvel item
  const addItem = useCallback(
    async (formItem: ProductBomFormItem) => {
      if (!productId) return null;
      try {
        const payload = {
          product_id: productId,
          section: formItem.section,
          material_id: formItem.material_id ?? null,
          material_name: formItem.material_name,
          formule: formItem.formule ?? null,
          quantite_fixe: formItem.quantite_fixe ?? null,
          unite: formItem.unite,
          reference: formItem.reference ?? null,
          ordre: formItem.ordre,
          condition_expr: formItem.condition_expr ?? null,
          profile_group: formItem.profile_group ?? null,
          profile_value: formItem.profile_value ?? null,
          meta_variables: formItem.meta_variables ?? null,
        };

        const { data, error: err } = await supabase
          .from("product_bom")
          .insert(payload)
          .select()
          .single();

        if (err) throw err;
        const newItem = toItem(data);
        setItems((prev) => [...prev, newItem].sort((a, b) => a.ordre - b.ordre));
        return newItem;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appLogger.error("useProductBom.addItem", { error: msg });
        toast({
          title: "Erreur",
          description: `Impossible d'ajouter le matériau : ${msg}`,
          variant: "destructive",
        });
        return null;
      }
    },
    [productId, toast]
  );

  // UPDATE — modifie un item existant
  const updateItem = useCallback(
    async (id: string, changes: Partial<ProductBomFormItem>) => {
      try {
        const { error: err } = await supabase
          .from("product_bom")
          .update(changes)
          .eq("id", id);

        if (err) throw err;
        setItems((prev) =>
          prev
            .map((item) => (item.id === id ? { ...item, ...changes } : item))
            .sort((a, b) => a.ordre - b.ordre)
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appLogger.error("useProductBom.updateItem", { error: msg });
        toast({
          title: "Erreur",
          description: `Impossible de modifier le matériau : ${msg}`,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // DELETE — supprime un item
  const deleteItem = useCallback(
    async (id: string) => {
      try {
        const { error: err } = await supabase
          .from("product_bom")
          .delete()
          .eq("id", id);

        if (err) throw err;
        setItems((prev) => prev.filter((item) => item.id !== id));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appLogger.error("useProductBom.deleteItem", { error: msg });
        toast({
          title: "Erreur",
          description: `Impossible de supprimer le matériau : ${msg}`,
          variant: "destructive",
        });
      }
    },
    [toast]
  );

  // REPLACE ALL — utile pour le drag-and-drop ou réordonnancement
  const replaceAll = useCallback(
    async (newItems: ProductBomFormItem[]) => {
      if (!productId) return;
      try {
        // Supprimer tous les items existants
        const { error: delErr } = await supabase
          .from("product_bom")
          .delete()
          .eq("product_id", productId);
        if (delErr) throw delErr;

        // Insérer les nouveaux
        const payloads = newItems.map((item) => ({
          product_id: productId,
          section: item.section,
          material_id: item.material_id ?? null,
          material_name: item.material_name,
          formule: item.formule ?? null,
          quantite_fixe: item.quantite_fixe ?? null,
          unite: item.unite,
          reference: item.reference ?? null,
          ordre: item.ordre,
          condition_expr: item.condition_expr ?? null,
          profile_group: item.profile_group ?? null,
          profile_value: item.profile_value ?? null,
          meta_variables: item.meta_variables ?? null,
        }));

        const { data, error: insErr } = await supabase
          .from("product_bom")
          .insert(payloads)
          .select();
        if (insErr) throw insErr;

        setItems((data || []).map(toItem).sort((a, b) => a.ordre - b.ordre));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appLogger.error("useProductBom.replaceAll", { error: msg });
        toast({
          title: "Erreur",
          description: `Impossible de sauvegarder la nomenclature : ${msg}`,
          variant: "destructive",
        });
      }
    },
    [productId, toast]
  );

  return {
    items,
    isLoading,
    error,
    addItem,
    updateItem,
    deleteItem,
    replaceAll,
    refresh: fetchBom,
  };
}
