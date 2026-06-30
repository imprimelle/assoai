import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Loader2, User, Calendar, Truck, MapPin, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Camera, FileText, ExternalLink, CheckCheck, Flag } from 'lucide-react';
import PhotoUploadButton from './PhotoUploadButton';
import PhotoGallery from './PhotoGallery';
import PhotoRequiredDialog from './PhotoRequiredDialog';

interface ChecklistItem { text: string; done?: boolean }
interface ChecklistMeta {
  id: string;
  title: string;
  section: string;
  project_id: string;
  task_id: string;
  items: ChecklistItem[];
  percentage: number;
  project_tasks: {
    kanban_column: string;
    active: boolean;
    assignee: string;
    due_date: string;
    is_phase_validation: boolean;
  };
  projects: { name: string };
}

interface ChecklistFullData {
  id: string;
  title: string;
  section: string;
  items: ChecklistItem[];
  project_id: string;
  task_id: string;
}

const ROLE_NAMES: Record<string, string> = {
  directeur: 'Emmanuel Loukou',
  directrice_adjointe: 'Fatou',
  commerciale: 'Miss Kady',
  chef_technique: 'Koné Daouda',
  technicien_adjoint: 'Sidick',
  superviseur_logistique: 'Oumou',
};

const KANBAN_LABELS: Record<string, string> = {
  a_faire: 'À faire',
  en_cours: 'En cours',
  en_revision: 'En révision',
  termine: 'Terminé',
};

interface ChecklistSlideProps {
  checklistId: string;
  userName?: string;
  viewerRole?: string;
  preloadedData?: ChecklistMeta;
  lazyLoad?: boolean;
  isActive?: boolean;
  footerCollapsed?: boolean;
  onFooterToggle?: (collapsed: boolean) => void;
  onProgress?: (checklistId: string, pct: number) => void;
}

// ── Component ──────────────────────────────────────────────────────────────

