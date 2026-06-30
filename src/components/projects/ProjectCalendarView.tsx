import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Project } from '@/types/project';
import { PHASE_CONFIG } from './phaseConfig';
import { format, differenceInDays, startOfMonth, endOfMonth, addMonths, eachMonthOfInterval, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { CalendarDays, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────

type Granularity = 'month' | 'week' | 'quarter';

interface ProjectCalendarViewProps {
  projects: Project[];
  initDates: Map<string, Date | null>;
}

interface TimelineProject {
  project: Project;
  phaseHex: string;
  phaseIcon: string;
  phaseLabel: string;
  initDate: Date | null;
  endDate: Date | null;
  isLate: boolean;
  daysTotal: number | null;
  daysElapsed: number | null;
}

// ─── Constantes de layout ────────────────────────────────

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 60;
const LEFT_LABEL_WIDTH = 150;
const RIGHT_PAD = 40;

const COL_WIDTH: Record<Granularity, number> = { month: 90, week: 50, quarter: 70 };
const DAY_STEPS: Record<Granularity, number[]> = {
  month: [1, 10, 20],
  week: [1, 4],
  quarter: [1, 15],
};

// ─── Helpers calendaires ─────────────────────────────────

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const out = new Date(d);
  out.setDate(diff);
  out.setHours(0, 0, 0, 0);
  return out;
}

function startOfQuarter(d: Date): Date {
  const quarter = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), quarter * 3, 1);
}

function getColumns(granularity: Granularity, minDate: Date, maxDate: Date): Date[] {
  const cols: Date[] = [];
  if (granularity === 'month') {
    return eachMonthOfInterval({ start: minDate, end: maxDate });
  }
  if (granularity === 'week') {
    let current = startOfWeek(minDate);
    while (current <= maxDate) {
      cols.push(new Date(current));
      current.setDate(current.getDate() + 7);
    }
    return cols;
  }
  // quarter
  let current = startOfQuarter(minDate);
  while (current <= maxDate) {
    cols.push(new Date(current));
    current.setMonth(current.getMonth() + 3);
  }
  return cols;
}

