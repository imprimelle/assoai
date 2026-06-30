import React, { useState } from 'react';
import { useProcedures, Procedure, GenerationRules } from '@/hooks/useProcedures';
import { usePhaseRules } from '@/hooks/usePhaseRules';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight, GitBranch, List, Settings2 } from 'lucide-react';
import { ProcedureLinkedBox } from '@/components/projects/ProcedureLinkedBox';

const PHASES = ['facturation', 'commande', 'fabrication', 'livraison'] as const;
const PHASE_ICONS: Record<string, string> = {
  facturation: '🔵', commande: '🟠', fabrication: '🟣', livraison: '🟢',
};
const PHASE_SHORT: Record<string, string> = {
  facturation: 'Factu.', commande: 'Cde.', fabrication: 'Fab.', livraison: 'Livr.',
};
const PHASE_LABELS: Record<string, string> = {
  facturation: 'Facturation', commande: 'Commande', fabrication: 'Fabrication', livraison: 'Livraison',
};
const ROLES = ['commerciale', 'chef_technique', 'technicien_adjoint', 'superviseur_logistique', 'directeur', 'directrice_adjointe'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];
const GEN_MODES = ['statique', 'projection_cdc', 'par_enseigne'] as const;
const GEN_MODE_LABELS: Record<string, string> = {
  statique: '📋 Items fixes',
  projection_cdc: '🔄 Projection CDC',
  par_enseigne: '🏗️ Par enseigne',
};
const CDC_SECTIONS = ['Découpe', 'Éclairage', 'Métal', 'Outillage', 'Vinyle'];
const ITEM_VARIABLES = ['{nom}', '{dimensions}', '{quantité}', '{couleur}', '{unite}', '{reference}'];
const ENSEIGNE_VARIABLES = ['{enseigne.nom}', '{enseigne.dimensions}', '{enseigne.type_detecte}', '{enseigne.complexite}'];
const DOCUMENTS_CONTEXTE = ['cdc', 'facture', 'commande', 'devis'] as const;
const DOC_LABELS: Record<string, string> = {
  cdc: '📘 CDC',
  facture: '🧾 Facture',
  commande: '📦 Commande',
  devis: '💰 Devis',
};

interface EditForm {
  id?: string;
  phase: string;
  task_title: string;
  task_assignee: string;
  task_priority: string;
  task_due_days: number;
  checklist_title: string;
  checklist_items: string;
  instructions: string;
  generation_rules: GenerationRules | null;
  depends_on_order: number | null;
  depends_on_procedure_id: string | null;
  is_phase_validation: boolean;
  required_image: boolean;
  depends_description: string;
}

const emptyRules = (mode: GenerationRules['mode'] = 'statique'): GenerationRules => {
  if (mode === 'statique') return { mode: 'statique' };
  if (mode === 'projection_cdc') return { mode: 'projection_cdc', source: { sections: [] }, item_template: '', fixed_items: [] };
  if (mode === 'par_enseigne') return { mode: 'par_enseigne', title_template: '', fixed_items: [] };
  return { mode: 'statique' };
};

const emptyForm: EditForm = {
  phase: 'facturation',
  task_title: '',
  task_assignee: 'chef_technique',
  task_priority: 'medium',
  task_due_days: 3,
  checklist_title: '',
  checklist_items: '',
  instructions: '',
  generation_rules: null,
  depends_on_order: null,
  depends_on_procedure_id: null,
  is_phase_validation: false,
  required_image: false,
  depends_description: '',
};

