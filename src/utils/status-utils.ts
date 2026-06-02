
import { StatusLineProps } from "@/components/ui/StatusLine";

/**
 * Fonction utilitaire partagée qui convertit un statut de document
 * en type de statut visuel pour le composant StatusLine
 */
export const getStatusLineState = (
  status: string
): StatusLineProps["status"] => {
  // Normalisation du statut (supprime les underscores, met en minuscule)
  const normalizedStatus = status?.toLowerCase().replace(/_/g, " ");
  
  switch (normalizedStatus) {
    // Succès
    case "vérifié":
    case "validé":
    case "payé":
    case "accepté":
    case "livrée":
    case "terminée":
    case "confirmée":
      return "success";

    // Brouillon
    case "brouillon":
      return "draft";

    // En cours / attente
    case "vérification":
    case "en cours":
    case "en attente":
    case "infographie":
    case "demande":
      return "loading";

    // Alerte/Avertissement
    case "expiré":
    case "refusé":
    case "expédiée":
      return "warning";
    
    // Erreur
    case "annulée":
      return "error";

    // Par défaut
    default:
      return "info";
  }
};
