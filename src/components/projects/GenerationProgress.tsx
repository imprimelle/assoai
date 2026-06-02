
import React from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, MessageCircle, X } from 'lucide-react';

interface GenerationProgressProps {
  isActive: boolean;
  elapsedMinutes: number;
  onCancel: () => void;
  onContinueInChat: () => void;
  contextInfo?: string;
}

const GenerationProgress: React.FC<GenerationProgressProps> = ({
  isActive,
  elapsedMinutes,
  onCancel,
  onContinueInChat,
  contextInfo
}) => {
  if (!isActive) return null;

  const maxMinutes = 30;
  const progressPercentage = Math.min((elapsedMinutes / maxMinutes) * 100, 100);
  const showChatFallback = elapsedMinutes >= 20;

  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-orange animate-pulse" />
          <span className="text-sm font-medium">
            Génération en cours{contextInfo ? ` (${contextInfo})` : ''}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Temps écoulé: {elapsedMinutes} min</span>
          <span>Max: {maxMinutes} min</span>
        </div>
        
        <Progress value={progressPercentage} className="h-2" />
        
        {elapsedMinutes >= 25 && (
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
            ⏰ Génération plus longue que prévu - presque terminé
          </div>
        )}
        
        {showChatFallback && (
          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={onContinueInChat}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Continuer dans le chat
            </Button>
            <span className="text-xs text-muted-foreground">
              Vous pouvez continuer cette génération dans le chat
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default GenerationProgress;
