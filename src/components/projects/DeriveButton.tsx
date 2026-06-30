import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Check, RefreshCw } from 'lucide-react';

interface DeriveButtonProps {
  label: string;
  onDerive: () => void;
  isLoading: boolean;
  isDone: boolean;
  error?: string | null;
  onReset?: () => void; // Bug 8 : permettre de re-dériver
}

/**
 * Bouton + qui déclenche une dérivation.
 * États : idle (+), loading (spinner), done (✓), error (message).
 */
export const DeriveButton: React.FC<DeriveButtonProps> = ({
  label,
  onDerive,
  isLoading,
  isDone,
  error,
  onReset,
}) => {
  return (
    <div className="flex flex-col items-center gap-1 py-4">
      {isDone ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            <span className="text-sm font-medium">Généré</span>
          </div>
          {onReset && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-7"
              onClick={(e) => { e.stopPropagation(); onReset(); }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Regénérer
            </Button>
          )}
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-dashed hover:border-solid"
          onClick={onDerive}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {isLoading ? 'Génération...' : label}
        </Button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};
