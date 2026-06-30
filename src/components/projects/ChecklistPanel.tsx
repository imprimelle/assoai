import React, { useState, useEffect, useRef } from 'react';
import { Checklist, ChecklistItem, ChecklistSection, ChecklistFormData } from '@/types/checklist';
import { ProjectTask } from '@/types/project-task';
import { useChecklists } from '@/hooks/useChecklists';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, Camera, Link2, Clock } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import PhotoUploadButton from '@/components/checklist/PhotoUploadButton';
import PhotoGallery from '@/components/checklist/PhotoGallery';
import PhotoRequiredDialog from '@/components/checklist/PhotoRequiredDialog';

interface ChecklistPanelProps {
  projectId: string;
  highlightTaskId?: string | null;
}

const ASSIGNEE_LABELS: Record<string, string> = {
  'technicien': 'Technicien',
  'superviseur': 'Superviseur',
  'logistique': 'Logisticien',
  'commercial': 'Commercial',
  'admin': 'Admin',
  'chef_technique': 'Chef technique',
  'technicien_adjoint': 'Technicien adjoint',
  'superviseur_logistique': 'Superviseur log.',
  'commerciale': 'Commerciale',
  'directeur': 'Directeur',
  'directrice_adjointe': 'Directrice adjointe',
};

export const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ projectId, highlightTaskId }) => {
  const { checklists, isLoading, createChecklist, toggleItem, addItem, deleteChecklist, linkTask } = useChecklists(projectId);
  const { tasks } = useProjectTasks(projectId);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState<ChecklistSection>('fabrication');
  const [newTaskId, setNewTaskId] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createChecklist.mutate({
      project_id: projectId,
      title: newTitle.trim(),
      section: newSection,
      task_id: newTaskId || undefined,
    });
    setNewTitle('');
    setNewTaskId('');
    setShowAdd(false);
  };

  // Enrichir les checklists avec les infos de la tâche liée
  const enriched = (checklists || []).map(cl => {
    const linkedTask = tasks?.find(t => t.id === cl.task_id);
    return { ...cl, linkedTask };
  });

  // Tri : checklists non complétées d'abord, puis complétées
  const sorted = [...enriched].sort((a, b) => {
    const aDone = a.percentage === 100;
    const bDone = b.percentage === 100;
    if (aDone !== bDone) return aDone ? 1 : -1;
    // Même statut → ordre de création
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  // Auto-scroll vers la checklist liée à la tâche cliquée dans Kanban
  useEffect(() => {
    if (!highlightTaskId || !scrollContainerRef.current) return;
    const targetIdx = sorted.findIndex(cl => cl.task_id === highlightTaskId);
    if (targetIdx === -1) return;
    // Petit délai pour que le DOM soit rendu
    const timer = setTimeout(() => {
      const container = scrollContainerRef.current;
      if (!container) return;
      const cards = container.children;
      if (cards[targetIdx]) {
        cards[targetIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [highlightTaskId, sorted]);

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
    </div>;
  }

  return (
    <div className="space-y-4">
      {/* Slider horizontal scrollable */}
      {sorted.length > 0 && (
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory -mx-4 px-4 scrollbar-thin" ref={scrollContainerRef}>
          {sorted.map(checklist => (
            <div
              key={checklist.id}
              className={`flex-shrink-0 w-[320px] sm:w-[360px] snap-start transition-all duration-500 ${
                highlightTaskId && checklist.task_id === highlightTaskId
                  ? 'ring-2 ring-brand-orange ring-offset-2 rounded-lg'
                  : ''
              }`}
            >
              <ChecklistCard
                checklist={checklist}
                linkedTask={checklist.linkedTask}
                onToggleItem={(itemId, done, doneBy, itemIndex, isCheck, galleryImages) =>
                  toggleItem.mutate({ checklistId: checklist.id, itemId, itemIndex, done, doneBy, isCheck, galleryImages })
                }
                onAddItem={(label) =>
                  addItem.mutate({ checklistId: checklist.id, label })
                }
                onDelete={() => deleteChecklist.mutate(checklist.id)}
                onLinkTask={(taskId) =>
                  linkTask.mutate({ checklistId: checklist.id, taskId })
                }
                tasks={tasks || []}
              />
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p>Aucune checklist pour ce projet.</p>
        </div>
      )}

      {/* Ajout de checklist */}
      {showAdd && (
        <div className="bg-white border rounded-lg p-4">
          <h4 className="font-medium text-sm mb-3">Nouvelle checklist</h4>
          <div className="space-y-3">
            <Input
              autoFocus
              placeholder="Titre de la checklist"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <select
              value={newSection}
              onChange={(e) => setNewSection(e.target.value as ChecklistSection)}
              className="w-full p-2 border rounded text-sm"
            >
              <option value="facturation">Facturation</option>
              <option value="commande">Commande</option>
              <option value="fabrication">Fabrication</option>
              <option value="livraison">Livraison</option>
            </select>
            {tasks && tasks.length > 0 && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  <Link2 className="h-3 w-3 inline mr-1" />
                  Lier à une tâche Kanban (optionnel)
                </label>
                <select
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                  className="w-full p-2 border rounded text-sm"
                >
                  <option value="">— Aucune —</option>
                  {tasks.filter(t => t.active).map(task => (
                    <option key={task.id} value={task.id}>
                      {task.title} {task.is_phase_validation ? '🔒' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!newTitle.trim()}>
                Créer
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {!showAdd && (
          <Button variant="outline" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Ajouter une checklist
          </Button>
        )}
      </div>
    </div>
  );
};

// Carte de checklist individuelle
const ChecklistCard: React.FC<{
  checklist: Checklist & { linkedTask?: ProjectTask };
  linkedTask?: ProjectTask;
  onToggleItem: (itemId: string, done: boolean, doneBy?: string, itemIndex?: number, isCheck?: boolean, galleryImages?: string[]) => void;
  onAddItem: (label: string) => void;
  onDelete: () => void;
  onLinkTask: (taskId: string | null) => void;
  tasks: ProjectTask[];
}> = ({ checklist, linkedTask, onToggleItem, onAddItem, onDelete, onLinkTask, tasks }) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  // 📸 Dialogue photo obligatoire
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [pendingCheckItem, setPendingCheckItem] = useState<{ item: ChecklistItem; idx: number } | null>(null);

  const items = checklist.items || [];
  const isComplete = checklist.percentage === 100;
  // 🔒 Checklist inactive si liée à une tâche active=false (bloquée par dépendance)
  const isInactive = linkedTask && linkedTask.active === false;
  const isLocked = isInactive; // alias sémantique

  // 📸 Helper : obtenir toutes les images d'un item (rétrocompatibilité image_url)
  const getItemImages = (item: ChecklistItem): string[] => {
    const gallery = item.gallery_images || [];
    if (item.image_url && !gallery.includes(item.image_url)) gallery.unshift(item.image_url);
    return gallery;
  };

  // 📸 Helper : cet item exige-t-il une photo qui manque ?
  const hasMissingPhotos = (item: ChecklistItem): boolean => {
    return !!item.required_image && getItemImages(item).length === 0;
  };

  // 📝 Helper : texte d'un item (rétrocompatibilité label/text)
  const getItemText = (item: ChecklistItem): string => {
    return item.label || (item as any).text || 'Item';
  };

  const handleAddItem = () => {
    if (!newItemLabel.trim()) return;
    onAddItem(newItemLabel.trim());
    setNewItemLabel('');
    setShowAddItem(false);
  };

  return (
    <div className={`bg-white border rounded-lg overflow-hidden h-full ${
      isComplete ? 'border-green-300 bg-green-50/30' : 
      isInactive ? 'border-gray-200 bg-gray-100/80 opacity-75' : ''
    }`}>
      {/* En-tête */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isInactive ? 'bg-gray-200/60' : 'bg-gray-50'
      }`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={`font-medium text-sm truncate ${isInactive ? 'text-gray-400' : ''}`}>
              {isInactive && '🔒 '}{checklist.title}
            </h4>
            {isComplete && <Badge className="text-xs bg-green-100 text-green-700">✅</Badge>}
            {isInactive && (
              <Badge className="text-xs bg-gray-200 text-gray-500 border-gray-300">Désactivée</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={checklist.percentage || 0} className="h-1.5 w-24" />
            <span className="text-xs text-muted-foreground">
              {checklist.completed_items}/{checklist.total_items}
            </span>
          </div>
          {/* Infos tâche liée */}
          {linkedTask && (
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-xs text-muted-foreground">
                📌 {linkedTask.title.substring(0, 40)}{linkedTask.title.length > 40 ? '…' : ''}
              </span>
              {linkedTask.assignee && ASSIGNEE_LABELS[linkedTask.assignee] && (
                <Badge variant="outline" className="text-xs">👤 {ASSIGNEE_LABELS[linkedTask.assignee]}</Badge>
              )}
              {!linkedTask.active && (
                <Badge variant="outline" className="text-xs border-gray-300 bg-gray-100 text-gray-500">⏸️ Inactive</Badge>
              )}
              {linkedTask.is_phase_validation && (
                <Badge className="text-xs bg-purple-100 text-purple-700">🔒 Validation</Badge>
              )}
            </div>
          )}
          {/* Lien tâche (si pas déjà liée) */}
          {!linkedTask && tasks.length > 0 && (
            <div className="mt-1.5">
              <select
                value={checklist.task_id || ''}
                onChange={(e) => onLinkTask(e.target.value || null)}
                className="text-xs w-full p-1 border rounded bg-white"
              >
                <option value="">🔗 Lier à une tâche</option>
                {tasks.filter(t => t.active).map(task => (
                  <option key={task.id} value={task.id}>
                    📌 {task.title.substring(0, 50)} {task.is_phase_validation ? '🔒' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 text-xs shrink-0" onClick={onDelete}>
          ✕
        </Button>
      </div>

      {/* Items */}
      <div className="divide-y max-h-[300px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun item. Ajoutez la première étape.
          </div>
        ) : (
          items.map((item: ChecklistItem, idx: number) => (
            <div
              key={item.id || idx}
              className={`flex items-start gap-3 px-4 py-2.5 ${item.done ? 'bg-green-50/50' : ''}`}
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={(checked) => {
                  if (isLocked) return; // 🔒 Bloqué
                  // 📸 Vérification photo obligatoire
                  if (checked && hasMissingPhotos(item)) {
                    setPendingCheckItem({ item, idx });
                    setShowPhotoDialog(true);
                    return;
                  }
                  onToggleItem(item.id, !!checked, 'user', idx, !!checked);
                }}
                className={`mt-0.5 ${isLocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                disabled={isLocked}
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                  {item.label || item.text}
                </p>
                {item.done && item.done_by && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ✓ Fait par {item.done_by}
                    {item.done_at && ` · ${new Date(item.done_at).toLocaleDateString('fr-FR')}`}
                  </p>
                )}
              </div>
              {item.required_image && !item.image_url && getItemImages(item).length === 0 && (
                <PhotoUploadButton
                  projectId={checklist.project_id}
                  taskId={checklist.task_id}
                  itemId={item.id || `item-${idx}`}
                  onUploaded={(url) => {
                    const existingGallery = getItemImages(item);
                    const newGallery = [...existingGallery, url];
                    onToggleItem(item.id, true, 'user', idx, true, newGallery);
                  }}
                  size="sm"
                  disabled={isLocked}
                />
              )}
              {getItemImages(item).length > 0 && (
                <PhotoGallery images={getItemImages(item)} maxDisplay={3} />
              )}
            </div>
          ))
        )}
      </div>

      {/* Ajout d'item — masqué si checklist inactive */}
      {isLocked ? null : showAddItem ? (
        <div className="px-4 py-2 border-t bg-gray-50/50">
          <Input
            autoFocus
            placeholder="Nouvel item..."
            className="text-sm h-8"
            value={newItemLabel}
            onChange={(e) => setNewItemLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddItem();
              if (e.key === 'Escape') { setShowAddItem(false); setNewItemLabel(''); }
            }}
          />
          {newItemLabel.trim() && (
            <div className="flex gap-1 mt-1.5">
              <Button size="sm" className="h-7 text-xs" onClick={handleAddItem}>
                Ajouter
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddItem(false); setNewItemLabel(''); }}>
                Annuler
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowAddItem(true)}
          >
            <Plus className="h-3 w-3 mr-1" /> Ajouter un item
          </Button>
        </div>
      )}
      {/* En mode inactif, on affiche un message à la place */}
      {isLocked && (
        <div className="px-4 py-3 border-t bg-gray-100/50 text-center">
          <p className="text-xs text-gray-400">🔒 Checklist verrouillée — tâche en attente de dépendance</p>
        </div>
      )}

      {/* 📸 Dialogue photo obligatoire */}
      <PhotoRequiredDialog
        open={showPhotoDialog}
        itemLabel={pendingCheckItem ? getItemText(pendingCheckItem.item) : ''}
        onTakePhoto={() => setShowPhotoDialog(false)}
        onSkip={() => {
          setShowPhotoDialog(false);
          setPendingCheckItem(null);
        }}
        onCancel={() => {
          setShowPhotoDialog(false);
          setPendingCheckItem(null);
        }}
      />
    </div>
  );
};
