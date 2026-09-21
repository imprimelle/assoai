// src/hooks/useStock.ts
// CRUD de la table stock_sheets via PostgREST brut (comme useMaterials/useProducts).
// Évite le typage généré obsolète (supabase.from("stock_sheets") → never).
// Inclut un verrou optimiste basé sur updated_at (détection de concurrence).

import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  StockSheet,
  StockSheetInput,
  StockSection,
  StockHistoryEvent,
  StockType,
  StockNature,
} from "@/types/stock";

const SUPABASE_URL = "https://yqioyfuxviiximembver.supabase.co";
const ANON_KEY = "sb_publishable_KZfNfiGqqAu2sKShjOys9Q_QtJyCKF7";

const toSheet = (item: any): StockSheet => ({
  id: item.id,
  type: (item.type as StockType) || "feuille",
  nature: (item.nature as StockNature) || "vitre",
  nom: item.nom ?? null,
  longueur: item.longueur != null ? Number(item.longueur) : null,
  largeur: item.largeur != null ? Number(item.largeur) : null,
  hauteur: item.hauteur != null ? Number(item.hauteur) : null,
  epaisseur: item.epaisseur ?? null,
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
  section_history: Array.isArray(item.section_history)
    ? (item.section_history as StockHistoryEvent[])
    : [],
  created_by: item.created_by ?? null,
  created_by_name: item.created_by_name ?? null,
  created_at: item.created_at,
  updated_at: item.updated_at,
});

/** Petit client PostgREST (headers + JSON). */
async function pg(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
      Prefer: "return=representation",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export class StockConflictError extends Error {
  constructor() {
    super("CONCURRENT_MODIFICATION");
    this.name = "StockConflictError";
  }
}

export function useStock() {
  const [sheets, setSheets] = useState<StockSheet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  const fetchSheets = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await pg("GET", "stock_sheets?select=*&order=created_at.desc");
      setSheets(Array.isArray(data) ? data.map(toSheet) : []);
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
      const result = await pg("POST", "stock_sheets", input);
      toast({ title: "Élément ajouté au stock" });
      await fetchSheets();
      return result && result[0] ? toSheet(result[0]) : null;
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

  /**
   * Mise à jour avec verrou optimiste : si `expectedUpdatedAt` est fourni et
   * qu'aucune ligne n'a été modifiée (conflit de concurrence), on lève
   * StockConflictError et on recharge l'état frais.
   */
  const updateSheet = async (
    id: string,
    patch: Partial<StockSheetInput>,
    expectedUpdatedAt?: string,
  ): Promise<void> => {
    try {
      let path = `stock_sheets?id=eq.${id}`;
      if (expectedUpdatedAt) {
        path += `&updated_at=eq.${encodeURIComponent(expectedUpdatedAt)}`;
      }
      const result = await pg("PATCH", path, patch);

      if (expectedUpdatedAt && (!result || result.length === 0)) {
        await fetchSheets();
        toast({
          title: "Modification concurrente détectée",
          description: "Cette feuille a été modifiée par quelqu'un d'autre. Recharge en cours.",
          variant: "destructive",
        });
        throw new StockConflictError();
      }

      await fetchSheets();
    } catch (err) {
      if (err instanceof StockConflictError) throw err;
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
      await pg("DELETE", `stock_sheets?id=eq.${id}`);
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
