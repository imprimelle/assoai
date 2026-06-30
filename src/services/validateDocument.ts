/**
 * validateDocument.ts — Garde-fous de dérivation
 * 
 * Vérifie qu'un document source (facture ou commande) contient
 * tous les champs obligatoires avant de permettre une dérivation.
 */

export interface ValidationResult {
  valid: boolean;
  reasons: string[];   // explications des blocages
  warnings: string[];  // avertissements non bloquants
}

/**
 * Valide une facture avant dérivation → Commande.
 * Champs obligatoires :
 * - client.nom, client.adresse, client.telephone
 * - statut = "Validée"
 * - Au moins 1 produit (details[].description non vide)
 */
export function validateFactureForDerivation(data: any): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Client
  const client = data?.client;
  if (!client?.nom?.trim()) {
    reasons.push('Nom du client manquant');
  }
  if (!client?.adresse?.trim()) {
    reasons.push('Adresse du client manquante');
  }
  if (!client?.telephone?.trim()) {
    reasons.push('Téléphone du client manquant');
  }

  // 2. Statut — doit être "Validée"
  const statut = (data?.statut || '').toLowerCase();
  if (statut !== 'validé' && statut !== 'validee' && statut !== 'validée') {
    reasons.push(`Statut invalide : "${data?.statut || 'non défini'}" — doit être "Validée"`);
  }

  // 3. Échéancier — doit être renseigné
  const echeancier = data?.echeancier;
  if (!echeancier || (typeof echeancier === 'string' && !echeancier.trim())) {
    reasons.push('Échéancier de paiement non renseigné');
  } else if (Array.isArray(echeancier) && echeancier.length === 0) {
    reasons.push('Échéancier de paiement vide');
  }

  // 4. Produits (details[])
  const details = data?.details;
  if (!details || !Array.isArray(details) || details.length === 0) {
    reasons.push('Aucun produit renseigné dans la facture');
  } else {
    const validProducts = details.filter((d: any) => d.description?.trim());
    if (validProducts.length === 0) {
      reasons.push('Aucun produit avec une description valide');
    }
  }

  // 5. Avertissements (non bloquants)
  if (data?.version === undefined) {
    warnings.push('Version non définie');
  }
  if (!data?.dateEmission) {
    warnings.push("Date d'émission non renseignée");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    warnings,
  };
}

/**
 * Valide une commande avant dérivation → CDC.
 * Champs obligatoires (en plus des champs facture) :
 * - deliveryAddress.label
 * - dateLivraison
 * - recu_image_url (reçu de paiement)
 * - items[] avec au moins 1 produit
 */
export function validateCommandeForDerivation(data: any): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // 1. Client (mêmes règles que facture)
  const client = data?.client;
  if (!client?.nom?.trim()) {
    reasons.push('Nom du client manquant');
  }
  if (!client?.adresse?.trim()) {
    reasons.push('Adresse du client manquante');
  }
  if (!client?.telephone?.trim()) {
    reasons.push('Téléphone du client manquant');
  }

  // 2. Statut — "Validée", "Confirmée" ou "En cours"
  const statut = (data?.statut || '').toLowerCase();
  if (statut !== 'validé' && statut !== 'validee' && statut !== 'validée' &&
      statut !== 'confirmé' && statut !== 'confirme' && statut !== 'confirmée' &&
      statut !== 'en cours') {
    reasons.push(`Statut invalide : "${data?.statut || 'non défini'}" — doit être "Validée", "Confirmée" ou "En cours"`);
  }

  // 3. Adresse de livraison
  if (!data?.deliveryAddress?.label?.trim()) {
    reasons.push('Adresse de livraison manquante');
  }

  // 4. Date de livraison
  if (!data?.dateLivraison?.trim()) {
    reasons.push('Date de livraison non renseignée');
  }

  // 5. Reçu de paiement
  if (!data?.recu_image_url?.trim()) {
    reasons.push('Reçu de paiement non renseigné');
  }

  // 6. Produits (items[])
  const items = data?.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    reasons.push('Aucun produit renseigné dans la commande');
  } else {
    const validItems = items.filter((i: any) => i.nom?.trim());
    if (validItems.length === 0) {
      reasons.push('Aucun produit avec un nom valide');
    }
    // Vérifier que chaque item a une image
    const itemsSansImage = items.filter((i: any) => i.nom?.trim() && !i.image_url?.trim());
    if (itemsSansImage.length > 0) {
      reasons.push(`${itemsSansImage.length} produit(s) sans image : ${itemsSansImage.map((i: any) => i.nom).join(', ')}`);
    }
  }

  // 7. Avertissements (non bloquants)
  if (data?.version === undefined) {
    warnings.push('Version non définie');
  }
  if (!data?.dateCommande) {
    warnings.push('Date de commande non renseignée');
  }
  if (!data?.linked_facture_id) {
    warnings.push('Non liée à une facture (linked_facture_id)');
  }

  return {
    valid: reasons.length === 0,
    reasons,
    warnings,
  };
}

/**
 * Formate un résultat de validation pour affichage.
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];
  
  if (result.valid) {
    lines.push('✅ Document valide pour dérivation');
    if (result.warnings.length > 0) {
      lines.push(...result.warnings.map(w => `  ⚠️ ${w}`));
    }
  } else {
    lines.push('🚫 Dérivation impossible :');
    lines.push(...result.reasons.map(r => `  ❌ ${r}`));
    if (result.warnings.length > 0) {
      lines.push(...result.warnings.map(w => `  ⚠️ ${w}`));
    }
  }
  
  return lines.join('\n');
}
