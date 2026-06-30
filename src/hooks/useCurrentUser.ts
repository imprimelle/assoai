import { useMemo } from "react";
import type { User } from "@/types";

/**
 * Récupère l'utilisateur courant depuis localStorage.
 * À utiliser dans les pages qui ne reçoivent pas `user` en props.
 */
export function useCurrentUser(): User | null {
  return useMemo(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, []);
}