function getColumnEnd(col: Date, granularity: Granularity): Date {
  if (granularity === 'month') return endOfMonth(col);
  if (granularity === 'week') {
    const end = new Date(col);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }
  // quarter
  const end = new Date(col);
  end.setMonth(end.getMonth() + 3);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getColumnLabel(col: Date, granularity: Granularity): { main: string; sub: string } {
  if (granularity === 'month') {
    return {
      main: format(col, 'MMMM', { locale: fr }).toUpperCase(),
      sub: format(col, 'yyyy'),
    };
  }
  if (granularity === 'week') {
    const end = new Date(col);
    end.setDate(end.getDate() + 6);
    return {
      main: `S${Math.ceil(col.getDate() / 7) || 1}`,
      sub: format(col, 'MMM', { locale: fr }).toUpperCase(),
    };
  }
  // quarter
  const q = Math.floor(col.getMonth() / 3) + 1;
  return {
    main: `T${q}`,
    sub: format(col, 'yyyy'),
  };
}

function isCurrentColumn(col: Date, granularity: Granularity, now: Date): boolean {
  if (granularity === 'month') {
    return col.getMonth() === now.getMonth() && col.getFullYear() === now.getFullYear();
  }
  if (granularity === 'week') {
    const weekEnd = new Date(col);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return now >= col && now <= weekEnd;
  }
  // quarter
  const qEnd = new Date(col);
  qEnd.setMonth(qEnd.getMonth() + 3);
  return now >= col && now < qEnd;
}

// ─── Composant ───────────────────────────────────────────

export const ProjectCalendarView: React.FC<ProjectCalendarViewProps> = ({ projects, initDates }) => {
  const navigate = useNavigate();

  // ═══ TOUS LES HOOKS EN PREMIER (règle React #310) ══════

  const now = useMemo(() => new Date(), []);
  const [monthOffset, setMonthOffset] = useState(0);
  const [granularity, setGranularity] = useState<Granularity>('month');

  const scrollToToday = useCallback(() => setMonthOffset(0), []);

  const timeline: TimelineProject[] = useMemo(() => {
    const items: TimelineProject[] = [];

    projects.forEach(p => {
      const cfg = PHASE_CONFIG[p.phase || 'facturation'] || PHASE_CONFIG['facturation'];
      const initDate = initDates.get(p.id) || null;
      const endDate = p.date_livraison ? new Date(p.date_livraison) : null;
      const isLate = endDate ? endDate < now && p.phase !== 'termine' : false;

      let daysTotal: number | null = null;
      let daysElapsed: number | null = null;
      if (initDate && endDate) {
        // 🔧 Protection : si endDate < initDate, on ajuste
        const effectiveEnd = endDate < initDate ? now : endDate;
        daysTotal = differenceInDays(effectiveEnd, initDate);
        daysElapsed = differenceInDays(now, initDate);
      }

      items.push({
        project: p,
        phaseHex: cfg.hex,
        phaseIcon: cfg.icon,
        phaseLabel: cfg.label,
        initDate,
        endDate,
        isLate,
        daysTotal,
        daysElapsed,
      });
    });

    items.sort((a, b) => {
      if (!a.initDate && !b.initDate) return 0;
      if (!a.initDate) return 1;
      if (!b.initDate) return -1;
      return a.initDate.getTime() - b.initDate.getTime();
    });

    return items;
  }, [projects, initDates]);

  // ═══ Valeurs dérivées (pas de hooks) ══════

  const allDates = timeline.flatMap(t =>
    [t.initDate, t.endDate].filter(Boolean) as Date[]
  );

  // ═══ État vide — return APRÈS tous les hooks ══════

  if (allDates.length === 0) {
    return (
      <div className="text-center py-16">
        <CalendarDays className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
        <p className="text-muted-foreground text-lg mb-2">Aucune donnée temporelle</p>
        <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
          Les projets doivent être initialisés (tâches créées) et avoir une date de livraison pour apparaître sur la timeline.
        </p>
      </div>
    );
  }

  // ═══ Calculs de la timeline ══════

  const colWidth = COL_WIDTH[granularity];
  const baseMinDate = startOfMonth(subMonths(new Date(Math.min(...allDates.map(d => d.getTime()))), 1));
  const baseMaxDate = endOfMonth(addMonths(new Date(Math.max(...allDates.map(d => d.getTime()), now.getTime())), 1));

  const minDate = addMonths(baseMinDate, monthOffset);
  const maxDate = addMonths(baseMaxDate, monthOffset);

  const columns = getColumns(granularity, minDate, maxDate);
  const totalDays = Math.max(differenceInDays(maxDate, minDate), 1);
  const chartStartX = LEFT_LABEL_WIDTH;
  const totalColWidth = columns.length * colWidth;
  const svgWidth = chartStartX + totalColWidth + RIGHT_PAD;
  const svgHeight = HEADER_HEIGHT + timeline.length * ROW_HEIGHT + 40;

  const canScrollLeft = monthOffset < 0;

  function dateToX(date: Date): number {
    return chartStartX + (differenceInDays(date, minDate) / totalDays) * totalColWidth;
  }

  const todayX = dateToX(now);
  const lateCount = timeline.filter(t => t.isLate).length;

  // ═══ Rendu ══════

  return (
    <div>
      {/* Barre d'outils : navigation + granularité + légende */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {/* Navigation mois/semaine/trimestre */}
          <Button
            variant="outline" size="sm" className="h-7 w-7 p-0"
            disabled={!canScrollLeft}
            onClick={() => setMonthOffset(o => o - 1)}
            title="Précédent"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="sm" className="h-7 w-7 p-0"
            onClick={() => setMonthOffset(o => o + 1)}
            title="Suivant"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>

          {/* Aujourd'hui */}
          <Button
            variant="ghost" size="sm" className="h-7 text-xs gap-1.5"
            onClick={scrollToToday}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Aujourd'hui
          </Button>

          {/* Séparateur */}
          <div className="w-px h-5 bg-border mx-1" />

          {/* Granularité */}
          <div className="flex items-center rounded-lg bg-muted p-0.5">
            {(['month', 'week', 'quarter'] as Granularity[]).map(g => (
              <button
                key={g}
                onClick={() => setGranularity(g)}
                className={cn(
                  'px-2.5 py-1 text-[10px] font-medium rounded-md transition-all',
                  granularity === g
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {g === 'month' ? 'Mois' : g === 'week' ? 'Sem.' : 'Trim.'}
              </button>
            ))}
          </div>
        </div>

        {/* Légende */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">Légende :</span>
          {Object.entries(PHASE_CONFIG).filter(([k]) => k !== 'brouillon').map(([key, cfg]) => (
            <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.hex }} />
              {cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-2">
            <div className="w-2.5 h-2.5 rounded border border-red-400 border-dashed" />
            Retard
          </div>
        </div>
      </div>

      {/* Timeline SVG */}
      <div className="overflow-x-auto border rounded-xl bg-white shadow-sm">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ minHeight: `${Math.max(svgHeight / 2.5, 280)}px`, minWidth: '600px' }}
        >
          {/* Fond rayé week-ends (seulement en mode mois) */}
          {granularity === 'month' && Array.from({ length: Math.ceil(totalDays) }, (_, i) => {
            const d = new Date(minDate);
            d.setDate(d.getDate() + i);
            if (d.getDay() === 0 || d.getDay() === 6) {
              const x = dateToX(d);
              const w = Math.max(totalColWidth / totalDays, 1);
              return (
                <rect key={i} x={x} y={0} width={w} height={svgHeight} fill="#F8FAFC" />
              );
            }
            return null;
          })}

          {/* En-tête colonnes (mois/semaines/trimestres) */}
          {columns.map((col, i) => {
            const x = dateToX(col);
            const colEnd = getColumnEnd(col, granularity);
            const nextX = i < columns.length - 1 ? dateToX(columns[i + 1]) : svgWidth;
            const width = nextX - x;
            const isCurrent = isCurrentColumn(col, granularity, now);
            const label = getColumnLabel(col, granularity);

            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={svgHeight} stroke="#E5E7EB" strokeWidth="0.5" />
                <rect
                  x={x} y={0} width={width} height={HEADER_HEIGHT}
                  fill={isCurrent ? '#FFF7ED' : 'white'}
                />
                <text
                  x={x + width / 2} y={20}
                  textAnchor="middle" fill={isCurrent ? '#EA580C' : '#6B7280'}
                  fontSize={width > 60 ? '11' : '9'} fontWeight="700"
                >
                  {label.main}
                </text>
                <text
                  x={x + width / 2} y={36}
                  textAnchor="middle" fill={isCurrent ? '#F97316' : '#9CA3AF'}
                  fontSize="10" fontWeight="500"
                >
                  {label.sub}
                </text>
                {/* Repères de jours */}
                {granularity !== 'quarter' && DAY_STEPS[granularity].map(step => {
                  const stepDate = new Date(col);
                  if (granularity === 'month') {
                    const lastDay = new Date(col.getFullYear(), col.getMonth() + 1, 0).getDate();
                    stepDate.setDate(Math.min(step, lastDay));
                  } else {
                    stepDate.setDate(col.getDate() + step - 1);
                  }
                  if (stepDate >= col && stepDate <= colEnd) {
                    const dx = dateToX(stepDate);
                    return (
                      <g key={step}>
                        <line x1={dx} y1={HEADER_HEIGHT - 8} x2={dx} y2={HEADER_HEIGHT} stroke="#E5E7EB" strokeWidth="0.5" />
                        <text x={dx} y={HEADER_HEIGHT - 10} textAnchor="middle" fill="#D1D5DB" fontSize="7">
                          {granularity === 'month' ? step : step}
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            );
          })}

          {/* Ligne Aujourd'hui */}
          {todayX >= chartStartX && todayX <= svgWidth && (
            <>
              <line
                x1={todayX} y1={HEADER_HEIGHT} x2={todayX} y2={svgHeight}
                stroke="#EF4444" strokeWidth="2" strokeDasharray="5,3" opacity="0.6"
              />
              <rect x={todayX - 24} y={HEADER_HEIGHT - 16} width="48" height="16" rx="8" fill="#EF4444" />
              <text x={todayX} y={HEADER_HEIGHT - 4} textAnchor="middle" fill="white" fontSize="10" fontWeight="700">
                AUJ.
              </text>
            </>
          )}

          {/* Barres projet */}
          {timeline.map((item, i) => {
            const y = HEADER_HEIGHT + i * ROW_HEIGHT + 8;
            const barH = ROW_HEIGHT - 16;

            // Projet non initialisé
            if (!item.initDate) {
              return (
                <g key={item.project.id}>
                  <rect x={0} y={y - 4} width={svgWidth} height={ROW_HEIGHT} fill="#FAFAFA" />
                  <text
                    x={LEFT_LABEL_WIDTH - 8} y={y + barH / 2 + 4}
                    textAnchor="end" fill="#9CA3AF" fontSize="11"
                    className="cursor-pointer hover:underline"
                    onClick={() => navigate(`/projects/${item.project.id}`)}
                  >
                    {item.phaseIcon} {item.project.name.length > 18 ? item.project.name.slice(0, 17) + '…' : item.project.name}
                  </text>
                  <text x={chartStartX + 4} y={y + barH / 2 + 4} fill="#9CA3AF" fontSize="10" fontStyle="italic">
                    Non initialisé
                  </text>
                </g>
              );
            }

            // 🔧 Barre : utiliser now comme fallback si endDate absente ou < initDate
            const effectiveEnd = item.endDate && item.endDate >= item.initDate ? item.endDate : now;
            const startX = dateToX(item.initDate);
            const endX = dateToX(effectiveEnd);
            const barW = Math.max(endX - startX, 6);

            const progress = item.daysTotal && item.daysTotal > 0
              ? Math.min((item.daysElapsed || 0) / item.daysTotal, 1)
              : effectiveEnd > item.initDate
                ? Math.min(differenceInDays(now, item.initDate) / Math.max(differenceInDays(effectiveEnd, item.initDate), 1), 1)
                : 0;
            const progressW = Math.min(barW * progress, barW);

            const truncatedName = item.project.name.length > 18
              ? item.project.name.slice(0, 17) + '…'
              : item.project.name;

            const dayDiff = item.initDate && effectiveEnd
              ? differenceInDays(effectiveEnd, item.initDate)
              : 0;

            return (
              <g key={item.project.id}>
                {/* Fond ligne alterné */}
                <rect x={0} y={y - 4} width={svgWidth} height={ROW_HEIGHT} fill={i % 2 === 0 ? 'white' : '#F9FAFB'} opacity="0.6" />

                {/* Label projet avec tooltip SVG natif */}
                <text
                  x={LEFT_LABEL_WIDTH - 8} y={y + barH / 2 + 4}
                  textAnchor="end" fill="#374151" fontSize="11" fontWeight="500"
                  className="cursor-pointer hover:underline"
                  onClick={() => navigate(`/projects/${item.project.id}`)}
                >
                  <title>
                    {`${item.project.name}\nPhase: ${item.phaseLabel}\nDébut: ${format(item.initDate, 'dd MMM yyyy', { locale: fr })}${item.endDate ? `\nLivraison: ${format(item.endDate, 'dd MMM yyyy', { locale: fr })}` : '\nPas de date de livraison'}${dayDiff > 0 ? `\nDurée: ${dayDiff} jours` : ''}${item.isLate ? '\n⚠️ RETARD' : ''}`}
                  </title>
                  {item.phaseIcon} {truncatedName}
                </text>

                {/* Barre de fond */}
                <rect
                  x={startX} y={y} width={barW} height={barH} rx="4"
                  fill={item.phaseHex} opacity="0.1"
                  className="cursor-pointer"
                  onClick={() => navigate(`/projects/${item.project.id}`)}
                />

                {/* Barre de progression */}
                {progressW > 0 && (
                  <rect
                    x={startX} y={y} width={progressW} height={barH} rx="4"
                    fill={item.phaseHex} opacity={item.isLate ? "0.6" : "0.4"}
                    className="cursor-pointer transition-all duration-300"
                    onClick={() => navigate(`/projects/${item.project.id}`)}
                  />
                )}

                {/* Point de début */}
                <circle cx={startX} cy={y + barH / 2} r="3" fill={item.phaseHex} stroke="white" strokeWidth="1.5" />

                {/* Point de fin (livraison) */}
                {item.endDate && item.endDate >= item.initDate && (
                  <circle
                    cx={endX} cy={y + barH / 2} r="3"
                    fill={item.isLate ? '#EF4444' : item.phaseHex}
                    stroke="white" strokeWidth="1.5"
                  />
                )}

                {/* Bordure retard */}
                {item.isLate && (
                  <rect
                    x={startX} y={y} width={barW} height={barH} rx="4"
                    fill="none" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="4,2"
                  />
                )}

                {/* Date début */}
                <text x={startX} y={y - 4} textAnchor="middle" fill="#6B7280" fontSize="8" fontWeight="500">
                  {format(item.initDate, 'dd/MM')}
                </text>

                {/* Date fin + badge livraison */}
                {item.endDate && item.endDate >= item.initDate && (
                  <text
                    x={endX + 3} y={y + barH / 2 + 3}
                    fill={item.isLate ? '#EF4444' : '#6B7280'}
                    fontSize="9" fontWeight={item.isLate ? '700' : '400'}
                  >
                    {item.isLate ? '⚠️ ' : '📦 '}
                    {format(item.endDate, 'dd MMM', { locale: fr })}
                    {item.isLate && ' RETARD'}
                  </text>
                )}

                {/* Pourcentage / jours au centre */}
                {dayDiff > 0 && (
                  <text
                    x={startX + barW / 2} y={y + barH / 2 + 3}
                    textAnchor="middle" fill={item.isLate ? '#EF4444' : item.phaseHex}
                    fontSize="9" fontWeight="700"
                  >
                    {item.daysElapsed !== null && item.daysTotal !== null && item.daysElapsed > item.daysTotal
                      ? `+${item.daysElapsed - item.daysTotal}j`
                      : `${Math.round(progress * 100)}%`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Compteur footer */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{timeline.length} projet{timeline.length !== 1 ? 's' : ''}</span>
        {lateCount > 0 && (
          <span className="flex items-center gap-1 text-red-500">
            <AlertTriangle className="h-3 w-3" />
            {lateCount} en retard
          </span>
        )}
      </div>
    </div>
  );
};
