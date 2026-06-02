
import { supabase } from "./client";

/**
 * Active la réplication en temps réel pour une table spécifique dans Supabase
 */
export const enableRealtimeForTable = async (tableName: string): Promise<void> => {
  try {
    // On s'abonne aux changements de la table en Realtime
    supabase
      .channel(`public:${tableName}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => console.log(`Changement sur ${tableName}:`, payload)
      )
      .subscribe();
    console.log(`Réplication en temps réel activée pour la table ${tableName}`);
  } catch (error) {
    console.error(`Erreur lors de l'activation de la réplication en temps réel pour ${tableName}:`, error);
  }
};

/**
 * Initialise la réplication en temps réel pour les tables essentielles
 */
export const initializeRealtime = async (): Promise<void> => {
  // Activer la réplication en temps réel pour les tables principales
  await enableRealtimeForTable('messages');
  await enableRealtimeForTable('factures');
  await enableRealtimeForTable('commandes');
  await enableRealtimeForTable('cahiers_de_charge');
  await enableRealtimeForTable('notifications'); // Ajout de la table notifications
  await enableRealtimeForTable('projects'); // Ajout de la table projects
};
