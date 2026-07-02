import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@/types";

export interface HomeCounters {
  finances: number;   // Demandes non-répondues (envoyées au directeur)
  demandes: number;   // Demandes payées depuis la dernière visite
  monBara: number;    // Checklists "À faire"
  projets: number;     // Projets non initialisés
}

/**
 * Rôles privilégiés qui voient TOUTES les données (pas de filtre par utilisateur)
 */
const PRIVILEGED_ROLES = ["directeur", "directrice_adjointe"];

/**
 * Hook qui calcule les compteurs pour la page d'accueil.
 * Chaque compteur est contextuel à l'utilisateur actif et filtré
 * par rapport à sa dernière visite sur la page concernée.
 */
export function useHomeCounters(user: User | null) {
  return useQuery({
    queryKey: ["homeCounters", user?.id, user?.role],
    queryFn: async (): Promise<HomeCounters> => {
      if (!user) return { finances: 0, demandes: 0, monBara: 0, projets: 0 };

      const [
        financesCount,
        demandesCount,
        monBaraCount,
        projetsCount,
      ] = await Promise.all([
        fetchFinancesCounter(user),
        fetchDemandesCounter(user),
        fetchMonBaraCounter(user),
        fetchProjetsCounter(user),
      ]);

      return {
        finances: financesCount,
        demandes: demandesCount,
        monBara: monBaraCount,
        projets: projetsCount,
      };
    },
    enabled: !!user,
    refetchInterval: 15_000, // Rafraîchir toutes les 15 secondes
    staleTime: 10_000,
  });
}

/**
 * Compteur Finances : nombre de demandes "envoyées" (non-répondues)
 * Pour directeur/adjointe : toutes les demandes envoyées
 * Depuis la dernière visite de la page Finances
 */
async function fetchFinancesCounter(user: User): Promise<number> {
  // Récupérer la dernière visite
  const lastVisit = await getLastVisit(user.id, "finances");

  let query = supabase
    .from("demandes")
    .select("id", { count: "exact", head: true })
    .eq("status", "envoye");

  // Filtre par date de création > dernière visite
  if (lastVisit) {
    query = query.gt("created_at", lastVisit);
  }

  const { count, error } = await query;
  if (error) {
    console.warn("[useHomeCounters] finances:", error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Compteur Demandes : nombre de demandes "payées" pour cet utilisateur
 * Depuis sa dernière visite de la page Demandes
 */
async function fetchDemandesCounter(user: User): Promise<number> {
  const lastVisit = await getLastVisit(user.id, "demandes");

  let query = supabase
    .from("demandes")
    .select("id", { count: "exact", head: true })
    .eq("status", "paye")
    .eq("applicant_name", user.name);

  if (lastVisit) {
    query = query.gt("updated_at", lastVisit);
  }

  const { count, error } = await query;
  if (error) {
    console.warn("[useHomeCounters] demandes:", error.message);
    return 0;
  }
  return count || 0;
}

/**
 * Compteur Mon Bara : nombre de checklists "À faire"
 * Filtre par rôle : pour directeur/adjointe → toutes, sinon par assignee = role
 */
async function fetchMonBaraCounter(user: User): Promise<number> {
  // Utiliser la même logique que PublicChecklists.tsx
  // 🔴 PAS de head:true ici : PostgREST ignore les filtres sur colonnes
  //    embarquées (!inner) quand head=true est utilisé → le count est global
  let query = supabase
    .from("checklists")
    .select("id, project_tasks!inner(kanban_column,active,assignee)")
    .not("task_id", "is", null)
    .eq("project_tasks.kanban_column", "a_faire")
    .eq("project_tasks.active", true);

  // Filtrer par assignee selon le rôle
  if (!PRIVILEGED_ROLES.includes(user.role)) {
    query = query.eq("project_tasks.assignee", user.role);
  }

  const { data, error } = await query;
  if (error) {
    console.warn("[useHomeCounters] monBara:", error.message);
    return 0;
  }
  return (data || []).length;
}

/**
 * Compteur Projets : nombre de projets sans aucune tâche (non initialisés)
 * Les projets qui n'ont pas encore de project_tasks sont considérés non initialisés
 */
async function fetchProjetsCounter(user: User): Promise<number> {
  // Stratégie : compter les projets qui n'ont aucune entrée dans project_tasks
  // Utiliser un LEFT JOIN + IS NULL

  // On utilise une approche en deux étapes :
  // 1. Récupérer tous les IDs de projets qui ont des tâches
  const { data: projectsWithTasks, error: err1 } = await supabase
    .from("project_tasks")
    .select("project_id");

  if (err1) {
    console.warn("[useHomeCounters] projets err1:", err1.message);
    return 0;
  }

  const projectIdsWithTasks = new Set(
    (projectsWithTasks || []).map((t: any) => t.project_id)
  );

  // 2. Compter les projets qui ne sont PAS dans cette liste
  let query = supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  // Pour les rôles non privilégiés, filtrer par created_by
  if (!PRIVILEGED_ROLES.includes(user.role)) {
    query = query.eq("created_by", user.id);
  }

  const { data: allProjects, error: err2 } = await query;

  if (err2) {
    console.warn("[useHomeCounters] projets err2:", err2.message);
    return 0;
  }

  // Filtrer côté client : ne garder que ceux sans tâches
  const nonInitialized = (allProjects || []).filter(
    (p: any) => !projectIdsWithTasks.has(p.id)
  );

  return nonInitialized.length;
}

/**
 * Récupère la dernière visite d'un utilisateur sur une page donnée.
 */
async function getLastVisit(
  userId: string,
  page: string
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("user_page_visits")
      .select("last_visited_at")
      .eq("user_id", userId)
      .eq("page", page)
      .single();

    if (error || !data) return null;
    return data.last_visited_at;
  } catch {
    return null;
  }
}
