
import type { CahierDesChargesData, Enseigne } from "@/types";

/**
 * Migre les anciennes données de cahier des charges vers le nouveau format multi-enseignes
 */
export function migrateCahierDesCharges(data: CahierDesChargesData): CahierDesChargesData {
  // Si les enseignes existent déjà, pas de migration nécessaire
  if (data.enseignes && data.enseignes.length > 0) {
    return data;
  }

  // Créer une enseigne par défaut avec les données legacy
  const defaultEnseigne: Enseigne = {
    id: "enseigne-default",
    nom: "Enseigne principale",
    produits: [],
    details: {
      image_url: data.image_url,
      dimensions: data.dimensions || { largeur: 0, hauteur: 0 },
      technique: data.technique || { type_structure: "", method_fabrication: "" }
    },
    materiauxSections: data.materiauxSections || {}
  };

  return {
    ...data,
    enseignes: [defaultEnseigne],
    // Conserver les données legacy pour compatibilité
    materiauxSections: data.materiauxSections,
    dimensions: data.dimensions,
    technique: data.technique,
    image_url: data.image_url
  };
}

/**
 * Vérifie si un cahier des charges utilise l'ancien format
 */
export function isLegacyFormat(data: CahierDesChargesData): boolean {
  return !data.enseignes || data.enseignes.length === 0;
}

/**
 * Extrait tous les matériaux de toutes les enseignes
 */
export function getAllMaterialsFromEnseignes(enseignes: Enseigne[]): Record<string, any[]> {
  const allMaterials: Record<string, any[]> = {};
  
  enseignes.forEach(enseigne => {
    if (enseigne.materiauxSections) {
      Object.entries(enseigne.materiauxSections).forEach(([section, items]) => {
        if (!allMaterials[section]) {
          allMaterials[section] = [];
        }
        // Ajouter l'ID de l'enseigne à chaque matériau pour le traçage
        const itemsWithEnseigne = items.map(item => ({
          ...item,
          enseigne_id: enseigne.id,
          enseigne_nom: enseigne.nom
        }));
        allMaterials[section].push(...itemsWithEnseigne);
      });
    }
  });
  
  return allMaterials;
}
