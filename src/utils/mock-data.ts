
import { TemplateType, TemplateData, DetailItem } from "@/types";

/**
 * Génère des données de template fictives pour le développement et les tests
 */
export const generateMockTemplateData = (templateType: TemplateType): TemplateData => {
  const currentDate = new Date().toISOString();
  
  switch (templateType) {
    case "facture":
      return {
        factureNumero: `FAC-${Date.now().toString().substring(8)}`,
        dateEmission: currentDate,
        client: { 
          nom: "Client Exemple", 
          adresse: "123 Rue des Exemples\n75000 Paris" 
        },
        details: [
          {
            id: crypto.randomUUID(),
            description: "Prestation de service",
            quantite: 1,
            prixUnitaire: 100,
            sous_total: 100
          }
        ],
        total: 100,
        contact: "+33 1 23 45 67 89",
        version: 1,
        is_latest: true
      };
      
    case "devis":
      return {
        devisNumero: `DEV-${Date.now().toString().substring(8)}`,
        dateEmission: currentDate,
        validiteJours: 30,
        client: { 
          nom: "Prospect Exemple", 
          adresse: "456 Avenue des Tests\n69000 Lyon" 
        },
        details: [
          {
            id: crypto.randomUUID(),
            description: "Proposition de service",
            quantite: 1,
            prixUnitaire: 150,
            sous_total: 150
          }
        ],
        total: 150,
        version: 1,
        is_latest: true
      };
      
    case "commande":
      return {
        commandeNumero: `CMD-${Date.now().toString().substring(8)}`,
        dateCommande: currentDate,
        dateEmission: currentDate,
        client: { 
          nom: "Acheteur Exemple", 
          adresse: "789 Boulevard des Commandes\n33000 Bordeaux" 
        },
        statut: "en_attente",
        items: [
          {
            id: crypto.randomUUID(),
            nom: "Produit commandé",
            quantite: 2,
            prixUnitaire: 25,
            sous_total: 50,
          }
        ],
        details: [],
        total: 50,
        version: 1,
        is_latest: true
      };
      
    case "cahier_des_charges":
      return {
        titre: "Spécifications du projet",
        commande_id: `CMD-${Date.now().toString().substring(8)}`,
        materiaux: [
          {
            id: crypto.randomUUID(),
            nom: "Matériau exemple",
            quantite: 10,
            unite: "unités",
            dimension: "10x20cm",
            largeur: 10,
            hauteur: 20,
            reference: "MAT-001",
            image_url: undefined
          }
        ],
        dimensions: {
          largeur: 100,
          hauteur: 50,
          profondeur: 25
        },
        technique: {
          type_structure: "Type A",
          method_fabrication: "Méthode X"
        },
        equipe: [
          {
            id: crypto.randomUUID(),
            nom: "Chef de Projet",
            role: "Manager"
          }
        ],
        version: 1,
        is_latest: true
      };
      
    default:
      // Par défaut, retourner un template facture vide
      return {
        factureNumero: "",
        dateEmission: currentDate,
        client: { nom: "", adresse: "" },
        details: [],
        total: 0,
        version: 1,
        is_latest: true
      };
  }
};