const ChecklistSlide: React.FC<ChecklistSlideProps> = ({
  checklistId,
  userName = '',
  viewerRole = '',
  preloadedData,
  lazyLoad = true,
  isActive = true,
  footerCollapsed = true,
  onFooterToggle,
  onProgress,
}) => {
  const [checklist, setChecklist] = useState<ChecklistFullData | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>(preloadedData?.items || []);
  const [projectName, setProjectName] = useState(preloadedData?.projects?.name || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalDoneCount, setOriginalDoneCount] = useState(0);
  const [savedSnapshot, setSavedSnapshot] = useState<ChecklistItem[] | null>(null);

  const [taskInfo, setTaskInfo] = useState<{ assignee: string; due_date: string; is_phase_validation?: boolean } | null>(
    preloadedData?.project_tasks ? {
      assignee: preloadedData.project_tasks.assignee,
      due_date: preloadedData.project_tasks.due_date,
      is_phase_validation: preloadedData.project_tasks.is_phase_validation,
    } : null
  );
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [cdcInfo, setCdcInfo] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [pendingMissingItem, setPendingMissingItem] = useState<{ item: any; idx: number } | null>(null);

  const [projectDocs, setProjectDocs] = useState<Array<{
    id: string;
    type: 'facture' | 'commande' | 'cahier_des_charges';
    label: string;
    numero: string;
  }>>([]);
  const [showDocs, setShowDocs] = useState(false);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(52);

  const ROLE_DOC_VISIBILITY: Record<string, string[]> = {
    chef_technique:        ['cahier_des_charges'],
    technicien_adjoint:    ['cahier_des_charges'],
    directeur:             ['facture', 'commande', 'cahier_des_charges'],
    directrice_adjointe:   ['facture', 'commande', 'cahier_des_charges'],
    commerciale:           ['commande'],
    superviseur_logistique: ['commande', 'cahier_des_charges'],
  };

  // ── Effects (unchanged) ─────────────────────────────────────────────────

  useEffect(() => {
    if (preloadedData) {
      // Init items seulement au premier chargement (avant lazyLoad)
      if (!checklist) {
        setItems(preloadedData.items || []);
        setOriginalDoneCount((preloadedData.items || []).filter((i: any) => i.done).length);
        setSavedSnapshot(preloadedData.items ? [...preloadedData.items] : null);
      }
      setProjectName(preloadedData.projects?.name || '');
      if (preloadedData.project_tasks) {
        setTaskInfo({
          assignee: preloadedData.project_tasks.assignee,
          due_date: preloadedData.project_tasks.due_date,
          is_phase_validation: preloadedData.project_tasks.is_phase_validation,
        });
      }
    }
  }, [preloadedData, checklist]);

  useEffect(() => {
    if (!lazyLoad) return;
    if (!checklistId) return;

    (async () => {
      setLoading(true);
      const { data: cl, error } = await supabase
        .from('checklists').select('*').eq('id', checklistId).single();
      if (error || !cl) { setLoading(false); return; }
      setChecklist(cl);
      
      if (!preloadedData) {
        setItems(cl.items || []);
        setSavedSnapshot(cl.items ? [...cl.items] : null);
      }
      setOriginalDoneCount((cl.items || []).filter((i: any) => i.done).length);

      if (cl.project_id && !preloadedData?.projects?.name) {
        const { data: proj } = await supabase
          .from('projects').select('name').eq('id', cl.project_id).single();
        if (proj) setProjectName(proj.name);
      }

      if (cl.task_id && !preloadedData?.project_tasks) {
        const { data: task } = await supabase
          .from('project_tasks').select('assignee, due_date, is_phase_validation')
          .eq('id', cl.task_id).single();
        if (task) setTaskInfo(task);
      }

      if (cl.project_id) {
        const { data: msgs } = await supabase
          .from('messages')
          .select('id,template_data,template_type')
          .eq('project_id', cl.project_id)
          .in('template_type', ['facture', 'commande', 'cahier_des_charges'])
          .or('template_data->data->>is_latest.is.null,template_data->data->>is_latest.eq.true')
          .order('timestamp', { ascending: false }).limit(10);
        if (msgs) {
          const cmd = msgs.find((m: any) => m.template_type === 'commande');
          const cdc = msgs.find((m: any) => m.template_type === 'cahier_des_charges');
          if (cmd) setOrderInfo(cmd.template_data?.data || null);
          if (cdc) setCdcInfo(cdc.template_data?.data || null);

          const labels: Record<string, string> = {
            facture: '🔵 FACTURE',
            commande: '🟠 COMMANDE',
            cahier_des_charges: '🟣 CDC',
          };
          setProjectDocs(msgs.map((m: any) => {
            const td = m.template_data?.data || {};
            return {
              id: m.id,
              type: m.template_type,
              label: labels[m.template_type] || m.template_type.toUpperCase(),
              numero: td.factureNumero || td.commandeNumero || td.cdcNumero || '',
            };
          }));
        }
      }
      setDetailsLoaded(true);
      setLoading(false);
    })();
  }, [checklistId, lazyLoad]);

  // ── Handlers (unchanged) ────────────────────────────────────────────────

  const toggleItem = (idx: number) => {
    setItems(prev => {
      const item = prev[idx];
      // Lock: can't uncheck an item that was already saved as done
      if (savedSnapshot?.[idx]?.done && item.done) return prev;
      return prev.map((it, i) =>
        i === idx ? { ...it, done: !it.done } : it
      );
    });
  };

  const checkAll = () => {
    setItems(prev => prev.map((item, i) =>
      // Only check items that aren't locked (not already saved as done)
      savedSnapshot?.[i]?.done ? item : { ...item, done: true }
    ));
  };

  const handlePhotoProvided = (url: string, sameForAll?: boolean) => {
    if (!pendingMissingItem) return;
    const { idx } = pendingMissingItem;
    setItems(prev => prev.map((item, i) => {
      // Appliquer à l'item courant, OU à tous les items si sameForAll
      const shouldApply = i === idx || (sameForAll && item.required_image && item.done && !(item.gallery_images?.length));
      if (shouldApply) {
        const gallery = [...(item.gallery_images || [])];
        if (item.image_url && !gallery.includes(item.image_url)) gallery.unshift(item.image_url);
        gallery.push(url);
        return { ...item, gallery_images: gallery, image_url: undefined };
      }
      return item;
    }));
    setShowPhotoDialog(false);
    setPendingMissingItem(null);
    setPhotoJustResolved(true);
  };

  const handleSkipPhoto = () => {
    if (!pendingMissingItem) return;
    const { idx } = pendingMissingItem;
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, done: false, done_by: undefined, done_at: undefined } : item
    ));
    setShowPhotoDialog(false);
    setPendingMissingItem(null);
    setPhotoJustResolved(true);
  };

  const [photoJustResolved, setPhotoJustResolved] = useState(false);
  useEffect(() => {
    if (!photoJustResolved) return;
    setPhotoJustResolved(false);
    const t = setTimeout(() => handleSave(), 150);
    return () => clearTimeout(t);
  }, [photoJustResolved]);

  const handleSave = async () => {
    if (!checklist && !preloadedData) return;
    const clId = checklist?.id || checklistId;

    const missingItems = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => hasMissingPhotos(item));

    if (missingItems.length > 0) {
      setPendingMissingItem(missingItems[0]);
      setShowPhotoDialog(true);
      return;
    }

    setSaving(true);
    await supabase.from('checklists').update({ items }).eq('id', clId);
    setSaving(false);
    setSaved(true);
    setSavedSnapshot([...items]); // lock current state
    setTimeout(() => setSaved(false), 2000);

    const newDoneCount = items.filter(i => isItemDone(i)).length;
    const totalItems = items.length;
    const progressMade = newDoneCount > originalDoneCount;

    if (!progressMade || !checklist?.task_id || totalItems === 0) return;

    const newPct = Math.round((newDoneCount / totalItems) * 100);
    const newlyCompleted = newDoneCount - originalDoneCount;
    const humanName = userName || assigneeName || 'Intervenant';
    const clTitle = checklist?.title || preloadedData?.title || '';
    const clProjectId = checklist?.project_id || preloadedData?.project_id || '';

    if (newPct === 100) {
      try {
        await supabase.from('communicator_queue').insert({
          direction: 'communicator_to_pm',
          action: 'task_completed',
          status: 'pending',
          retry_count: 0,
          payload: {
            checklist_id: clId,
            checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`,
            checklist_title: clTitle,
            task_id: checklist?.task_id,
            is_phase_validation: taskInfo?.is_phase_validation ?? preloadedData?.project_tasks?.is_phase_validation ?? false,
            project_id: clProjectId,
            project_name: projectName,
            pct: 100,
            done: newDoneCount,
            total: totalItems,
            newly_completed: newlyCompleted,
            completed_at: new Date().toISOString(),
          },
        });
      } catch { /* silencieux */ }

      try {
        await supabase.from('communicator_queue').insert({
          direction: 'pm_to_communicator',
          action: 'task_completed',
          status: 'pending',
          retry_count: 0,
          payload: {
            checklist_id: clId,
            checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`,
            checklist_title: clTitle,
            task_id: checklist?.task_id,
            is_phase_validation: taskInfo?.is_phase_validation ?? preloadedData?.project_tasks?.is_phase_validation ?? false,
            task_title: taskInfo?.assignee ? `Tâche assignée à ${assigneeName}` : clTitle,
            project_id: clProjectId,
            project_name: projectName,
            human_name: humanName,
            pct: 100,
            done: newDoneCount,
            total: totalItems,
            newly_completed: newlyCompleted,
            completed_at: new Date().toISOString(),
          },
        });
      } catch { /* silencieux */ }

      setOriginalDoneCount(newDoneCount);
    } else {
      try {
        await supabase.from('communicator_queue').insert({
          direction: 'pm_to_communicator',
          action: 'checklist_progress',
          status: 'pending',
          retry_count: 0,
          payload: {
            checklist_id: clId,
            checklist_url: `https://assoai.srv1720118.hstgr.cloud/public/checklist/${clId}?user=${encodeURIComponent(humanName)}&role=${encodeURIComponent(assigneeRole)}`,
            checklist_title: clTitle,
            task_id: checklist?.task_id,
            task_title: taskInfo?.assignee ? `Tâche assignée à ${assigneeName}` : clTitle,
            project_id: clProjectId,
            project_name: projectName,
            human_name: humanName,
            pct: newPct,
            done: newDoneCount,
            total: totalItems,
            newly_completed: newlyCompleted,
            saved_at: new Date().toISOString(),
          },
        });
      } catch { /* silencieux */ }

      setOriginalDoneCount(newDoneCount);
    }

    onProgress?.(clId, newPct);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────

  const getItemText = (item: any) => item.label || item.text || 'Item';
  const isItemDone = (item: any) => !!item.done;
  const getItemImages = (item: any): string[] => {
    const gallery = item.gallery_images || [];
    if (item.image_url && !gallery.includes(item.image_url)) gallery.unshift(item.image_url);
    return gallery;
  };
  const hasMissingPhotos = (item: any): boolean => {
    return item.required_image && isItemDone(item) && getItemImages(item).length === 0;
  };
  const doneCount = items.filter(i => isItemDone(i)).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
  const allChecked = doneCount === total && total > 0;
  const dirty = !savedSnapshot || items.some((item, i) => item.done !== (savedSnapshot[i]?.done ?? false));

  const assigneeRole = taskInfo?.assignee || '';
  const assigneeName = ROLE_NAMES[assigneeRole] || assigneeRole;
  const dueDate = taskInfo?.due_date ? new Date(taskInfo.due_date).toLocaleDateString('fr-FR') : '';
  const deliveryDate = orderInfo?.dateLivraison ? new Date(orderInfo.dateLivraison).toLocaleDateString('fr-FR') : '';
  const deliveryAddress = orderInfo?.deliveryAddress?.label || cdcInfo?.deliveryAddress?.label || '';
  const orderItems = orderInfo?.items || [];
  const enseigneImages: string[] = (cdcInfo?.enseignes || [])
    .map((e: any) => e.details?.image_url)
    .filter(Boolean);

  // ── Mesure dynamique du footer pour le spacer ────────────────────────────
  useEffect(() => {
    if (footerRef.current) {
      const h = footerRef.current.offsetHeight;
      if (h > 0) setFooterHeight(h);
    }
  }, [footerCollapsed, showDocs, showDetails, allChecked, saved, doneCount, total]);

  const hasDetails = enseigneImages.length > 0 || deliveryDate || orderItems.length > 0 || deliveryAddress;

  const effectiveRole = viewerRole || assigneeRole;
  const allowedDocTypes = ROLE_DOC_VISIBILITY[effectiveRole] || [];
  const visibleDocs = projectDocs.filter(d => allowedDocTypes.includes(d.type));

  const checklistTitle = checklist?.title || preloadedData?.title || '';
  const checklistSection = checklist?.section || preloadedData?.section || '';
  const kanbanCol = preloadedData?.project_tasks?.kanban_column || '';
  const kanbanLabel = KANBAN_LABELS[kanbanCol] || kanbanCol;

  // ── Loading spinner ─────────────────────────────────────────────────────

  if (loading && lazyLoad) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
      <div className="animate-pulse flex flex-col items-center gap-3">
        <h1 className="text-3xl font-bold tracking-tight">
          <span className="text-brand-orange">Asso</span>
          <span className="text-gray-900">AI</span>
        </h1>
        <div className="h-1 w-12 bg-brand-orange rounded-full animate-spin" style={{ animationDuration: '1.5s' }} />
        <p className="text-xs text-muted-foreground">Chargement...</p>
      </div>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-white to-gray-50/50">

      {/* ▸ Sticky header — reste visible au scroll */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
        <div className="px-4 pt-4 pb-2">
        {/* Fil d'Ariane */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <span className="font-medium text-gray-500">Imprimelle</span>
          {projectName && (
            <>
              <span className="text-gray-300">›</span>
              <span className="text-gray-600">{projectName}</span>
            </>
          )}
        </div>

        {/* Titre + statut */}
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900 leading-tight flex-1">
            {checklistTitle}
          </h2>
          {/* Progression */}
          <div className="shrink-0 text-right">
            <span className={`text-lg font-bold ${allChecked ? 'text-green-600' : 'text-brand-orange'}`}>
              {pct}%
            </span>
          </div>
        </div>

        {/* Badges info */}
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {checklistSection && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
              {checklistSection}
            </Badge>
          )}
          {kanbanLabel && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
              {kanbanLabel}
            </Badge>
          )}
          {taskInfo?.is_phase_validation && (
            <Badge className="text-[10px] px-1.5 py-0 h-5 bg-amber-100 text-amber-700 border-amber-200">
              <Flag className="h-2.5 w-2.5 mr-0.5" />
              Validation
            </Badge>
          )}
        </div>
      </div>

      {/* ▸ Barre de progression */}
      <div className="px-4 pb-2">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              allChecked ? 'bg-green-500' : 'bg-brand-orange'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 text-right">
          {doneCount}/{total} étape{total > 1 ? 's' : ''}
        </p>
      </div>

      {/* ▸ Infos rapides : assigné + deadline */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3 flex-wrap">
          {assigneeName && (
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-full pl-1 pr-3 py-1">
              <div className="h-6 w-6 rounded-full bg-brand-orange/10 flex items-center justify-center">
                <User className="h-3 w-3 text-brand-orange" />
              </div>
              <span className="text-xs font-medium text-gray-700">{assigneeName}</span>
            </div>
          )}
          {dueDate && (
            <div className="flex items-center gap-1.5 bg-gray-50 rounded-full px-3 py-1">
              <Calendar className="h-3 w-3 text-gray-400" />
              <span className="text-xs text-gray-600">{dueDate}</span>
            </div>
          )}
          {userName && (
            <span className="text-xs text-muted-foreground ml-auto">
              👋 {userName}
            </span>
          )}
        </div>
      </div>
      </div>  {/* ferme le sticky header */}

      {/* ▸ Liste d'items */}
      <div className="px-4 pb-8">
        <div className="space-y-1">
          {items.map((item, idx) => {
            const done = isItemDone(item);
            const images = getItemImages(item);
            const needsPhoto = item.required_image;
            const missingPhoto = done && needsPhoto && images.length === 0;
            return (
              <div key={idx}>
                <div
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all active:scale-[0.98] ${
                    done
                      ? 'bg-green-50/80 border border-green-100'
                      : 'bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleItem(idx)}
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      done
                        ? 'bg-green-500 border-green-500 scale-100'
                        : 'border-gray-300 hover:border-brand-orange/50'
                    }`}
                  >
                    {done && <Check className="h-3 w-3 text-white" />}
                  </button>

                  {/* Texte */}
                  <button
                    onClick={() => toggleItem(idx)}
                    className={`text-sm flex-1 leading-snug text-left ${
                      done ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}
                  >
                    {getItemText(item)}
                  </button>

                  {/* Photo : bouton ou miniature, sur la même ligne */}
                  {needsPhoto && done && (
                    images.length > 0
                      ? (
                        <div className="flex items-center gap-1 shrink-0">
                          {images.slice(0, 2).map((url, i) => (
                            <img
                              key={i}
                              src={url}
                              alt=""
                              className="h-8 w-8 rounded-lg object-cover border border-gray-200"
                            />
                          ))}
                          {images.length > 2 && (
                            <span className="text-[10px] text-muted-foreground">+{images.length - 2}</span>
                          )}
                          <PhotoUploadButton
                            projectId={checklist?.project_id || preloadedData?.project_id || ''}
                            taskId={checklist?.task_id || preloadedData?.task_id}
                            itemId={item.id || `item-${idx}`}
                            onUploaded={(url) => {
                              setItems(prev => prev.map((it, i) => {
                                if (i === idx) {
                                  const gallery = [...(it.gallery_images || [])];
                                  if (it.image_url && !gallery.includes(it.image_url)) gallery.unshift(it.image_url);
                                  gallery.push(url);
                                  return { ...it, gallery_images: gallery, image_url: undefined };
                                }
                                return it;
                              }));
                            }}
                            size="sm"
                          />
                        </div>
                      )
                      : (
                        <PhotoUploadButton
                          projectId={checklist?.project_id || preloadedData?.project_id || ''}
                          taskId={checklist?.task_id || preloadedData?.task_id}
                          itemId={item.id || `item-${idx}`}
                          onUploaded={(url) => {
                            setItems(prev => prev.map((it, i) => {
                              if (i === idx) {
                                const gallery = [...(it.gallery_images || [])];
                                if (it.image_url && !gallery.includes(it.image_url)) gallery.unshift(it.image_url);
                                gallery.push(url);
                                return { ...it, gallery_images: gallery, image_url: undefined };
                              }
                              return it;
                            }));
                          }}
                          size="sm"
                        />
                      )
                  )}

                  {/* Indicateur photo requise (item pas encore coché) */}
                  {needsPhoto && !done && (
                    <Camera className="h-4 w-4 text-gray-300 shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
      {/* ▸ Sticky Footer (isActive guard + portal for carousel sync) */}
      {isActive !== false && (
        <>
          {/* Dynamic spacer — stays in flow to push content above portal footer */}
          <div style={{ height: footerHeight }} aria-hidden="true" />

          {/* Portal footer → escapes carousel transform containment */}
          {createPortal(
            <div
              ref={footerRef}
              className="fixed bottom-0 left-0 right-0 bg-gray-100 border-t border-gray-300 shadow-lg z-50 transition-all duration-200"
              style={{}}
            >
            {footerCollapsed ? (
              /* Compact bar — buttons only, no progress widget */
              <div className="flex items-center gap-2 px-4 py-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl text-xs gap-1.5 border-gray-200 hover:bg-gray-50 shrink-0"
                  onClick={checkAll}
                  disabled={allChecked || items.length === 0}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Tout cocher
                </Button>
                <Button
                  className={`
                    flex-1 h-9 rounded-xl text-sm font-semibold gap-1.5 transition-all duration-500
                    ${allChecked ? 'bg-green-600 hover:bg-green-700' : ''}
                  `}
                  onClick={handleSave}
                  disabled={saving || items.length === 0 || !dirty}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : saved ? (
                    <Check className="h-4 w-4" />
                  ) : allChecked ? (
                    <span className="flex items-center gap-1">
                      ✅ J&apos;ai fini
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      💾 Enregistrer
                    </span>
                  )}
                </Button>
                <button
                  onClick={() => onFooterToggle?.(false)}
                  className="h-7 w-7 rounded-full bg-brand-orange/10 flex items-center justify-center hover:bg-brand-orange/20 hover:scale-110 active:scale-95 transition-all shrink-0"
                  aria-label="Afficher plus"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-brand-orange" />
                </button>
              </div>
            ) : (
              /* Expanded bar — toggles + buttons */
              <>
                {/* Projet · Checklist + collapse chevron */}
                <div className="flex items-center justify-between px-4 pt-2 pb-1">
                  <span className="text-[11px] text-gray-700 font-medium truncate mr-2">
                    {projectName || 'Projet'} · {checklist?.title || preloadedData?.title || 'Checklist'}
                  </span>
                  <button
                    onClick={() => { onFooterToggle?.(true); setShowDocs(false); setShowDetails(false); }}
                    className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 hover:scale-110 active:scale-95 transition-all shrink-0"
                    aria-label="Réduire"
                  >
                    <ArrowDown className="h-3.5 w-3.5 text-gray-500" />
                  </button>
                </div>

                {/* Toggles : Projet (1er) + Documents (2nd) */}
                <div className="max-h-[35vh] overflow-y-auto px-4 pb-1 space-y-1.5">
                  {/* 🚚 Détails projet — 1ʳᵉ position */}
                  {hasDetails && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Truck className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                        {showDetails || enseigneImages.length === 0 ? (
                          <span className="text-xs font-medium flex-1 text-left text-gray-600">
                            {projectName ? `Détails ${projectName}` : 'Détails du projet'}
                          </span>
                        ) : (
                          /* Collapsed : miniatures des enseignes */
                          <div className="flex items-center gap-1 flex-1 overflow-hidden">
                            {enseigneImages.slice(0, 4).map((url, i) => (
                              <div key={i} className="w-7 h-7 rounded-md border border-gray-100 overflow-hidden bg-gray-50 shrink-0">
                                <img src={url} alt={`Enseigne ${i + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                            {enseigneImages.length > 4 && (
                              <span className="text-[10px] text-gray-400 ml-0.5">+{enseigneImages.length - 4}</span>
                            )}
                          </div>
                        )}
                        {showDetails ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      </button>
                      {showDetails && (
                        <div className="px-3 pb-3 space-y-2 border-t border-gray-50 pt-2">
                          {/* Enseignes (CDC) — images clickables */}
                          {enseigneImages.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                                Enseignes
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {enseigneImages.map((url, i) => (
                                  <a
                                    key={i}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-12 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 hover:ring-2 hover:ring-brand-orange/30 transition-all"
                                  >
                                    <img src={url} alt={`Enseigne ${i + 1}`} className="w-full h-full object-cover" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {(deliveryDate || deliveryAddress) && (
                            <div className="space-y-2">
                              {deliveryDate && (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                  <p className="text-xs font-medium text-gray-700">
                                    Livraison prévue : {deliveryDate}
                                  </p>
                                </div>
                              )}
                              {deliveryAddress && (
                                <div className="flex items-start gap-2">
                                  <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                                  <p className="text-xs text-muted-foreground">{deliveryAddress}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {orderItems.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                                Produits
                              </p>
                              <div className="space-y-1">
                                {orderItems.map((item: any, i: number) => (
                                  <div key={i} className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg border border-gray-100 overflow-hidden bg-gray-50 shrink-0">
                                      {item.image_url ? (
                                        <img src={item.image_url} alt={item.nom || ''} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center text-xs">📦</div>
                                      )}
                                    </div>
                                    <div>
                                      <p className="text-xs font-medium text-gray-700">{item.nom}</p>
                                      {item.quantite > 1 && (
                                        <p className="text-[10px] text-muted-foreground">×{item.quantite}</p>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 📄 Documents — 2ᵉ position */}
                  {visibleDocs.length > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                      <button
                        onClick={() => setShowDocs(!showDocs)}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5 text-brand-orange shrink-0" />
                        {showDocs || visibleDocs.length === 0 ? (
                          <span className="text-xs font-medium flex-1 text-left text-gray-600">
                            Documents du projet
                          </span>
                        ) : visibleDocs.length === 1 ? (
                          /* Collapsed 1 doc : nom + numéro */
                          <span className="text-xs font-medium flex-1 text-left text-gray-700 truncate">
                            {visibleDocs[0].label}
                            {visibleDocs[0].numero && (
                              <span className="text-[10px] text-muted-foreground ml-1">{visibleDocs[0].numero}</span>
                            )}
                          </span>
                        ) : (
                          /* Collapsed N docs : liste compacte */
                          <span className="text-xs font-medium flex-1 text-left text-gray-700 truncate">
                            {visibleDocs.slice(0, 2).map((d, i) => (
                              <span key={d.id}>
                                {i > 0 && ' · '}
                                {d.label}
                              </span>
                            ))}
                            {visibleDocs.length > 2 && (
                              <span className="text-[10px] text-muted-foreground ml-1">+{visibleDocs.length - 2}</span>
                            )}
                          </span>
                        )}
                        {!showDocs && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                            {visibleDocs.length}
                          </Badge>
                        )}
                        {showDocs ? <ChevronUp className="h-3.5 w-3.5 text-gray-400 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />}
                      </button>
                      {showDocs && (
                        <div className="border-t border-gray-50">
                          {visibleDocs.map((doc) => (
                            <a
                              key={doc.id}
                              href={`/public/doc/${doc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                              <span className="text-xs font-medium flex-1 text-gray-700">
                                {doc.label}
                                {doc.numero && (
                                  <span className="text-[10px] text-muted-foreground ml-1.5">
                                    {doc.numero}
                                  </span>
                                )}
                              </span>
                              <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Boutons */}
                <div className="flex items-center gap-2 px-4 pb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 rounded-xl text-xs gap-1.5 border-gray-200 hover:bg-gray-50 shrink-0"
                    onClick={checkAll}
                    disabled={allChecked || items.length === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Tout cocher
                  </Button>
                  <Button
                    className={`
                      flex-1 h-10 rounded-xl text-sm font-semibold gap-1.5 transition-all duration-500
                      ${allChecked ? 'bg-green-600 hover:bg-green-700 scale-[1.02]' : ''}
                    `}
                    onClick={handleSave}
                    disabled={saving || items.length === 0 || !dirty}
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <Check className="h-4 w-4" />
                    ) : allChecked ? (
                      <span className="flex items-center gap-1 animate-in zoom-in duration-300">
                        ✅ J&apos;ai fini
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        💾 Enregistrer
                      </span>
                    )}
                  </Button>
                </div>
                {allChecked && !saved && (
                  <p className="text-[10px] text-center text-green-400 pb-2 font-medium">
                    Tout est coché — appuie sur « J&apos;ai fini » pour valider 🎉
                  </p>
                )}
              </>
            )}
          </div>
          , document.body
          )}
        </>
      )}

      {/* Photo required dialog */}
      {createPortal(
        <PhotoRequiredDialog
          open={showPhotoDialog}
          itemLabel={pendingMissingItem ? getItemText(pendingMissingItem.item) : ''}
          projectId={checklist?.project_id || preloadedData?.project_id || ''}
          taskId={checklist?.task_id || preloadedData?.task_id}
          itemId={pendingMissingItem?.item?.id || `item-${pendingMissingItem?.idx || 0}`}
          totalPhotoItems={items.filter(i => i.required_image && i.done && !(i.gallery_images?.length)).length}
          onPhotoProvided={(url, sameForAll) => handlePhotoProvided(url, sameForAll)}
          onCancel={handleSkipPhoto}
        />,
        document.body,
      )}
    </div>
  );
};

export { ChecklistSlide };
export type { ChecklistMeta };