const Procedures: React.FC = () => {
  const [activePhase, setActivePhase] = useState('facturation');
  const { procedures, isLoading, createProcedure, updateProcedure, deleteProcedure } = useProcedures();
  const { rules: phaseRules, updateRule } = usePhaseRules(activePhase);
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'linked'>('linked');

  const filtered = (procedures || []).filter(p => p.phase === activePhase);

  const toggleExpand = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const setMode = (mode: GenerationRules['mode']) => {
    setEditForm(prev => ({
      ...prev,
      generation_rules: emptyRules(mode),
    }));
  };

  const handleSave = async () => {
    const genMode = editForm.generation_rules?.mode || 'statique';
    const items = genMode === 'statique'
      ? editForm.checklist_items
          .split('\n')
          .filter(l => l.trim())
          .map(text => ({ text: text.trim() }))
      : [];

    const data = {
      phase: editForm.phase,
      task_title: editForm.task_title,
      task_assignee: editForm.task_assignee,
      task_priority: editForm.task_priority,
      task_due_days: editForm.task_due_days,
      checklist_title: editForm.checklist_title || null,
      checklist_items: items,
      instructions: editForm.instructions || null,
      generation_rules: editForm.generation_rules || null,
      depends_on_order: editForm.depends_on_order ?? null,
      depends_on_procedure_id: editForm.depends_on_procedure_id || null,
      is_phase_validation: editForm.is_phase_validation,
      required_image: editForm.required_image,
      depends_description: editForm.depends_description || null,
    };

    if (editingId) {
      await updateProcedure.mutateAsync({ id: editingId, ...data });
    } else {
      await createProcedure.mutateAsync(data);
    }
    setDialogOpen(false);
    setEditForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (p: Procedure) => {
    setEditForm({
      id: p.id,
      phase: p.phase,
      task_title: p.task_title,
      task_assignee: p.task_assignee,
      task_priority: p.task_priority,
      task_due_days: p.task_due_days,
      checklist_title: p.checklist_title || '',
      checklist_items: (p.checklist_items || []).map(i => i.text).join('\n'),
      instructions: p.instructions || '',
      generation_rules: p.generation_rules || null,
      depends_on_order: p.depends_on_order ?? null,
      depends_on_procedure_id: p.depends_on_procedure_id || null,
      is_phase_validation: p.is_phase_validation || false,
      required_image: p.required_image || false,
      depends_description: p.depends_description || '',
    });
    setEditingId(p.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette procédure ?')) {
      await deleteProcedure.mutateAsync(id);
    }
  };

  const handleLink = async (sourceId: string, targetId: string) => {
    await updateProcedure.mutateAsync({
      id: sourceId,
      depends_on_procedure_id: targetId,
    } as any);
  };

  const handleUnlink = async (sourceId: string) => {
    await updateProcedure.mutateAsync({
      id: sourceId,
      depends_on_procedure_id: null,
    } as any);
  };

  const genRules = editForm.generation_rules;
  const genMode = genRules?.mode || 'statique';

  // ── Render procedure detail (shared between list & linked box) ──────
  const renderProcedureDetail = (p: Procedure) => {
    const items = p.checklist_items || [];
    const rules = p.generation_rules;
    const rulesMode = rules?.mode || 'statique';
    return (
      <>
        {p.instructions && (
          <div className="mb-3 p-2.5 bg-blue-50 border border-blue-100 rounded text-sm text-blue-900">
            <p className="text-xs font-medium text-blue-700 mb-0.5">💡 Instructions agent</p>
            <p className="text-sm leading-relaxed">{p.instructions}</p>
          </div>
        )}
        {rules && (
          <div className="mb-3 p-2.5 bg-green-50 border border-green-100 rounded text-sm">
            <p className="text-xs font-medium text-green-700 mb-0.5">🧬 Règles de génération — {GEN_MODE_LABELS[rulesMode]}</p>
            {rulesMode === 'statique' && (
              <div className="text-sm text-green-800 space-y-1">
                <p>Items fixes : le PM crée la checklist avec les items d'exemple tels quels.</p>
                {rules.contexte?.documents && rules.contexte.documents.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className="text-xs text-green-600">📚 Contexte :</span>
                    {rules.contexte.documents.map(d => (
                      <Badge key={d} className="text-xs bg-amber-100 text-amber-700 border-amber-200">{DOC_LABELS[d]}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            {rulesMode === 'projection_cdc' && rules.source && (
              <div className="text-sm text-green-800 space-y-1">
                <p>Sections CDC : <strong>{rules.source.sections.join(', ')}</strong></p>
                <p>Template : <code className="text-xs bg-green-100 px-1 rounded">{rules.item_template}</code></p>
                {rules.source.action_mapping && Object.keys(rules.source.action_mapping).length > 0 && (
                  <p>Mapping : {Object.entries(rules.source.action_mapping).map(([k, v]) => `${k}→${v}`).join(', ')}</p>
                )}
                {rules.fixed_items && rules.fixed_items.length > 0 && (
                  <p>+ {rules.fixed_items.length} item(s) fixe(s)</p>
                )}
              </div>
            )}
            {rulesMode === 'par_enseigne' && (
              <div className="text-sm text-green-800 space-y-1">
                <p>Titre : <code className="text-xs bg-green-100 px-1 rounded">{rules.title_template}</code></p>
                {rules.fixed_items && <p>{rules.fixed_items.length} items de base</p>}
                {rules.contexte?.documents && rules.contexte.documents.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap mt-1">
                    <span className="text-xs text-green-600">📚 Contexte :</span>
                    {rules.contexte.documents.map(d => (
                      <Badge key={d} className="text-xs bg-amber-100 text-amber-700 border-amber-200">{DOC_LABELS[d]}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {p.depends_description && (
          <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded text-sm">
            <p className="text-xs font-medium text-amber-700 mb-0.5">🔗 Description de la dépendance</p>
            <p className="text-sm leading-relaxed text-amber-900">{p.depends_description}</p>
          </div>
        )}
        {p.is_phase_validation && (
          <div className="mb-3 p-2.5 bg-purple-50 border border-purple-200 rounded text-sm">
            <p className="text-xs font-medium text-purple-700 mb-0.5">🔒 Tâche de validation</p>
            <p className="text-sm leading-relaxed text-purple-900">
              Cette tâche est la <strong>validation de phase</strong>. Elle sera automatiquement activée quand toutes les autres tâches de la phase seront terminées à 100%. Une fois complétée, elle déclenchera le passage à la phase suivante.
            </p>
          </div>
        )}
        {items.length > 0 && (rulesMode === 'statique' || !rules) && (
          <div className="mt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1.5">
              📋 {p.checklist_title || 'Checklist'} ({items.length} items)
            </p>
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="h-3.5 w-3.5 rounded border border-gray-300 flex items-center justify-center text-[10px] text-transparent">✓</span>
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  if (isLoading) return <div className="container mx-auto px-4 py-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-full">
      {/* ── Header row ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold">📋 Procédures</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">
            Configuration des procédures par phase de projet
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="sm:size-default"
              onClick={() => { setEditForm({...emptyForm, phase: activePhase, generation_rules: null}); setEditingId(null); }}>
              <Plus className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Nouvelle procédure</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            {/* ── Edit form (unchanged) ──────────────────────────────── */}
            <DialogHeader>
              <DialogTitle>{editingId ? 'Modifier' : 'Nouvelle'} procédure — {PHASE_ICONS[activePhase]} {PHASE_LABELS[activePhase]}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <Select value={editForm.phase} onValueChange={v => setEditForm({...editForm, phase: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PHASES.map(p => <SelectItem key={p} value={p}>{PHASE_ICONS[p]} {PHASE_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="Titre de la tâche" value={editForm.task_title} onChange={e => setEditForm({...editForm, task_title: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                <Select value={editForm.task_assignee} onValueChange={v => setEditForm({...editForm, task_assignee: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={editForm.task_priority} onValueChange={v => setEditForm({...editForm, task_priority: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Input type="number" placeholder="Délai (jours)" value={editForm.task_due_days} onChange={e => setEditForm({...editForm, task_due_days: Number(e.target.value)})} />
              <Input placeholder="Titre de la checklist" value={editForm.checklist_title} onChange={e => setEditForm({...editForm, checklist_title: e.target.value})} />

              {/* Mode de génération */}
              <div className="border rounded-md p-3 bg-blue-50/50">
                <p className="text-xs font-medium text-blue-700 mb-2">🧬 Mode de génération des items</p>
                <Select value={genMode} onValueChange={v => setMode(v as GenerationRules['mode'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GEN_MODES.map(m => <SelectItem key={m} value={m}>{GEN_MODE_LABELS[m]}</SelectItem>)}
                  </SelectContent>
                </Select>

                {genMode === 'statique' && (
                  <div className="mt-3">
                    <Textarea placeholder={`Items de la checklist (un par ligne)\nEx:\nVérifier acompte reçu\nConfirmer montant facture`}
                      rows={5} value={editForm.checklist_items}
                      onChange={e => setEditForm({...editForm, checklist_items: e.target.value})} />
                    <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs font-medium text-amber-700 mb-1.5">📚 Contexte documentaire (optionnel)</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DOCUMENTS_CONTEXTE.map(doc => {
                          const selected = genRules?.contexte?.documents?.includes(doc) || false;
                          return (
                            <Badge key={doc} variant={selected ? 'default' : 'outline'}
                              className={`cursor-pointer text-xs ${selected ? 'bg-amber-600 hover:bg-amber-700' : 'hover:bg-amber-50'}`}
                              onClick={() => {
                                const docs = genRules?.contexte?.documents || [];
                                const updated = selected ? docs.filter(d => d !== doc) : [...docs, doc];
                                setEditForm({...editForm, generation_rules: {...genRules!, contexte: { documents: updated }}});
                              }}>{DOC_LABELS[doc]}</Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {genMode === 'projection_cdc' && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs text-muted-foreground">Sections du CDC à projeter :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {CDC_SECTIONS.map(s => {
                        const selected = genRules?.source?.sections?.includes(s) || false;
                        return (
                          <Badge key={s} variant={selected ? 'default' : 'outline'}
                            className={`cursor-pointer text-xs ${selected ? 'bg-blue-600 hover:bg-blue-700' : 'hover:bg-blue-50'}`}
                            onClick={() => {
                              const sections = genRules?.source?.sections || [];
                              const updated = selected ? sections.filter(x => x !== s) : [...sections, s];
                              setEditForm({...editForm, generation_rules: {...genRules!, source: {...genRules?.source, sections: updated}}});
                            }}>{s}</Badge>
                        );
                      })}
                      <Badge variant="outline" className="cursor-pointer text-xs bg-gray-100 hover:bg-gray-200"
                        onClick={() => {
                          const allSelected = genRules?.source?.sections?.length === CDC_SECTIONS.length;
                          setEditForm({...editForm, generation_rules: {...genRules!, source: {...genRules?.source, sections: allSelected ? [] : [...CDC_SECTIONS]}}});
                        }}>
                        {genRules?.source?.sections?.length === CDC_SECTIONS.length ? '✕ Tout' : '☐ Tout'}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Template des items <span className="text-blue-600">(variables : {ITEM_VARIABLES.join(', ')})</span>
                      </p>
                      <Input placeholder="ex: {action} {nom} - {dimensions} ({quantité})"
                        value={genRules?.item_template || ''}
                        onChange={e => setEditForm({...editForm, generation_rules: {...genRules!, item_template: e.target.value}})}
                        className="text-sm font-mono" />
                    </div>
                    {genRules?.source?.sections && genRules.source.sections.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-muted-foreground">Préfixes par section (optionnel) :</p>
                        {genRules.source.sections.map(s => (
                          <div key={s} className="flex items-center gap-2">
                            <span className="text-xs w-20 shrink-0">{s}</span>
                            <Input placeholder="ex: Découpe:" className="h-7 text-xs font-mono"
                              value={genRules?.source?.action_mapping?.[s] || ''}
                              onChange={e => {
                                const am = { ...(genRules?.source?.action_mapping || {}) };
                                if (e.target.value) am[s] = e.target.value; else delete am[s];
                                setEditForm({...editForm, generation_rules: {...genRules!, source: {...genRules!.source!, action_mapping: am}}});
                              }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">➕ Items fixes :</p>
                      <Textarea placeholder="Faire le devis général" rows={2}
                        value={(genRules?.fixed_items || []).join('\n')}
                        onChange={e => setEditForm({...editForm, generation_rules: {...genRules!, fixed_items: e.target.value.split('\n').filter(l => l.trim())}})}
                        className="text-sm" />
                    </div>
                  </div>
                )}

                {genMode === 'par_enseigne' && (
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Template du titre <span className="text-purple-600">(variables : {ENSEIGNE_VARIABLES.join(', ')})</span>
                      </p>
                      <Input placeholder="ex: {enseigne.nom} {enseigne.dimensions}"
                        value={genRules?.title_template || ''}
                        onChange={e => setEditForm({...editForm, generation_rules: {...genRules!, title_template: e.target.value}})}
                        className="text-sm font-mono" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Items de base (un par ligne) :</p>
                      <Textarea
                        placeholder={`Fabrication de la boxe métallique\nContrecollage du vinyle imprimé\nCâblage électriques/LEDs\nAssemblage du caisson\nTest éclairage\nContrôle qualité final`}
                        rows={6}
                        value={(genRules?.fixed_items || []).join('\n')}
                        onChange={e => setEditForm({...editForm, generation_rules: {...genRules!, fixed_items: e.target.value.split('\n').filter(l => l.trim())}})}
                        className="text-sm" />
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
                      <p className="text-xs font-medium text-amber-700 mb-1.5">📚 Contexte documentaire</p>
                      <div className="flex flex-wrap gap-1.5">
                        {DOCUMENTS_CONTEXTE.map(doc => {
                          const selected = genRules?.contexte?.documents?.includes(doc) || false;
                          return (
                            <Badge key={doc} variant={selected ? 'default' : 'outline'}
                              className={`cursor-pointer text-xs ${selected ? 'bg-amber-600 hover:bg-amber-700' : 'hover:bg-amber-50'}`}
                              onClick={() => {
                                const docs = genRules?.contexte?.documents || [];
                                const updated = selected ? docs.filter(d => d !== doc) : [...docs, doc];
                                setEditForm({...editForm, generation_rules: {...genRules!, contexte: { documents: updated }}});
                              }}>{DOC_LABELS[doc]}</Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Textarea placeholder="Instructions pour l'agent (quand, comment, contexte : projet, CDC, facture, commande...)" rows={3}
                value={editForm.instructions} onChange={e => setEditForm({...editForm, instructions: e.target.value})} />

              <div className="border rounded-md p-3 bg-gray-50/50">
                <p className="text-xs font-medium text-muted-foreground mb-2">🔗 Dépendance (optionnel)</p>
                <Select value={editForm.depends_on_procedure_id || '__none__'} onValueChange={v => {
                  setEditForm({...editForm, depends_on_procedure_id: v === '__none__' ? null : v});
                }}>
                  <SelectTrigger><SelectValue placeholder="Indépendante (aucune dépendance)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Indépendante (active dès le début)</SelectItem>
                    {filtered.filter(p => !p.is_phase_validation && p.id !== editingId).map(p => (
                      <SelectItem key={p.id} value={p.id}>Dépend de : {p.task_title} (order {p.order})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editForm.depends_on_order !== null && (
                  <Input className="mt-2" placeholder="Description (ex: 'Attendre que la découpe soit finie')"
                    value={editForm.depends_description}
                    onChange={e => setEditForm({...editForm, depends_description: e.target.value})} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="is-validation" checked={editForm.is_phase_validation}
                  onChange={e => setEditForm({...editForm, is_phase_validation: e.target.checked})}
                  className="h-4 w-4 rounded border-gray-300 text-brand-orange focus:ring-brand-orange" />
                <label htmlFor="is-validation" className="text-sm text-muted-foreground">
                  🔒 Tâche de validation de phase
                </label>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="requires-photo" checked={editForm.required_image}
                  onChange={e => setEditForm({...editForm, required_image: e.target.checked})}
                  className="h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-400" />
                <label htmlFor="requires-photo" className="text-sm text-muted-foreground">
                  📸 Checklist avec photos obligatoires
                </label>
              </div>
              <Button onClick={handleSave} disabled={!editForm.task_title}><Save className="h-4 w-4 mr-1" /> Sauvegarder</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Tabs row — always fully visible ───────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 flex-nowrap overflow-x-auto">
        {/* Phase tabs */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          {PHASES.map(p => (
            <button
              key={p}
              onClick={() => setActivePhase(p)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                activePhase === p
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span className="text-sm sm:text-base">{PHASE_ICONS[p]}</span>
              <span className="hidden sm:inline">{PHASE_LABELS[p]}</span>
              <span className="sm:hidden">{PHASE_SHORT[p]}</span>
              <span className="text-[10px] text-muted-foreground ml-0.5">
                {filtered.filter(x => x.phase === p || activePhase === p ? true : false).length || (activePhase === p ? filtered.length : '')}
              </span>
            </button>
          ))}
        </div>

        {/* Count badge */}
        <Badge variant="outline" className="text-[10px] h-6 flex-shrink-0 hidden sm:inline-flex">
          {filtered.length} procédure{filtered.length !== 1 ? 's' : ''}
        </Badge>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Rules button */}
        <Dialog open={rulesDialogOpen} onOpenChange={setRulesDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 text-xs flex-shrink-0"
              onClick={() => {
                setRulesDraft(phaseRules?.[0]?.checklist_rules || '');
                setEditingRules(false);
              }}>
              <Settings2 className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Règles {PHASE_SHORT[activePhase]}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>📐 Règles d'élaboration — {PHASE_ICONS[activePhase]} {PHASE_LABELS[activePhase]}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Guide le PM sur le contenu, la structure, les points de vigilance et les éléments obligatoires des checklists de cette phase.
              </p>
              {!editingRules ? (
                <div>
                  {phaseRules?.[0]?.checklist_rules ? (
                    <>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-gray-50 p-3 rounded-md border">
                        {phaseRules[0].checklist_rules}
                      </p>
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setEditingRules(true)}>
                        <Pencil className="h-3 w-3 mr-1" /> Modifier
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground italic mb-3">
                        Aucune règle définie pour cette phase.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setEditingRules(true)}>
                        <Plus className="h-3 w-3 mr-1" /> Définir des règles
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Règles pour élaborer les checklists de cette phase. Guide le PM sur le contenu, la structure, les points de vigilance, les éléments obligatoires..."
                    rows={5}
                    value={rulesDraft}
                    onChange={e => setRulesDraft(e.target.value)}
                    className="text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingRules(false)}>
                      <X className="h-3 w-3 mr-1" /> Annuler
                    </Button>
                    <Button size="sm" onClick={async () => {
                      await updateRule.mutateAsync({ phase: activePhase, checklist_rules: rulesDraft });
                      setEditingRules(false);
                    }}>
                      <Save className="h-3 w-3 mr-1" /> Sauvegarder
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('linked')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              viewMode === 'linked' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Box</span>
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
              viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Liste</span>
          </button>
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────── */}
      {viewMode === 'linked' ? (
        <ProcedureLinkedBox
          procedures={filtered}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onLink={handleLink}
          onUnlink={handleUnlink}
          onCreate={() => {
            setEditForm({...emptyForm, phase: activePhase, generation_rules: null});
            setEditingId(null);
            setDialogOpen(true);
          }}
          onViewDetails={renderProcedureDetail}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(p => {
            const isExpanded = expandedCards.has(p.id);
            const rules = p.generation_rules;
            const rulesMode = rules?.mode || 'statique';
            return (
              <Card key={p.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="py-3 px-4 cursor-pointer" onClick={() => toggleExpand(p.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <CardTitle className="text-sm font-semibold truncate">{p.task_title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleEdit(p); }}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 ml-6">
                    {p.is_phase_validation && (
                      <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">🔒 Validation phase</Badge>
                    )}
                    {rules && (
                      <Badge className={`text-xs ${rulesMode === 'projection_cdc' ? 'bg-blue-100 text-blue-700 border-blue-200' : rulesMode === 'par_enseigne' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {GEN_MODE_LABELS[rulesMode]}
                      </Badge>
                    )}
                    {p.depends_on_procedure_id && (
                      <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-700">
                        🔗 Dépend de : {(procedures || []).find(pp => pp.id === p.depends_on_procedure_id)?.task_title || '?'}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">👤 {p.task_assignee}</Badge>
                    <Badge variant="outline" className={`text-xs ${p.task_priority === 'critical' ? 'text-red-700 bg-red-50' : p.task_priority === 'high' ? 'text-orange-700 bg-orange-50' : ''}`}>
                      {p.task_priority}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">⏰ {p.task_due_days} jours</Badge>
                    {p.required_image && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">📸 Photo</Badge>}
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="px-6 pb-4 pt-0">
                    {renderProcedureDetail(p)}
                  </CardContent>
                )}
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              <p>Aucune procédure pour la phase {PHASE_LABELS[activePhase]}</p>
              <Button variant="outline" className="mt-2" onClick={() => { setEditForm({...emptyForm, phase: activePhase, generation_rules: null}); setEditingId(null); setDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Procedures;
