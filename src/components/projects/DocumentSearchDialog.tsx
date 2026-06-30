import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, FileText } from 'lucide-react';
import { useDocumentSearch, type DocumentSearchResult } from '@/hooks/useDocumentSearch';

interface DocumentSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (doc: DocumentSearchResult) => void;
}

/**
 * Dialogue de recherche de facture existante.
 * L'utilisateur tape un nom/numéro → suggestions → sélection.
 */
export const DocumentSearchDialog: React.FC<DocumentSearchDialogProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const { data: results, isLoading } = useDocumentSearch(query);

  const handleSelect = (doc: DocumentSearchResult) => {
    onSelect(doc);
    setQuery('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Lier une facture existante
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <Input
            placeholder="Rechercher par numéro, client ou montant..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          {isLoading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && query.length >= 2 && results && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune facture trouvée pour « {query} »
            </p>
          )}

          {results && results.length > 0 && (
          <ScrollArea className="max-h-[300px]">
          <div className="space-y-2 pr-1">
            {results.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors ${
                  doc.projectId ? 'border-amber-200 bg-amber-50/30' : ''
                }`}
                onClick={() => handleSelect(doc)}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className={`h-5 w-5 shrink-0 ${doc.projectId ? 'text-amber-500' : 'text-blue-500'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm font-semibold text-blue-700">{doc.numero}</p>
                      {doc.projectId && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          Déjà liée
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{doc.client || 'Client inconnu'}</p>
                  </div>
                </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold">{doc.montant.toLocaleString()} FCFA</p>
                      <p className="text-[10px] text-muted-foreground">
                        {doc.date ? new Date(doc.date).toLocaleDateString('fr') : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
