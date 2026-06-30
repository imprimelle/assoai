import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Unlink, RefreshCw, AlertTriangle, Download } from 'lucide-react';

interface TemplateMiniCardProps {
  numero: string;
  client: string;
  montant: number;
  version: number;
  date?: string;
  onClick?: () => void;
  // Actions
  onDetach?: () => void;
  onRegenerate?: () => void;
  onDownload?: () => void;
  // Garde-fou
  validationErrors?: string[];
  /** Message affiché sous le client quand le document est en lecture seule */
  lockedHint?: string;
}

/**
 * Carte miniature réutilisable pour afficher un document
 * (facture, commande, CDC) dans l'accordéon projet.
 * Supporte les boutons Détacher et Régénérer.
 */
export const TemplateMiniCard: React.FC<TemplateMiniCardProps> = ({
  numero,
  client,
  montant,
  version,
  date,
  onClick,
  onDetach,
  onRegenerate,
  onDownload,
  validationErrors,
  lockedHint,
}) => {
  const isFacture = numero.startsWith('F-');
  const isCommande = numero.startsWith('CMD-');
  const isCDC = numero.startsWith('CDC-');

  const icon = isFacture ? '🔵' : isCommande ? '🟠' : isCDC ? '🟣' : '📄';
  const color = isFacture ? 'text-blue-700' : isCommande ? 'text-orange-700' : isCDC ? 'text-purple-700' : 'text-gray-700';
  const bg = isFacture ? 'bg-blue-50' : isCommande ? 'bg-orange-50' : isCDC ? 'bg-purple-50' : 'bg-gray-50';
  const hasValidationErrors = validationErrors && validationErrors.length > 0;
  const isLocked = !!lockedHint;

  return (
    <div className="space-y-2">
      {/* Carte principale */}
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-lg border ${bg} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${hasValidationErrors ? 'border-amber-400' : ''}`}
        onClick={onClick}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{isLocked ? '🔒' : icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-semibold ${color}`}>{numero}</span>
              <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">v{version}</Badge>
              {isLocked && (
                <span className="text-[10px] text-amber-600 font-medium" title="Lecture seule">🔒</span>
              )}
              {hasValidationErrors && (
                <span title="Données incomplètes">
                  <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{client || '—'}</p>
            {lockedHint && (
              <p className="text-[10px] text-amber-600 mt-0.5">{lockedHint}</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right ml-3">
          <p className="text-sm font-semibold">{montant > 0 ? `${montant.toLocaleString()} FCFA` : ''}</p>
          {date && <p className="text-[10px] text-muted-foreground">{new Date(date).toLocaleDateString('fr')}</p>}
        </div>
      </div>

      {/* Boutons d'action */}
      {(onDetach || onRegenerate || onDownload) && (
        <div className="flex items-center gap-2">
          {onDownload && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 gap-1"
              onClick={(e) => { e.stopPropagation(); onDownload(); }}
            >
              <Download className="h-3 w-3" />
              PDF
            </Button>
          )}
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-orange-600 gap-1"
              onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
            >
              <RefreshCw className="h-3 w-3" />
              Régénérer
            </Button>
          )}
          {onDetach && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-red-600 gap-1"
              onClick={(e) => { e.stopPropagation(); onDetach(); }}
            >
              <Unlink className="h-3 w-3" />
              Détacher
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
