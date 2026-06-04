// fabricationRules.ts — Base de connaissances pour l'agent Brico
// Règles de fabrication par type d'enseigne, extraites des workflows n8n (prod_cdc.json, asso_fab_copy.json)

export interface FabricationRule {
  type: string;
  description: string;
  materiaux: Array<{ nom: string; unite: string; usage: string }>;
  operations: string[];
  regles: string[];
  nomenclature: string;
}

export const FABRICATION_RULES: FabricationRule[] = [
  {
    type: "Caisson lumineux",
    description: "Structure aluminium avec face plexiglass/PVC, éclairage LED intégré",
    materiaux: [
      { nom: "Profilé aluminium 40x40mm", unite: "m", usage: "Cadre structurel" },
      { nom: "Plexiglass 3mm", unite: "m²", usage: "Face avant" },
      { nom: "Bande LED 12V blanc chaud", unite: "m", usage: "Éclairage intérieur" },
      { nom: "Alimentation LED 12V 150W", unite: "pièce", usage: "Alimentation" },
      { nom: "PVC expansé 3mm", unite: "m²", usage: "Fond optionnel" },
      { nom: "Vis inox M4", unite: "pièce", usage: "Fixation" },
    ],
    operations: [
      "Découpe profilé aluminium aux dimensions",
      "Assemblage cadre par équerrage",
      "Découpe plexiglass face avant",
      "Pose bande LED sur fond",
      "Câblage alimentation LED",
      "Fermeture face plexiglass",
      "Test étanchéité et éclairage",
    ],
    regles: [
      "Si largeur > 200cm → renfort central obligatoire",
      "Si hauteur > 150cm → 2 alimentations LED nécessaires",
      "Profondeur standard : 12cm (slim) ou 20cm (standard)",
      "Marge de 2cm pour le plexiglass (découpe 2cm plus petit que cadre)",
      "Étanchéité obligatoire pour usage extérieur (joint silicone)",
    ],
    nomenclature: "caissonLumineux_{Client}_{Matériau}_{Opération}_{Dimensions}",
  },
  {
    type: "Lettres découpées",
    description: "Lettres en PVC expansé ou aluminium composite, avec ou sans rétro-éclairage",
    materiaux: [
      { nom: "PVC expansé 10mm", unite: "m²", usage: "Corps de lettre" },
      { nom: "Aluminium composite 3mm", unite: "m²", usage: "Corps de lettre (option luxe)" },
      { nom: "Plexiglass dépoli 3mm", unite: "m²", usage: "Fond rétro-éclairé" },
      { nom: "Bande LED 12V", unite: "m", usage: "Rétro-éclairage" },
      { nom: "Colle néoprène", unite: "tube", usage: "Fixation murale" },
    ],
    operations: [
      "Création fichier vectoriel (dxf/ai)",
      "Découpe CNC des lettres",
      "Ponçage des bords",
      "Peinture/laquage si nécessaire",
      "Pose rétro-éclairage si demandé",
      "Fixation gabarit de pose",
      "Installation sur site",
    ],
    regles: [
      "Épaisseur minimum du trait : 2cm pour PVC, 1.5cm pour aluminium",
      "Hauteur minimum par lettre : 5cm",
      "Espacement entre lettres : 15% de la hauteur",
      "Rétro-éclairage : ajouter 3cm de profondeur",
      "Pour fixation extérieure : utiliser chevilles chimiques",
    ],
    nomenclature: "lettresDecoupees_{Client}_{Matériau}_{Opération}_{Dimensions}",
  },
  {
    type: "Néon flexible",
    description: "Support transparent ou opaque fraisé pour filaments LED flexibles",
    materiaux: [
      { nom: "Plexiglass transparent 5mm", unite: "m²", usage: "Support" },
      { nom: "Filament LED flexible 8mm", unite: "m", usage: "Éclairage (standard)" },
      { nom: "Filament LED flexible 12mm", unite: "m", usage: "Éclairage (haute densité)" },
      { nom: "Alimentation LED 12V", unite: "pièce", usage: "Alimentation" },
      { nom: "Contrôleur LED RGB", unite: "pièce", usage: "Si couleur variable" },
    ],
    operations: [
      "Création fichier de fraisage (dxf)",
      "Fraisage CNC du plexiglass",
      "Insertion filament LED dans les rainures",
      "Câblage et soudure des connexions",
      "Test d'allumage",
      "Fixation murale avec entretoises",
    ],
    regles: [
      "Profondeur de fraisage : 80% de l'épaisseur du support",
      "Largeur de rainure : diamètre LED + 1mm",
      "60 LED/mètre = standard, 120 LED/mètre = haute densité",
      "Rayon minimum de courbure : 3cm pour LED 8mm, 5cm pour LED 12mm",
      "Une alimentation par 10 mètres de LED maximum",
      "Contrôleur RGB obligatoire si couleurs multiples",
    ],
    nomenclature: "neonFlexible_{Client}_{Matériau}_{Opération}_{Dimensions}",
  },
  {
    type: "Dibond",
    description: "Impression numérique sur panneau aluminium composite",
    materiaux: [
      { nom: "Dibond 3mm", unite: "m²", usage: "Support" },
      { nom: "Vinyle adhésif imprimé", unite: "m²", usage: "Impression" },
      { nom: "Laminat protection UV", unite: "m²", usage: "Protection extérieure" },
      { nom: "Profilé aluminium de finition", unite: "m", usage: "Cadre optionnel" },
    ],
    operations: [
      "Préparation fichier d'impression (CMJN, 300dpi)",
      "Impression vinyle",
      "Laminage protection UV",
      "Contre-collage sur dibond",
      "Découpe au format",
      "Pose profilé de finition si demandé",
      "Fixation murale",
    ],
    regles: [
      "Format maximum standard : 150x300cm",
      "Marge de découpe : 5mm",
      "Résolution minimum : 150dpi à taille réelle",
      "Laminat UV obligatoire pour extérieur",
      "Délai de dégazage : 24h avant laminage",
    ],
    nomenclature: "dibond_{Client}_{Opération}_{Dimensions}",
  },
  {
    type: "Totem",
    description: "Structure autoportante avec éclairage intégré",
    materiaux: [
      { nom: "Profilé acier 60x60mm", unite: "m", usage: "Structure porteuse" },
      { nom: "Aluminium composite 3mm", unite: "m²", usage: "Habillage" },
      { nom: "Bande LED 12V", unite: "m", usage: "Éclairage" },
      { nom: "Alimentation LED 12V 200W", unite: "pièce", usage: "Alimentation" },
      { nom: "Béton pour fondation", unite: "sac", usage: "Socle" },
      { nom: "Vis inox M8", unite: "pièce", usage: "Fixation structure" },
    ],
    operations: [
      "Fouille et coulage fondation béton",
      "Montage structure acier",
      "Pose habillage aluminium",
      "Installation éclairage LED",
      "Câblage électrique (mise à la terre obligatoire)",
      "Pose panneaux décoratifs",
      "Test éclairage et stabilité",
    ],
    regles: [
      "Hauteur max standard : 4m (au-delà → étude structure)",
      "Fondation béton : 50x50x50cm minimum",
      "Mise à la terre obligatoire",
      "Résistance au vent : 120km/h minimum",
      "Trappe d'accès pour maintenance électrique",
      "Alimentation séparée pour chaque face éclairée",
    ],
    nomenclature: "totem_{Client}_{Opération}_{Dimensions}",
  },
  {
    type: "Panneau publicitaire",
    description: "Structure cadre avec bâche ou panneau imprimé",
    materiaux: [
      { nom: "Profilé aluminium 30x30mm", unite: "m", usage: "Cadre" },
      { nom: "Bâche PVC 500g/m²", unite: "m²", usage: "Impression" },
      { nom: "Œillets métalliques", unite: "pièce", usage: "Fixation bâche" },
      { nom: "Sangles de tension", unite: "pièce", usage: "Tension bâche" },
      { nom: "Chevilles à expansion", unite: "pièce", usage: "Fixation murale" },
    ],
    operations: [
      "Préparation fichier impression (CMJN, 150dpi)",
      "Impression bâche",
      "Soudure ourlet + pose œillets",
      "Assemblage cadre aluminium",
      "Fixation cadre au mur",
      "Tension et fixation bâche sur cadre",
    ],
    regles: [
      "Format max standard : 400x300cm",
      "Ourlet de 3cm pour soudure périphérique",
      "Œillets tous les 50cm",
      "Bâche 500g/m² minimum pour extérieur",
      "Cadre : ajouter 5cm de marge de chaque côté",
    ],
    nomenclature: "panneauPub_{Client}_{Opération}_{Dimensions}",
  },
];

// Recherche de règles par type d'enseigne (insensible à la casse)
export function getFabricationRule(typeEnseigne: string): FabricationRule | null {
  const query = typeEnseigne.toLowerCase().trim();
  return FABRICATION_RULES.find(
    r => r.type.toLowerCase().includes(query) || query.includes(r.type.toLowerCase())
  ) || null;
}

// Liste des types disponibles
export function getAvailableTypes(): string[] {
  return FABRICATION_RULES.map(r => r.type);
}
