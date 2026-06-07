import React, { useState } from 'react';
import { Checklist, ChecklistItem, ChecklistSection, ChecklistFormData } from '@/types/checklist';
import { useChecklists } from '@/hooks/useChecklists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, CheckCircle2, Clock, Camera } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useIsMobile } from '@/hooks/use-mobile';

interface ChecklistPanelProps {
  projectId: string;
}

export const ChecklistPanel: React.FC<ChecklistPanelProps> = ({ projectId }) => {
  const { checklists, isLoading, createChecklist, toggleItem, deleteChecklist } = useChecklists(projectId);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState<ChecklistSection>('fabrication');
  const [showAdd, setShowAdd] = useState(false);
  const isMobile = useIsMobile();

  const handleCreate = () => {
    if (!newTitle.trim()) return;
    createChecklist.mutate({
      project_id: projectId,
      title: newTitle.trim(),
      section: newSection,
    });
    setNewTitle('');
    setShowAdd(false);
  };

  if (isLoading) {
    return <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-orange"></div>
    </div>;
  }

  const grouped = (checklists || []).reduce((acc, cl) => {
    const section = cl.section || 'autre';
    if (!acc[section]) acc[section] = [];
    acc[section].push(cl);
    return acc;
  }, {} as Record<string, Checklist[]>);

  const totalProgress = checklists && checklists.length > 0
    ? Math.round(checklists.reduce((sum, c) => sum + (c.percentage || 0), 0) / checklists.length)
    : 0;

  return (
    <div className="space-y-6">
      {/* Progression globale */}
      {checklists && checklists.length > 0 && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Progression globale</h3>
            <Badge variant="secondary">{totalProgress}%</Badge>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </div>
      )}

      {/* Checklists par section */}
      {Object.keys(grouped).length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
          <p>Aucune checklist pour ce projet.</p>
          <Button variant="outline" className="mt-3" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Créer une checklist
          </Button>
        </div>
      ) : (
        Object.entries(grouped).map(([section, sectionChecklists]) => (
          <div key={section}>
            <h3 className="font-semibold text-sm uppercase text-muted-foreground mb-3">
              {section}
            </h3>
            <div className="space-y-4">
              {sectionChecklists.map(checklist => (
                <ChecklistCard
                  key={checklist.id}
                  checklist={checklist}
                  onToggleItem={(itemId, done, doneBy) =>
                    toggleItem.mutate({ checklistId: checklist.id, itemId, done, doneBy })
                  }
                  onDelete={() => deleteChecklist.mutate(checklist.id)}
                />
              ))}
            </div>
          </div>
        ))
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

      {!showAdd && checklists && checklists.length > 0 && (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="w-full">
          <Plus className="h-4 w-4 mr-1" /> Ajouter une checklist
        </Button>
      )}
    </div>
  );
};

// Carte de checklist individuelle
const ChecklistCard: React.FC<{
  checklist: Checklist;
  onToggleItem: (itemId: string, done: boolean, doneBy?: string) => void;
  onDelete: () => void;
}> = ({ checklist, onToggleItem, onDelete }) => {
  const [newItemLabel, setNewItemLabel] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const isMobile = useIsMobile();

  const items = checklist.items || [];

  // @todo: handle adding items via hook

  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      {/* En-tête */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{checklist.title}</h4>
          <div className="flex items-center gap-2 mt-1">
            <Progress value={checklist.percentage || 0} className="h-1.5 w-24" />
            <span className="text-xs text-muted-foreground">
              {checklist.completed_items}/{checklist.total_items}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-600 h-7 text-xs" onClick={onDelete}>
          ✕
        </Button>
      </div>

      {/* Items */}
      <div className="divide-y">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            Aucun item. Ajoutez la première étape.
          </div>
        ) : (
          items.map((item: ChecklistItem) => (
            <div
              key={item.id}
              className={`flex items-start gap-3 px-4 py-2.5 ${item.done ? 'bg-green-50/50' : ''}`}
            >
              <Checkbox
                checked={item.done}
                onCheckedChange={(checked) => onToggleItem(item.id, !!checked, 'user')}
                className="mt-0.5"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${item.done ? 'line-through text-muted-foreground' : ''}`}>
                  {item.label}
                </p>
                {item.done && item.done_by && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ✓ Fait par {item.done_by}
                    {item.done_at && ` · ${new Date(item.done_at).toLocaleDateString('fr-FR')}`}
                  </p>
                )}
              </div>
              {item.required_image && !item.image_url && (
                <Camera className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              )}
              {item.image_url && (
                <img src={item.image_url} alt="Preuve" className="h-8 w-8 rounded object-cover shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
