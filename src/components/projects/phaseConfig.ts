/**
 * Configuration partagée des phases — utilisée par toutes les vues projet.
 * Couleurs cohérentes : liste, kanban, calendrier, maps.
 */
export const PHASE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string; hex: string }> = {
  'facturation': { color: 'text-blue-700', bg: 'bg-blue-50', label: 'Facturation', icon: '🔵', hex: '#2563EB' },
  'commande': { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Commande', icon: '🟠', hex: '#EA580C' },
  'fabrication': { color: 'text-purple-700', bg: 'bg-purple-50', label: 'Fabrication', icon: '🟣', hex: '#7C3AED' },
  'livraison': { color: 'text-green-700', bg: 'bg-green-50', label: 'Livraison', icon: '🟢', hex: '#16A34A' },
  'termine': { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Terminé', icon: '⚫', hex: '#6B7280' },
  'brouillon': { color: 'text-gray-400', bg: 'bg-gray-50', label: 'Brouillon', icon: '📝', hex: '#9CA3AF' },
};
