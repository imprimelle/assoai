import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChecklistSlide, ChecklistMeta } from '@/components/checklist/ChecklistSlide';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Layers } from 'lucide-react';

interface MonBaraProps {
  userRole: string;
  userName: string;
}

const MonBara: React.FC<MonBaraProps> = ({ userRole, userName }) => {
  const [checklists, setChecklists] = useState<ChecklistMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [api, setApi] = useState<CarouselApi>();
  const [positioned, setPositioned] = useState(false);

  // Fetch Niveau 1 — identique à PublicChecklists : une seule requête avec !inner joins
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // ⚡ Même pattern que PublicChecklists : !inner sur project_tasks + projects
        // Filtre : uniquement les checklists NON complétées (kanban_column ≠ 'termine')
        //         et actives (project_tasks.active = true)
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
          .in('project_tasks.kanban_column', ['a_faire', 'en_cours', 'en_revision'])
          .eq('project_tasks.active', true)
          .not('task_id', 'is', null);

        // Filtrer par rôle de l'utilisateur connecté
        if (userRole) {
          query = query.eq('project_tasks.assignee', userRole);
        }

        const { data, error: fetchErr } = await query
          .order('due_date', { foreignTable: 'project_tasks', ascending: true, nullsFirst: false });

        if (fetchErr) throw fetchErr;

        // ✅ Données déjà au format ChecklistMeta (même structure que PublicChecklists)
        const list = (data || []) as unknown as ChecklistMeta[];
        setChecklists(list);
      } catch (err: any) {
        console.error('Erreur Mon Bara:', err);
        setError(err.message || 'Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [userRole]);

  const totalSlides = checklists.length;

  // Positionner le carousel sur la première checklist une fois prêt
  useEffect(() => {
    if (!api || positioned || totalSlides === 0) return;
    api.scrollTo(currentIndex, false);
    setPositioned(true);
  }, [api, currentIndex, positioned, totalSlides]);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrentIndex(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    api.on('select', onSelect);
    return () => {
      api.off('select', onSelect);
    };
  }, [api, onSelect]);

  // Callback de progression (depuis ChecklistSlide)
  const handleProgress = useCallback((_checklistId: string, _pct: number) => {
    // Optionnel : rafraîchir la liste après progression
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-brand-orange">Asso</span>
            <span className="text-gray-900">AI</span>
          </h1>
          <div className="h-1 w-12 bg-brand-orange rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
          <p className="text-xs text-muted-foreground">Chargement de ton bara...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl mb-2">⚠️</p>
          <p className="text-muted-foreground">Erreur de chargement</p>
          <p className="text-xs text-red-500 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (totalSlides === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xl mb-2">📋</p>
          <p className="text-muted-foreground font-medium">Aucune tâche en cours</p>
          <p className="text-xs text-muted-foreground mt-1">
            Toutes les tâches sont terminées 🎉
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Barre supérieure : titre + compteur + nom */}
      <div className="bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold">Mon Bara</span>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1}/{totalSlides}
          </span>
        </div>
        {userName && (
          <span className="text-xs text-muted-foreground truncate ml-2 max-w-[120px]">
            👋 {userName}
          </span>
        )}
      </div>

      {/* Slider principal — plein écran */}
      <div className="flex-1 relative">
        <Carousel
          opts={{ align: 'start', containScroll: 'trimSnaps' }}
          setApi={setApi}
          className="h-full"
        >
          <CarouselContent className="h-full">
            {checklists.map((cl: ChecklistMeta) => (
              <CarouselItem key={cl.id} className="h-full">
                <ChecklistSlide
                  checklistId={cl.id}
                  userName={userName}
                  viewerRole={userRole}
                  preloadedData={cl}
                  lazyLoad={true}
                  onProgress={handleProgress}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Barre inférieure : flèches + dots */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 shrink-0">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={currentIndex === 0}
            onClick={() => api?.scrollPrev()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* Dots de navigation */}
          <div className="flex items-center gap-1.5">
            {checklists.map((_, idx) => (
              <button
                key={idx}
                onClick={() => api?.scrollTo(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentIndex
                    ? 'w-6 bg-amber-500'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Checklist ${idx + 1}`}
              />
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-full"
            disabled={currentIndex >= totalSlides - 1}
            onClick={() => api?.scrollNext()}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MonBara;
