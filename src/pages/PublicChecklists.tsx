import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistSlide, ChecklistMeta } from '@/components/checklist/ChecklistSlide';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, ClipboardCheck, Clock, CheckCircle2, Sparkles } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePageVisit } from '@/hooks/usePageVisit';

// ── Types ──────────────────────────────────────────────────────────────────

type TabId = 'a_faire' | 'en_cours' | 'termine';

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'a_faire',  label: 'À faire',  icon: <ClipboardCheck className="h-3.5 w-3.5" /> },
  { id: 'en_cours', label: 'En cours',  icon: <Clock className="h-3.5 w-3.5" /> },
  { id: 'termine',  label: 'Terminé',   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function matchTab(cl: ChecklistMeta, tab: TabId): boolean {
  const col   = cl.project_tasks?.kanban_column || '';
  const active = cl.project_tasks?.active ?? true;
  switch (tab) {
    case 'a_faire':  return col === 'a_faire' && active;
    case 'en_cours': return ['en_cours', 'en_revision'].includes(col) && active;
    case 'termine':  return col === 'termine';
  }
}

function countTab(list: ChecklistMeta[], tab: TabId): number {
  return list.filter(cl => matchTab(cl, tab)).length;
}

// ── Component ──────────────────────────────────────────────────────────────

const PublicChecklists: React.FC = () => {
  const [searchParams] = useSearchParams();
  const userName = searchParams.get('user') || '';
  const role      = searchParams.get('role') || '';
  const startId   = searchParams.get('start') || '';

  // ── State ──────────────────────────────────────────────────────────────

  const [checklists, setChecklists] = useState<ChecklistMeta[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [selectedTab, setSelectedTab] = useState<TabId>('en_cours');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi]               = useState<CarouselApi>();
  const [positioned, setPositioned] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const [completedTaskTitle, setCompletedTaskTitle] = useState('');
  const [footerCollapsed, setFooterCollapsed] = useState(true);
  const currentUser = useCurrentUser();
  const { recordVisit } = usePageVisit();

  // Enregistrer la visite pour les compteurs
  useEffect(() => {
    if (currentUser) recordVisit(currentUser.id, "mon_bara");
  }, [currentUser, recordVisit]);

  // ── Data fetch (all checklists — filtered client-side) ──────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      let query = supabase
        .from('checklists')
        .select(`
          id,
          title,
          section,
          project_id,
          task_id,
          items,
          percentage,
          project_tasks!inner(
            kanban_column,
            active,
            assignee,
            due_date,
            is_phase_validation
          ),
          projects!inner(name)
        `)
        .not('task_id', 'is', null);

      if (role) query = query.eq('project_tasks.assignee', role);

      const { data, error: fetchErr } = await query
        .order('due_date', { foreignTable: 'project_tasks', ascending: true, nullsFirst: false });

      if (cancelled) return;
      if (fetchErr) { setError(fetchErr.message); setLoading(false); return; }

      setChecklists((data || []) as unknown as ChecklistMeta[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────

  const filtered = useMemo(
    () => checklists.filter(cl => matchTab(cl, selectedTab)),
    [checklists, selectedTab],
  );

  const tabCounts = useMemo(() => ({
    a_faire:  countTab(checklists, 'a_faire'),
    en_cours: countTab(checklists, 'en_cours'),
    termine:  countTab(checklists, 'termine'),
  }), [checklists]);

  // ── Tab switching — reset carousel ─────────────────────────────────────

  const handleTabChange = (tab: TabId) => {
    setSelectedTab(tab);
    setCurrentIndex(0);
    setPositioned(false);
  };

  // ── startId positioning ────────────────────────────────────────────────

  useEffect(() => {
    if (!api || !startId || filtered.length === 0 || positioned) return;
    const idx = filtered.findIndex(c => c.id === startId);
    if (idx >= 0) { api.scrollTo(idx, true); setCurrentIndex(idx); setPositioned(true); }
  }, [api, startId, filtered, positioned]);

  // ── Carousel index tracking ────────────────────────────────────────────

  const onSelect = useCallback((emblaApi: CarouselApi) => {
    if (!emblaApi) return;
    setCurrentIndex(emblaApi.selectedScrollSnap());
  }, []);

  useEffect(() => {
    if (!api) return;
    api.on('select', onSelect);
    onSelect(api);
    return () => { api.off('select', onSelect); };
  }, [api, onSelect]);

  // ── Progress callback — déplace entre onglets + popup félicitations ────

  const handleProgress = useCallback((_checklistId: string, _pct: number) => {
    if (_pct === 100) {
      // 1. Mettre à jour le state : items cochés + kanban → termine
      setChecklists(prev => {
        const task = prev.find(cl => cl.id === _checklistId);
        if (task) setCompletedTaskTitle(task.title || '');
        return prev.map(cl =>
          cl.id === _checklistId
            ? {
                ...cl,
                project_tasks: { ...cl.project_tasks, kanban_column: 'termine', active: false },
                items: (cl.items || []).map(item => ({ ...item, done: true })),
                percentage: 100,
              }
            : cl
        );
      });
      // 2. D'abord : switch vers l'onglet Terminé
      setSelectedTab('termine');
      // 3. Ensuite : popup après un court délai (le temps de voir l'onglet)
      setTimeout(() => setShowCongrats(true), 400);
      setTimeout(() => setShowCongrats(false), 3400);
    } else if (_pct > 0) {
      // Transition À faire → En cours
      setChecklists(prev => prev.map(cl =>
        cl.id === _checklistId && cl.project_tasks?.kanban_column === 'a_faire'
          ? {
              ...cl,
              project_tasks: { ...cl.project_tasks, kanban_column: 'en_cours' },
              percentage: _pct,
            }
          : cl
      ));
      // Switch vers l'onglet En cours
      setSelectedTab('en_cours');
    }
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-brand-orange">Asso</span>
          <span className="text-gray-900">AI</span>
        </h1>
        <div className="h-1 w-12 bg-brand-orange rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
        <p className="text-xs text-muted-foreground">Chargement des checklists...</p>
      </div>
    </div>
  );

  // ── Error ──────────────────────────────────────────────────────────────

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <p className="text-xl mb-2">⚠️</p>
        <p className="text-muted-foreground">Erreur de chargement</p>
        <p className="text-xs text-red-500 mt-1">{error}</p>
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex flex-col">

      {/* ▸ Header + Tabs */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 pt-3 shrink-0">
        {userName && (
          <div className="flex items-center gap-2 mb-2">
            <div className="h-7 w-7 rounded-full bg-brand-orange/10 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-orange">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700">{userName}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex" role="tablist">
          {TABS.map(tab => {
            const count = tabCounts[tab.id];
            const active = selectedTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={active}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex-1 flex items-center justify-center gap-1.5 py-2.5
                  text-xs font-medium transition-all relative
                  ${active ? 'text-brand-orange' : 'text-gray-400 hover:text-gray-600'}
                `}
              >
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <span className={`
                    ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full
                    text-[10px] font-bold flex items-center justify-center
                    ${active
                      ? 'bg-brand-orange/10 text-brand-orange'
                      : 'bg-gray-100 text-gray-500'}
                  `}>
                    {count}
                  </span>
                )}
                {/* Active indicator bar */}
                {active && (
                  <div className="absolute bottom-0 left-1/3 right-1/3 h-0.5 bg-brand-orange rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ▸ Content */}
      <div className="flex-1 relative">
        {filtered.length === 0 ? (
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center max-w-xs">
              <p className="text-2xl mb-2">
                {selectedTab === 'termine' ? '🎉' : selectedTab === 'en_cours' ? '📋' : '✨'}
              </p>
              <p className="text-gray-700 font-medium text-sm">
                {selectedTab === 'a_faire' && 'Rien à faire pour le moment'}
                {selectedTab === 'en_cours' && 'Aucune tâche en cours'}
                {selectedTab === 'termine' && 'Aucune tâche terminée'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {selectedTab === 'a_faire' && 'Tout est clean. Une nouvelle tâche arrivera bientôt.'}
                {selectedTab === 'en_cours' && 'Commence une tâche dans l\'onglet « À faire ». '}
                {selectedTab === 'termine' && 'Les tâches complétées apparaîtront ici.'}
              </p>
            </div>
          </div>
        ) : (
          <Carousel
            opts={{ align: 'start', containScroll: 'trimSnaps' }}
            setApi={setApi}
            className="h-full"
          >
            <CarouselContent className="h-full">
              {filtered.map((cl, idx) => (
                <CarouselItem key={cl.id} className="h-full">
                  <ChecklistSlide
                    checklistId={cl.id}
                    userName={userName}
                    viewerRole={role}
                    preloadedData={cl}
                    lazyLoad={true}
                    isActive={idx === currentIndex}
                    footerCollapsed={footerCollapsed}
                    onFooterToggle={setFooterCollapsed}
                    onProgress={handleProgress}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
        )}
      </div>

      {/* ▸ Footer navigation */}
      {filtered.length > 1 && (
        <div className="bg-white/80 backdrop-blur-sm border-t border-gray-100 px-4 py-3 shrink-0">
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={currentIndex === 0}
              onClick={() => api?.scrollPrev()}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1.5">
              {filtered.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => api?.scrollTo(idx)}
                  className={`rounded-full transition-all ${
                    idx === currentIndex
                      ? 'w-5 h-1.5 bg-brand-orange'
                      : 'w-1.5 h-1.5 bg-gray-200 hover:bg-gray-300'
                  }`}
                  aria-label={`Tâche ${idx + 1}`}
                />
              ))}
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={currentIndex >= filtered.length - 1}
              onClick={() => api?.scrollNext()}
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ▸ Popup félicitations */}
      {showCongrats && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="animate-in fade-in zoom-in duration-300 bg-white rounded-3xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3 max-w-xs mx-4 pointer-events-auto">
            <div className="relative">
              <div className="absolute inset-0 bg-amber-400 rounded-full blur-xl opacity-40 animate-pulse" />
              <Sparkles className="h-10 w-10 text-amber-500 relative z-10" />
            </div>
            <p className="text-lg font-bold text-gray-900 text-center">
              🎉 Bravo !
            </p>
            <p className="text-sm text-gray-600 text-center leading-snug">
              {completedTaskTitle ? `« ${completedTaskTitle} »` : 'La tâche'} est terminée
            </p>
            <div className="flex items-center gap-1 animate-bounce">
              <span className="text-xl">⭐</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicChecklists;
