import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter, SlidersHorizontal, X, ArrowUpDown } from 'lucide-react';
import { PHASE_CONFIG } from './phaseConfig';
import { cn } from '@/lib/utils';

export type ProjectSortOption =
  | 'name-asc'
  | 'name-desc'
  | 'date-asc'
  | 'date-desc'
  | 'livraison-asc'
  | 'livraison-desc'
  | 'health-desc'
  | 'health-asc'
  | 'docs-desc'
  | 'docs-asc';

export interface ProjectFilters {
  phases: string[];
  sort: ProjectSortOption;
}

const PHASES = [
  { key: 'brouillon', label: 'Brouillon' },
  { key: 'facturation', label: 'Facturation' },
  { key: 'commande', label: 'Commande' },
  { key: 'fabrication', label: 'Fabrication' },
  { key: 'livraison', label: 'Livraison' },
  { key: 'termine', label: 'Terminé' },
];

const SORT_LABELS: Record<ProjectSortOption, string> = {
  'name-asc': 'Nom A→Z',
  'name-desc': 'Nom Z→A',
  'date-asc': 'Date création ↑',
  'date-desc': 'Date création ↓',
  'livraison-asc': 'Livraison ↑',
  'livraison-desc': 'Livraison ↓',
  'health-desc': 'Santé ↓',
  'health-asc': 'Santé ↑',
  'docs-desc': 'Documents ↓',
  'docs-asc': 'Documents ↑',
};

interface ProjectFilterBarProps {
  filters: ProjectFilters;
  onChange: (filters: ProjectFilters) => void;
  activeCount?: number;
  totalCount?: number;
}

export const ProjectFilterBar: React.FC<ProjectFilterBarProps> = ({
  filters,
  onChange,
  activeCount,
  totalCount,
}) => {
  const [phaseOpen, setPhaseOpen] = useState(false);

  const activePhaseCount = filters.phases.length;
  const hasFilters = activePhaseCount > 0 || filters.sort !== 'date-desc';

  const togglePhase = (phase: string) => {
    const next = filters.phases.includes(phase)
      ? filters.phases.filter(p => p !== phase)
      : [...filters.phases, phase];
    onChange({ ...filters, phases: next });
  };

  const clearFilters = () => {
    onChange({ phases: [], sort: 'date-desc' });
  };

  const getActiveSortLabel = () => {
    const label = SORT_LABELS[filters.sort] || 'Date création ↓';
    return label;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Filtre phases */}
      <Popover open={phaseOpen} onOpenChange={setPhaseOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={activePhaseCount > 0 ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs transition-all',
              activePhaseCount > 0 && 'ring-2 ring-brand-orange/20'
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Phase
            {activePhaseCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
                {activePhaseCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="space-y-0.5">
            {PHASES.map(({ key, label }) => {
              const cfg = PHASE_CONFIG[key];
              return (
                <label
                  key={key}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-muted/60',
                    filters.phases.includes(key) && 'bg-muted/40'
                  )}
                >
                  <Checkbox
                    checked={filters.phases.includes(key)}
                    onCheckedChange={() => togglePhase(key)}
                    className="h-3.5 w-3.5"
                  />
                  <span className="text-xs">{cfg?.icon}</span>
                  <span className="text-xs font-medium flex-1">{label}</span>
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg?.hex || '#9CA3AF' }}
                  />
                </label>
              );
            })}
          </div>
          {activePhaseCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1 h-7 text-xs text-muted-foreground"
              onClick={() => onChange({ ...filters, phases: [] })}
            >
              <X className="h-3 w-3 mr-1" /> Effacer
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {/* Tri */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={filters.sort !== 'date-desc' ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'h-8 gap-1.5 text-xs transition-all',
              filters.sort !== 'date-desc' && 'ring-2 ring-brand-orange/20'
            )}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="max-w-[110px] truncate">{getActiveSortLabel()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Nom
          </div>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'name-asc' })}
          >
            <span className={filters.sort === 'name-asc' ? 'font-semibold text-brand-orange' : ''}>
              Nom A→Z
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'name-desc' })}
          >
            <span className={filters.sort === 'name-desc' ? 'font-semibold text-brand-orange' : ''}>
              Nom Z→A
            </span>
          </DropdownMenuItem>
          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Date
          </div>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'date-asc' })}
          >
            <span className={filters.sort === 'date-asc' ? 'font-semibold text-brand-orange' : ''}>
              Date création ↑
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'date-desc' })}
          >
            <span className={filters.sort === 'date-desc' ? 'font-semibold text-brand-orange' : ''}>
              Date création ↓
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'livraison-asc' })}
          >
            <span className={filters.sort === 'livraison-asc' ? 'font-semibold text-brand-orange' : ''}>
              Livraison ↑
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'livraison-desc' })}
          >
            <span className={filters.sort === 'livraison-desc' ? 'font-semibold text-brand-orange' : ''}>
              Livraison ↓
            </span>
          </DropdownMenuItem>
          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
            Progression
          </div>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'health-desc' })}
          >
            <span className={filters.sort === 'health-desc' ? 'font-semibold text-brand-orange' : ''}>
              Santé ↓
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'health-asc' })}
          >
            <span className={filters.sort === 'health-asc' ? 'font-semibold text-brand-orange' : ''}>
              Santé ↑
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'docs-desc' })}
          >
            <span className={filters.sort === 'docs-desc' ? 'font-semibold text-brand-orange' : ''}>
              Documents ↓
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs h-8"
            onClick={() => onChange({ ...filters, sort: 'docs-asc' })}
          >
            <span className={filters.sort === 'docs-asc' ? 'font-semibold text-brand-orange' : ''}>
              Documents ↑
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Pilules des phases actives */}
      {filters.phases.map(phase => {
        const cfg = PHASE_CONFIG[phase];
        return (
          <Badge
            key={phase}
            variant="outline"
            className={cn(
              'h-6 gap-1 text-[10px] pl-1.5 pr-1 cursor-pointer transition-all hover:ring-1 hover:ring-destructive/30',
              cfg?.color, cfg?.bg, 'border-0'
            )}
            onClick={() => togglePhase(phase)}
          >
            {cfg?.icon} {cfg?.label}
            <X className="h-3 w-3 ml-0.5 opacity-50" />
          </Badge>
        );
      })}

      {/* Effacer tout */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-[10px] text-muted-foreground hover:text-destructive gap-1"
          onClick={clearFilters}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Effacer les filtres
        </Button>
      )}

      {/* Compteur */}
      {totalCount !== undefined && (
        <span className="text-xs text-muted-foreground ml-auto">
          {activeCount !== undefined && activeCount !== totalCount ? (
            <>{activeCount} / {totalCount} projet{totalCount !== 1 ? 's' : ''}</>
          ) : (
            <>{totalCount} projet{totalCount !== 1 ? 's' : ''}</>
          )}
        </span>
      )}
    </div>
  );
};
