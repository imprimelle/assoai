
/**
 * Formate un montant en CFA sans décimales avec séparateur d'espaces pour les milliers
 * @param amount Le montant à formater
 * @returns Le montant formaté (ex: "1 234 567 CFA")
 */
export function formatCFA(amount: number | undefined | null): string {
  // Utilisation de toLocaleString avec fr-FR pour avoir des espaces comme séparateurs de milliers
  // et maximumFractionDigits: 0 pour supprimer les décimales
  return (amount ?? 0)
    .toLocaleString("fr-FR", { maximumFractionDigits: 0 })
    + " CFA"; // Ajout du symbole CFA
}

/**
 * Formate une date au format français
 * @param date La date à formater (string ou Date)
 * @returns La date formatée (ex: "25 décembre 2023")
 */
export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}
