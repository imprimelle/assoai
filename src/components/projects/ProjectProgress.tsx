import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProjectProgressProps {
  /** Pourcentage global (0-100) */
  percentage: number;
  /** Score de santé (0-100, optionnel) */
  healthScore?: number;
  /** Détail par catégorie */
  details?: {
    label: string;
    done: number;
    total: number;
    icon?: string;
  }[];
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'bg-green-500';
  if (score >= 50) return 'bg-orange-400';
  return 'bg-red-500';
};

const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Bon';
  if (score >= 40) return 'Moyen';
  if (score >= 20) return 'Faible';
  return 'Critique';
};

const getScoreBadgeVariant = (score: number) => {
  if (score >= 60) return 'default' as const;
  if (score >= 40) return 'secondary' as const;
  return 'destructive' as const;
};

export const ProjectProgress: React.FC<ProjectProgressProps> = ({
  percentage,
  healthScore,
  details,
  className,
  size = 'md',
}) => {
  const progressColor = healthScore !== undefined
    ? getScoreColor(healthScore)
    : percentage >= 80
      ? 'bg-green-500'
      : percentage >= 50
        ? 'bg-orange-400'
        : 'bg-red-500';

  return (
    <div className={cn('space-y-3', className)}>
      {/* Barre principale */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <Progress
            value={percentage}
            className={cn(SIZE_CLASSES[size], '[&>div]:transition-all [&>div]:duration-500')}
            style={{ ['--progress-color' as string]: progressColor } as React.CSSProperties}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums">{percentage}%</span>
          {healthScore !== undefined && (
            <Badge variant={getScoreBadgeVariant(healthScore)} className="text-xs">
              Score {healthScore}
            </Badge>
          )}
        </div>
      </div>

      {/* Détail par catégorie */}
      {details && details.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {details.map((detail) => (
            <div
              key={detail.label}
              className="bg-gray-50 rounded-md px-3 py-2 flex items-center gap-2"
            >
              {detail.icon && <span className="text-sm">{detail.icon}</span>}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{detail.label}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Progress
                    value={detail.total > 0 ? Math.round((detail.done / detail.total) * 100) : 0}
                    className="h-1 flex-1"
                  />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {detail.done}/{detail.total}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Label de santé */}
      {healthScore !== undefined && (
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', getScoreColor(healthScore))} />
          <span className="text-xs text-muted-foreground">
            Santé projet : {getScoreLabel(healthScore)}
          </span>
        </div>
      )}
    </div>
  );
};
