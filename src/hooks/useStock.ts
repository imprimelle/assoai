// src/hooks/useStock.ts
// CRUD de la table stock_sheets (feuilles de matière + sections découpées).
// Miroir de useMaterials : lecture via client supabase, create/update/delete idem.

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  StockSheet,
  StockSection,
  StockType,
  StockNature,
} from "@/types/stock";

const toSheet = (item: any): StockSheet => ({
  id: item.id,
  type: (item.type as StockType) || "feuille",
  nature: (item.nature as StockNature) || "vitre",
  nom: item.nom ?? null,
  largeur: item.largeur != null ? Number(item.largeur) : null,
  hauteur: item.hauteur != null ? Number(item.hauteur) : null,
  profondeur: item.profondeur != null ? Number(item.profondeur) : null,
  sections: Array.isArray(item.sections)
    ? (item.sections as any[]).map(
        (s): StockSection => ({
          id: s?.id || crypto.randomUUID(),
          nom: s?.nom || "",
          nature: (s?.nature as StockNature) || "vitre",
          largeur: Number(s?.largeur) || 0,
          hauteur: Number(s?.hauteur) || 0,
          statut: s?.statut || "decoupe",
        }),
      )
    : [],
  created_at: item.created_at,
  updated_at: item.updated_at,
});

export interface StockSheetInput {
  type: StockType;
  nature: StockNature;
  nom: string | null;
  largeur: number | null;
  hauteur: number | null;
  profondeur: number | null;
  sections: StockSection[];
}

export function useStock() {
  const [sheets, setSheets] = useState<StockSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchSheets = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from("stock_sheets")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchError) throw fetchError;
      setSheets((data || []).map(toSheet));
      setError(null);
    } catch (err) {
      console.error("Error in useStock:", err);
      setError(err as Error);
      toast({
        title: "Erreur de chargement du stock",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const createSheet = async (input: StockSheetInput): Promise<StockSheet | null> => {
    try {
      const { data, error: createError } = await supabase
        .from("stock_sheets")
        .insert({
          type: input.type,
          nature: input.nature,
          nom: input.nom,
          largeur: input.largeur,
          hauteur: input.hauteur,
          profondeur: input.profondeur,
          sections: input.sections,
        })
        .select("*")
        .single();
      if (createError) throw createError;
      toast({ title: "Élément ajouté au stock" });
      fetchSheets();
      return data ? toSheet(data) : null;
    } catch (err) {
      console.error("createSheet error:", err);
      toast({
        title: "Erreur lors de l'ajout",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const updateSheet = async (
    id: string,
    patch: Partial<StockSheetInput>,
  ): Promise<void> => {
    try {
      const { error: updateError } = await supabase
        .from("stock_sheets")
        .update(patch)
        .eq("id", id);
      if (updateError) throw updateError;
      // Mise à jour locale immédiate (optimiste) + refetch
      setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      fetchSheets();
    } catch (err) {
      console.error("updateSheet error:", err);
      toast({
        title: "Erreur lors de la mise à jour",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const deleteSheet = async (id: string): Promise<void> => {
    try {
      const { error: deleteError } = await supabase
        .from("stock_sheets")
        .delete()
        .eq("id", id);
      if (deleteError) throw deleteError;
      toast({ title: "Élément supprimé du stock" });
      setSheets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("deleteSheet error:", err);
      toast({
        title: "Erreur lors de la suppression",
        description: (err as Error).message,
        variant: "destructive",
      });
      throw err;
    }
  };

  useEffect(() => {
    fetchSheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    sheets,
    isLoading,
    error,
    refetch: fetchSheets,
    createSheet,
    updateSheet,
    deleteSheet,
  };
}
