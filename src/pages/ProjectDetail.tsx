import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft, FileText, KanbanSquare, CheckSquare,
  Clock, FolderOpen, Image, ChevronDown, ChevronUp,
  Phone, PhoneCall, MapPin, User, Banknote, Calendar,
  Maximize2, X, GitBranch,
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { KanbanBoard } from '@/components/projects/KanbanBoard';
import { ChecklistPanel } from '@/components/projects/ChecklistPanel';
import { useProjectHealth } from '@/hooks/useProjectHealth';
import { useProjectDocuments, type ProjectDocument } from '@/hooks/useProjectDocuments';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import { useChecklists } from '@/hooks/useChecklists';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DocumentLinkFAB } from '@/components/projects/DocumentLinkFAB';
import { DocumentSearchDialog } from '@/components/projects/DocumentSearchDialog';
import { Rocket, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { ProjectDocumentAccordion } from '@/components/projects/ProjectDocumentAccordion';
import { ProjectMediaGallery } from '@/components/projects/ProjectMediaGallery';
import { TaskLinkedBox } from '@/components/projects/TaskLinkedBox';
import type { DocumentSearchResult } from '@/hooks/useDocumentSearch';

// Fix icônes Leaflet par défaut (bug Vite)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PHASE_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  facturation: { color: 'text-blue-700', bg: 'bg-blue-50', label: 'Facturation', icon: '🔵' },
  commande: { color: 'text-orange-700', bg: 'bg-orange-50', label: 'Commande', icon: '🟠' },
  fabrication: { color: 'text-purple-700', bg: 'bg-purple-50', label: 'Fabrication', icon: '🟣' },
  livraison: { color: 'text-green-700', bg: 'bg-green-50', label: 'Livraison', icon: '🟢' },
  termine: { color: 'text-gray-500', bg: 'bg-gray-100', label: 'Terminé', icon: '⚫' },
};

// ── Carte plein écran (zoom/scroll actifs) ──
const FullscreenMap: React.FC<{ lat: number; lng: number; label: string }> = ({ lat, lng, label }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mapRef.current) return;
    const map = L.map(mapRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: true,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.circleMarker([lat, lng], {
      radius: 8,
      fillColor: '#EF4444',
      fillOpacity: 0.9,
      color: '#FFFFFF',
      weight: 2.5,
    }).addTo(map).bindPopup(label).openPopup();
    return () => { map.remove(); };
  }, [lat, lng, label]);
  return <div ref={mapRef} className="w-full" style={{ height: '70vh' }} />;
};

