import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook pour enregistrer la dernière visite d'un utilisateur sur une page.
 * À appeler au montage de chaque page cible.
 */
export function usePageVisit() {
  const recordVisit = useCallback(async (userId: string, page: string) => {
    if (!userId || !page) return;

    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("user_page_visits")
        .upsert(
          {
            user_id: userId,
            page,
            last_visited_at: now,
          },
          { onConflict: "user_id,page" }
        );

      if (error) {
        console.warn("[usePageVisit] Failed to record visit:", error.message);
      }
    } catch (err) {
      // Silencieux — ne pas perturber l'UX
      console.warn("[usePageVisit] Error:", err);
    }
  }, []);

  return { recordVisit };
}
