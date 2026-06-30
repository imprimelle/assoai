import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface DocumentLinkFABProps {
  onClick: () => void;
}

/**
 * Bouton flottant + pour lier une facture au projet.
 * Positionné en bas à droite de l'onglet Documents.
 */
export const DocumentLinkFAB: React.FC<DocumentLinkFABProps> = ({ onClick }) => {
  return (
    <Button
      onClick={onClick}
      size="icon"
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-brand-orange hover:bg-orange-600 text-white z-40"
      title="Lier une facture existante"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
};