// ── Dialogue galerie enseignes ──
const EnseignesDialog: React.FC<{ enseignes: any[]; open: boolean; onClose: () => void; clientName: string }> = ({
  enseignes, open, onClose, clientName,
}) => {
  const enseignesWithImages = enseignes.filter((e: any) => e.details?.image_url);
  if (enseignesWithImages.length === 0) return null;
  const [selected, setSelected] = useState(0);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Enseignes — {clientName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
            <img
              src={enseignesWithImages[selected]?.details?.image_url}
              alt={enseignesWithImages[selected]?.nom}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <p className="text-sm font-medium text-center">{enseignesWithImages[selected]?.nom}</p>
          {enseignesWithImages.length > 1 && (
            <div className="flex gap-2 justify-center flex-wrap">
              {enseignesWithImages.map((e: any, i: number) => (
                <button
                  key={e.id}
                  onClick={() => setSelected(i)}
                  className={`w-12 h-12 rounded border-2 overflow-hidden transition-all ${
                    i === selected ? 'border-brand-orange scale-110' : 'border-gray-200 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={e.details.image_url} alt={e.nom} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ProjectDetailProps {
  user: { id: string; name?: string } | null;
  persistentSessionId: string | null;
}

const ProjectDetail: React.FC<ProjectDetailProps> = ({ user, persistentSessionId }) => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, isLoading, deleteProject } = useProjects(user?.id, user?.role);
  const [activeTab, setActiveTab] = useState('documents');
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [highlightedChecklistTaskId, setHighlightedChecklistTaskId] = useState<string | null>(null);
  const [selectedFacture, setSelectedFacture] = useState<DocumentSearchResult | null>(null);
  const [dashboardExpanded, setDashboardExpanded] = useState(false);
  const [showEnseignesDialog, setShowEnseignesDialog] = useState(false);
  const [showMapDialog, setShowMapDialog] = useState(false);
  const isMobile = useIsMobile();
  const autoRestored = React.useRef(false);
  const queryClient = useQueryClient();

  const project = (projects || []).find(p => p.id === projectId);
  const { data: health } = useProjectHealth(projectId);
  const { data: projectDocuments } = useProjectDocuments(projectId);
  const { tasks } = useProjectTasks(projectId);
  const { checklists } = useChecklists(projectId);
  const [initializing, setInitializing] = useState(false);

  // ── Valeurs calculées ──
  const hasCDC = (projectDocuments || []).some(d => d.templateType === 'cahier_des_charges');
  const hasTasks = (tasks || []).length > 0;
  const showInitialize = hasCDC && !hasTasks;
  const doneTasks = (tasks || []).filter(t => t.kanban_column === 'termine');
  const totalTasks = (tasks || []).length;
  const phasePct = totalTasks > 0 ? Math.round((doneTasks.length / totalTasks) * 100) : 0;

  // ── Infos extraites des documents liés ──
  const commandeDoc = (projectDocuments || []).find(d => d.templateType === 'commande');
  const factureDoc = (projectDocuments || []).find(d => d.templateType === 'facture');
  const cdcDoc = (projectDocuments || []).find(d => d.templateType === 'cahier_des_charges');
  const cmdRaw = commandeDoc?.raw || {};
  const facRaw = factureDoc?.raw || {};
  const cdcRaw = cdcDoc?.raw || {};

  const clientName = cmdRaw.client?.nom || facRaw.client?.nom || '';
  const clientPhone = cmdRaw.client?.telephone || facRaw.client?.telephone || '';
  // Total : commande d'abord, facture en fallback
  const totalProjet = cmdRaw.total || facRaw.total || 0;
  // Avance : commande uniquement
  const avance = cmdRaw.details?.[0]?.montantAvance || 0;
  const reste = totalProjet - avance;
  const deliveryAddress = cmdRaw.deliveryAddress || facRaw.deliveryAddress || null;
  const dateLivraison = cmdRaw.dateLivraison || project?.date_livraison || '';
  const enseignes = cdcRaw.enseignes || [];

  // Handler de sélection de facture
  const handleSelectFacture = async (doc: DocumentSearchResult) => {
    if (doc.projectId && doc.projectId !== project?.id) {
      const proceed = window.confirm(
        `⚠️ Cette facture (${doc.numero}) est déjà liée à un autre projet.\n\n` +
        `La lier à ce projet la retirera de son projet actuel.\n\nContinuer ?`
      );
      if (!proceed) return;
    }
    setSelectedFacture(doc);
    if (doc.id && project?.id) {
      await supabase.from('messages').update({ project_id: project.id }).eq('id', doc.id);
    }
  };

  // Suppression du projet
  const handleDeleteProject = async () => {
    if (!project) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(project.id);
      supabase.from('communicator_queue').insert({
        project_id: project.id,
        direction: 'pm_to_communicator',
        action: 'project_deleted',
        status: 'pending',
        payload: { project_name: project.name, project_id: project.id },
      }).then(({ error }) => { if (error) console.error('Queue project_deleted insert error:', error); });
      setShowDeleteConfirm(false);
      navigate('/projects');
    } catch {
      setDeleting(false);
    }
  };

  React.useEffect(() => {
    if (autoRestored.current) return;
    if (!selectedFacture && projectDocuments && projectDocuments.length > 0) {
      const firstFacture = projectDocuments.find(d => d.templateType === 'facture');
      if (firstFacture) {
        autoRestored.current = true;
        setSelectedFacture({
          id: firstFacture.id, templateType: firstFacture.templateType, numero: firstFacture.numero,
          client: firstFacture.client, montant: firstFacture.montant, date: firstFacture.date, version: firstFacture.version,
        });
      }
    }
  }, [projectDocuments, selectedFacture]);

  React.useEffect(() => { autoRestored.current = false; }, [projectId]);
  React.useEffect(() => { if (activeTab === 'documents') queryClient.refetchQueries({ queryKey: ['project-health', projectId] }); }, [activeTab, projectId, queryClient]);

  if (!user || !persistentSessionId) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-4">Projet</h1>
        <p className="text-muted-foreground">Vous devez être connecté.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-64" /><Skeleton className="h-6 w-48" /><Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (!project) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <FolderOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Projet introuvable</h2>
        <p className="text-muted-foreground mb-4">Le projet demandé n'existe pas ou a été supprimé.</p>
        <Button onClick={() => navigate('/projects')}>← Retour aux projets</Button>
      </div>
    );
  }

  const phaseCfg = PHASE_CONFIG[project.phase || 'facturation'] || PHASE_CONFIG['facturation'];
  const templateCounts = {
    factures: (projectDocuments || []).filter(d => d.templateType === 'facture').length,
    commandes: (projectDocuments || []).filter(d => d.templateType === 'commande').length,
    devis: (projectDocuments || []).filter(d => d.templateType === 'devis').length,
    cdCs: (projectDocuments || []).filter(d => d.templateType === 'cahier_des_charges').length,
    total: (projectDocuments || []).length,
  };
  const scoreColor = health
    ? health.healthScore >= 80 ? 'text-green-600' : health.healthScore >= 40 ? 'text-amber-600' : 'text-red-600'
    : 'text-gray-400';

  return (
    <div className={`container mx-auto px-4 py-4 md:py-6 ${isMobile ? 'max-w-full' : ''}`}>
      {/* ── En-tête minimal ── */}
      <div className="flex items-center gap-3 mb-3">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold truncate leading-tight">{project.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-xs ${phaseCfg.color} ${phaseCfg.bg} border-0`}>
              {phaseCfg.icon} {phaseCfg.label}
            </Badge>
            {templateCounts.total > 0 && (
              <Badge variant="secondary" className="text-xs">{templateCounts.total} doc{templateCounts.total !== 1 ? 's' : ''}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* ── Dashboard collapsible ── */}
      <div className="mb-4 border rounded-lg overflow-hidden bg-white shadow-sm">
        <button
          onClick={() => setDashboardExpanded(!dashboardExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {totalTasks > 0 && (
              <div className="flex items-center gap-2 min-w-0 flex-1 max-w-[200px]">
                <div className="h-2 flex-1 bg-gray-200 rounded-full overflow-hidden min-w-[60px]">
                  <div className="h-full bg-brand-orange transition-all duration-500 rounded-full" style={{ width: `${phasePct}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-500 whitespace-nowrap">{phasePct}%</span>
              </div>
            )}
            <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
              {totalTasks > 0 ? `${doneTasks.length}/${totalTasks} tâches` : 'Aucune tâche'}
            </span>
            {health && (
              <span className={`text-sm font-bold whitespace-nowrap ${scoreColor}`}>Score {health.healthScore}%</span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {dashboardExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </button>

        {dashboardExpanded && (
          <div className="px-4 pb-4 border-t">
            {project.description && (
              <p className="text-sm text-muted-foreground pt-3 pb-2">{project.description}</p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {/* Client */}
              {clientName && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <User className="h-4 w-4 text-brand-orange mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Client</p>
                    <p className="text-sm font-semibold truncate">{clientName}</p>
                  </div>
                </div>
              )}

              {/* Contact */}
              {clientPhone && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <Phone className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Contact</p>
                    <a href={`tel:${clientPhone.replace(/\s/g, '')}`} className="text-sm font-semibold text-green-700 hover:underline flex items-center gap-1">
                      {clientPhone}
                      <PhoneCall className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Total */}
              {totalProjet > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <Banknote className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                    <p className="text-sm font-semibold">{totalProjet.toLocaleString()} FCFA</p>
                  </div>
                </div>
              )}

              {/* Avance */}
              {avance > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <Banknote className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avance</p>
                    <p className="text-sm font-semibold">{avance.toLocaleString()} FCFA</p>
                  </div>
                </div>
              )}

              {/* Reste à payer */}
              {totalProjet > 0 && avance > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <Banknote className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Reste à payer</p>
                    <p className="text-sm font-semibold">{reste.toLocaleString()} FCFA</p>
                  </div>
                </div>
              )}

              {/* Livraison */}
              {dateLivraison && (
                <div className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5">
                  <Calendar className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Livraison</p>
                    <p className="text-sm font-semibold">{format(new Date(dateLivraison), 'dd MMM yyyy', { locale: fr })}</p>
                  </div>
                </div>
              )}

              {/* Enseignes */}
              {enseignes.length > 0 && enseignes.some((e: any) => e.details?.image_url) && (
                <button
                  className="bg-gray-50 rounded-lg p-3 flex items-start gap-2.5 text-left hover:bg-gray-100 transition-colors"
                  onClick={() => setShowEnseignesDialog(true)}
                >
                  <Image className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Enseignes</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {enseignes.filter((e: any) => e.details?.image_url).slice(0, 3).map((e: any) => (
                        <img key={e.id} src={e.details.image_url} alt={e.nom} className="w-8 h-8 rounded border object-cover" />
                      ))}
                      {enseignes.filter((e: any) => e.details?.image_url).length > 3 && (
                        <span className="text-xs text-muted-foreground self-center">
                          +{enseignes.filter((e: any) => e.details?.image_url).length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Adresse — texte cliquable → carte plein écran */}
            {deliveryAddress && deliveryAddress.lat && deliveryAddress.lng && (
              <button
                className="mt-3 bg-gray-50 rounded-lg p-3 text-left hover:bg-blue-50 transition-colors w-full border border-transparent hover:border-blue-200"
                onClick={() => setShowMapDialog(true)}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Adresse de livraison</span>
                  <Maximize2 className="h-3 w-3 text-blue-500 ml-auto" />
                </div>
                <p className="text-xs font-medium">{deliveryAddress.label || 'Adresse'}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Cliquer pour voir la carte</p>
              </button>
            )}

            {/* Suppression */}
            <div className="flex justify-end pt-3">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50 gap-1" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 className="h-3 w-3" /> Supprimer le projet
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bouton Initialize */}
      {showInitialize && (
        <div className="mb-4">
          <Button className="w-full" size="lg" onClick={async () => {
            setInitializing(true);
            try {
              const cdc = (projectDocuments || []).find(d => d.templateType === 'cahier_des_charges');
              const initMessage = `🚀 Initialise le projet. CDC: ${cdc?.numero || 'CDC-?'}. Phase: Facturation.`;
              await supabase.from('messages').insert({ user_id: user!.id, session_id: `project-${projectId}`, content: initMessage, sender: 'user', project_id: projectId, timestamp: new Date().toISOString() });
              await fetch('/hermes/router', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: initMessage, userId: user!.id, sessionId: `project-${projectId}`, profile: 'hermes-pm', skills: ['project-initializer', 'procedure-manual', 'kanban-manager', 'checklist-validator', 'communicator-bridge'], projectId: projectId }) });
              window.location.reload();
            } catch (err) { console.error('Initialisation échouée:', err); } finally { setInitializing(false); }
          }} disabled={initializing}>
            {initializing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Rocket className="h-4 w-4 mr-2" />}
            🚀 Initialiser le projet
          </Button>
        </div>
      )}

      {/* ── Onglets (Kanban par défaut) ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto gap-0">
          <TabsTrigger value="kanban" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange rounded-none px-4 py-2.5 text-sm gap-1.5">
            <KanbanSquare className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Kanban</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange rounded-none px-4 py-2.5 text-sm gap-1.5">
            <FileText className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Documents</span>
          </TabsTrigger>
          <TabsTrigger value="checklists" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange rounded-none px-4 py-2.5 text-sm gap-1.5">
            <CheckSquare className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Checklists</span>
          </TabsTrigger>
          <TabsTrigger value="medias" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange rounded-none px-4 py-2.5 text-sm gap-1.5">
            <Image className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Médias</span>
          </TabsTrigger>
          <TabsTrigger value="linked" className="data-[state=active]:border-b-2 data-[state=active]:border-brand-orange rounded-none px-4 py-2.5 text-sm gap-1.5">
            <GitBranch className="h-4 w-4" />
            <span className={isMobile ? 'sr-only' : ''}>Boîte liée</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="mt-4">
          <KanbanBoard projectId={project.id} checklists={checklists} onTaskClick={(taskId) => { setHighlightedChecklistTaskId(taskId); setActiveTab('checklists'); }} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <ProjectDocumentAccordion selectedFacture={selectedFacture} projectId={project.id} userId={user?.id || ''} onFactureDetached={() => setSelectedFacture(null)} projectInitialized={(tasks || []).length > 0} />
        </TabsContent>
        <TabsContent value="checklists" className="mt-4">
          <ChecklistPanel projectId={project.id} highlightTaskId={highlightedChecklistTaskId} />
        </TabsContent>
        <TabsContent value="medias" className="mt-4">
          <ProjectMediaGallery projectId={project.id} />
        </TabsContent>

        <TabsContent value="linked" className="mt-4">
          <TaskLinkedBox
            tasks={tasks}
            onTaskClick={(taskId) => {
              setHighlightedChecklistTaskId(taskId);
              setActiveTab('checklists');
            }}
            projectName={project.name}
          />
        </TabsContent>
      </Tabs>

      {activeTab === 'documents' && (
        <>
          <DocumentLinkFAB onClick={() => setShowSearchDialog(true)} />
          <DocumentSearchDialog open={showSearchDialog} onOpenChange={setShowSearchDialog} onSelect={handleSelectFacture} />
        </>
      )}

      {/* Dialogue enseignes */}
      <EnseignesDialog enseignes={enseignes} open={showEnseignesDialog} onClose={() => setShowEnseignesDialog(false)} clientName={clientName} />

      {/* Dialogue carte plein écran */}
      {deliveryAddress && deliveryAddress.lat && deliveryAddress.lng && (
        <Dialog open={showMapDialog} onOpenChange={setShowMapDialog}>
          <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden">
            <button
              className="absolute top-3 right-3 z-[2000] bg-white rounded-full p-1.5 shadow-md border"
              onClick={() => setShowMapDialog(false)}
            >
              <X className="h-4 w-4" />
            </button>
            <FullscreenMap lat={deliveryAddress.lat} lng={deliveryAddress.lng} label={deliveryAddress.label || ''} />
          </DialogContent>
        </Dialog>
      )}

      {/* Dialogue suppression */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" />Supprimer le projet</DialogTitle></DialogHeader>
          <div className="py-2 space-y-3">
            <p className="text-sm">Vous allez supprimer définitivement le projet <strong>« {project?.name} »</strong>.</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              <p className="font-medium">⚠️ Cette action est irréversible :</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>Toutes les tâches Kanban seront supprimées</li>
                <li>Toutes les checklists seront supprimées</li>
                <li>Les documents seront détachés du projet</li>
                <li>Les communications WhatsApp seront nettoyées</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Annuler</Button>
            <Button variant="destructive" onClick={handleDeleteProject} disabled={deleting} className="gap-2">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin" />Suppression...</> : <><Trash2 className="h-4 w-4" />Supprimer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProjectDetail;
