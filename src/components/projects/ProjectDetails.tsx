import React, { useState, useEffect } from 'react';
import { Project } from '@/types/project';
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, FileText, ShoppingCart, FileCheck, ClipboardList, MessageSquare } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useProjects } from '@/hooks/useProjects';
import { Skeleton } from '@/components/ui/skeleton';
import { TemplateType, Message, MessagePayload } from '@/types';
import SearchTemplatesModal from './SearchTemplatesModal';
import { getTemplateIdentifier } from '@/utils/template-utils';
import { appLogger } from '@/utils/logger';
import { TemplatePreview } from "@/components/templates";
import { TemplateModal } from '@/components/templates';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from '@/hooks/use-toast';
import { buildGenerationPrompt } from '@/utils/template-hierarchy';
import { buildQuoteData } from '@/utils/quote-utils';
import { v4 as uuidv4 } from 'uuid';
import { saveMessage } from '@/services/database';
import { ProjectWorkflow } from '@/components/workflow';
import { WebhookRetryService } from '@/services/webhookRetryService';
import TemplateRecoveryService from './TemplateRecoveryService';
import TemplateGenerationCard from './TemplateGenerationCard';
import GenerationProgress from './GenerationProgress';
import { useTemplateGeneration } from '@/hooks/useTemplateGeneration';

// Interface for pending generation tracking
interface PendingGeneration {
  id: string;
  templateType: TemplateType;
  sourceType: TemplateType;
  expectedIdentifier?: string;
  timestamp: number;
  attempt: number;
  maxAttempts: number;
  status: 'generating' | 'retrying' | 'error';
  error?: string;
}

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
  onContinueInChat: () => void;
  user?: { id: string; name?: string } | null;
}

const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onBack, onContinueInChat, user }) => {
  const navigate = useNavigate();
  const { removeTemplateFromProject, addTemplateToProject } = useProjects();
  const [activeTab, setActiveTab] = useState('all');
  const isMobile = useIsMobile();
  
  // Use the enhanced template generation hook
  const { generationState, startGeneration, cancelGeneration, canStartGeneration } = useTemplateGeneration();
  
  // State for template data
  const [factures, setFactures] = useState<any[]>([]);
  const [commandes, setCommandes] = useState<any[]>([]);
  const [devis, setDevis] = useState<any[]>([]);
  const [cahiersDesCharges, setCahiersDesCharges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State for search templates modal
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  
  // State for template modal
  const [selectedTemplate, setSelectedTemplate] = useState<{
    isOpen: boolean;
    templateType: TemplateType | null;
    data: any | null;
    messageId: string | null;
  }>({
    isOpen: false,
    templateType: null,
    data: null,
    messageId: null
  });
  
  // Enhanced state for template generation with retry support
  const [pendingGenerations, setPendingGenerations] = useState<PendingGeneration[]>([]);
  
  // Add state for workflow view toggle
  const [isWorkflowView, setIsWorkflowView] = useState(false);
  
  // Generate a persistent session ID for the project view
  const [sessionId] = useState(`project_${project.id}_${Date.now()}`);

  // Track if component is mounted
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    
    try {
      appLogger.info('ProjectDetails - Début du chargement des templates pour le projet', {
        projectId: project.id,
        projectName: project.name,
        templateCounts: {
          factures: project.templates.factures.length,
          commandes: project.templates.commandes.length,
          devis: project.templates.devis.length,
          cahiers_des_charges: project.templates.cahiers_des_charges.length
        }
      });
      
      // Fetch factures
      if (project.templates.factures.length > 0) {
        const facturesData: any[] = [];
        for (const id of project.templates.factures) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('template_type', 'facture')
            .filter('template_data->data->>factureNumero', 'eq', id)
            .filter('template_data->data->>is_latest', 'eq', 'true');
          
          if (data && data.length > 0) {
            facturesData.push(...data);
          }
        }
        setFactures(facturesData);
      }

      // Fetch commandes
      if (project.templates.commandes.length > 0) {
        const commandesData: any[] = [];
        for (const id of project.templates.commandes) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('template_type', 'commande')
            .filter('template_data->data->>commandeNumero', 'eq', id)
            .filter('template_data->data->>is_latest', 'eq', 'true');
          
          if (data && data.length > 0) {
            commandesData.push(...data);
          }
        }
        setCommandes(commandesData);
      }

      // Fetch devis
      if (project.templates.devis.length > 0) {
        const devisData: any[] = [];
        for (const id of project.templates.devis) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('template_type', 'devis')
            .filter('template_data->data->>devisNumero', 'eq', id)
            .filter('template_data->data->>is_latest', 'eq', 'true');
          
          if (data && data.length > 0) {
            devisData.push(...data);
          }
        }
        setDevis(devisData);
      }

      // Fetch cahiers des charges
      if (project.templates.cahiers_des_charges.length > 0) {
        const cahiersData: any[] = [];
        for (const id of project.templates.cahiers_des_charges) {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('template_type', 'cahier_des_charges')
            .filter('template_data->data->>titre', 'eq', id)
            .filter('template_data->data->>is_latest', 'eq', 'true');
          
          if (data && data.length > 0) {
            cahiersData.push(...data);
          }
        }
        setCahiersDesCharges(cahiersData);
      }
    } catch (error) {
      appLogger.error('ProjectDetails - Erreur lors du chargement des templates', {
        error,
        projectId: project.id
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [project]);

  const handleOpenTemplatesSearch = () => {
    setSearchModalOpen(true);
  };

  const handleRemoveTemplate = (type: TemplateType, id: string) => {
    appLogger.info('ProjectDetails - Retrait de template demandé', {
      templateType: type,
      templateId: id,
      projectId: project.id
    });
    
    removeTemplateFromProject.mutate({
      projectId: project.id,
      templateType: type,
      templateId: id
    });
  };

  const handleOpenTemplate = (template: any) => {
    if (!template.template_data?.data) {
      appLogger.warning('ProjectDetails - Template sans données', {
        templateType: template.template_type,
        templateId: template.id,
        templateData: template.template_data
      });
      return;
    }
    
    setSelectedTemplate({
      isOpen: true,
      templateType: template.template_type as TemplateType,
      data: template.template_data.data,
      messageId: template.id
    });
  };

  const handleCloseModal = () => {
    setSelectedTemplate({
      isOpen: false,
      templateType: null,
      data: null,
      messageId: null
    });
  };
  
  // Enhanced handleTemplateGeneration with improved generation system
  const handleTemplateGeneration = async (
    sourceTemplate: any,
    targetType: TemplateType
  ) => {
    try {
      if (!sourceTemplate || !sourceTemplate.template_data || !sourceTemplate.template_data.data) {
        throw new Error("Source template data is missing");
      }
      
      const sourceType = sourceTemplate.template_type as TemplateType;
      const sourceData = sourceTemplate.template_data.data;
      const generationId = `${sourceTemplate.id}_${targetType}`;
      
      // Check if generation can start
      if (!canStartGeneration(generationId)) {
        toast({
          title: "Génération déjà en cours",
          description: "Une génération est déjà en cours pour ce template.",
          variant: "destructive"
        });
        return;
      }
      
      // Build generation prompt and quote data
      const prompt = buildGenerationPrompt(sourceType, targetType, sourceData);
      const quoteData = buildQuoteData(sourceType, sourceData);
      
      appLogger.info('ProjectDetails - Démarrage génération persistante', {
        generationId,
        sourceType,
        targetType,
        sourceTemplateId: sourceTemplate.id,
        sessionId,
        userId: user?.id || 'anonymous'
      });
      
      // Create webhook payload
      const payload: MessagePayload = {
        userId: user?.id || 'anonymous', 
        sessionId: sessionId, 
        timestamp: new Date().toISOString(),
        message: {
          type: "template", 
          content: prompt,
          attachments: [],
          template: {
            templateType: sourceType,
            data: sourceData
          },
          quote: quoteData
        }
      };
      
      // Use enhanced template generation hook
      const response = await startGeneration(
        payload,
        generationId,
        `${sourceType} → ${targetType}`
      );
      
      if (response && response.response && response.response.mode === "template" && response.response.data) {
        // Extract the template identifier from the response
        const templateId = getTemplateIdentifier(targetType, response.response.data);
        
        if (!templateId) {
          throw new Error("Identifiant de template manquant dans la réponse");
        }
        
        appLogger.info('ProjectDetails - Template généré avec succès', {
          generationId,
          targetType,
          templateId
        });
        
        // Create and save AI message
        const messageId = uuidv4();
        const aiMessage: Message = {
          id: messageId,
          sessionId: sessionId,
          userId: user?.id || 'anonymous',
          content: `Voici ${targetType === 'devis' ? 'le' : 'la'} ${targetType} généré(e)`,
          timestamp: new Date().toISOString(),
          type: "text",
          attachments: [],
          isUser: false,
          template: {
            templateType: targetType,
            data: response.response.data,
            metadata: response.response.metadata
          }
        };
        
        await saveMessage(aiMessage);
        
        // Add template to project
        if (isMounted) {
          await addTemplateToProject.mutate(
            {
              projectId: project.id,
              templateType: targetType,
              templateId: templateId
            },
            {
              onSuccess: () => {
                if (!isMounted) return;
                
                toast({
                  title: "Génération réussie",
                  description: `${targetType === 'devis' ? 'Le' : 'La'} ${targetType} a été généré(e) et ajouté(e) au projet.`,
                });
                
                refreshTemplates();
              },
              onError: (error) => {
                appLogger.error('ProjectDetails - Erreur ajout template au projet', {
                  error,
                  generationId,
                  templateId
                });
              }
            }
          );
        }
      }
    } catch (error: any) {
      appLogger.error('ProjectDetails - Erreur lors de la génération', {
        error: error.message,
        sourceType: sourceTemplate?.template_type,
        targetType
      });
      
      toast({
        title: "Erreur de génération",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Handler for retry button
  const handleRetryGeneration = (pendingGen: PendingGeneration) => {
    appLogger.info('ProjectDetails - Retry génération demandé', {
      generationId: pendingGen.id,
      attempt: pendingGen.attempt + 1
    });
    
    // Update attempt count
    setPendingGenerations(prev => 
      prev.map(gen => 
        gen.id === pendingGen.id 
          ? { ...gen, attempt: gen.attempt + 1, status: 'retrying', error: undefined }
          : gen
      )
    );
    
    // Find source template and retry
    // For now, we'll remove the failed generation and let user manually retry
    setPendingGenerations(prev => 
      prev.filter(gen => gen.id !== pendingGen.id)
    );
    
    toast({
      title: "Nouvelle tentative",
      description: "Veuillez relancer la génération manuellement.",
    });
  };

  // Handler for chat fallback
  const handleContinueInChat = (pendingGen: PendingGeneration) => {
    appLogger.info('ProjectDetails - Redirection vers chat', {
      generationId: pendingGen.id,
      sourceType: pendingGen.sourceType,
      targetType: pendingGen.templateType
    });
    
    navigate(`/chat?action=generate&target=${pendingGen.templateType}&source=${pendingGen.sourceType}`);
  };

  // Recovery callback
  const handleTemplateRecovery = (templateId: string, templateType: string) => {
    appLogger.info('ProjectDetails - Template récupéré', {
      templateId,
      templateType
    });
    
    // Remove from pending generations
    setPendingGenerations(prev => 
      prev.filter(gen => gen.expectedIdentifier !== templateId)
    );
    
    // Refresh templates
    refreshTemplates();
  };

  const refreshTemplates = async () => {
    setIsLoading(true);
    try {
      // Simulate a small delay to allow database updates to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Re-fetch templates
      const fetchTemplates = async () => {
        // Get fresh project data first
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('id', project.id)
          .single();
          
        if (projectData) {
          // Type safety: create a properly typed templates object from the JSON data
          const templates = projectData.templates as unknown as {
            factures: string[];
            commandes: string[];
            devis: string[];
            cahiers_des_charges: string[];
          };
          
          // Update project templates with fresh data
          project.templates = templates;
          
          // Now fetch all templates with the refreshed IDs
          // Fetch factures
          if (project.templates.factures.length > 0) {
            const facturesData: any[] = [];
            for (const id of project.templates.factures) {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('template_type', 'facture')
                .filter('template_data->data->>factureNumero', 'eq', id)
                .filter('template_data->data->>is_latest', 'eq', 'true');
              
              if (data && data.length > 0) {
                facturesData.push(...data);
              }
            }
            setFactures(facturesData);
          }

          // Fetch commandes
          if (project.templates.commandes.length > 0) {
            const commandesData: any[] = [];
            for (const id of project.templates.commandes) {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('template_type', 'commande')
                .filter('template_data->data->>commandeNumero', 'eq', id)
                .filter('template_data->data->>is_latest', 'eq', 'true');
              
              if (data && data.length > 0) {
                commandesData.push(...data);
              }
            }
            setCommandes(commandesData);
          }

          // Fetch devis
          if (project.templates.devis.length > 0) {
            const devisData: any[] = [];
            for (const id of project.templates.devis) {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('template_type', 'devis')
                .filter('template_data->data->>devisNumero', 'eq', id)
                .filter('template_data->data->>is_latest', 'eq', 'true');
              
              if (data && data.length > 0) {
                devisData.push(...data);
              }
            }
            setDevis(devisData);
          }

          // Fetch cahiers des charges
          if (project.templates.cahiers_des_charges.length > 0) {
            const cahiersData: any[] = [];
            for (const id of project.templates.cahiers_des_charges) {
              const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('template_type', 'cahier_des_charges')
                .filter('template_data->data->>titre', 'eq', id)
                .filter('template_data->data->>is_latest', 'eq', 'true');
              
              if (data && data.length > 0) {
                cahiersData.push(...data);
              }
            }
            setCahiersDesCharges(cahiersData);
          }
        }
      };
      
      await fetchTemplates();
    } catch (error) {
      appLogger.error('ProjectDetails - Erreur lors du rafraîchissement des templates', {
        error,
        projectId: project.id
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add missing handler functions
  const handleAskAI = (template: any) => {
    if (!template.template_data?.data) return;
    
    const templateIdentifier = getTemplateIdentifier(template.template_type, template.template_data.data);
    navigate(`/chat?template=${template.template_type}&id=${templateIdentifier}&action=ask`);
  };

  const handleCreateCommande = (template: any) => {
    handleTemplateGeneration(template, 'commande');
  };

  const handleCreateCahierDesCharges = (template: any) => {
    handleTemplateGeneration(template, 'cahier_des_charges');
  };

  const handleCreateDevis = (template: any) => {
    handleTemplateGeneration(template, 'devis');
  };

  const handleGeneratePDF = (template: any) => {
    if (!template.template_data?.data) return;
    
    // Navigate to chat with PDF generation context
    const templateIdentifier = getTemplateIdentifier(template.template_type, template.template_data.data);
    navigate(`/chat?template=${template.template_type}&id=${templateIdentifier}&action=pdf`);
  };

  const renderTemplateCards = (templates: any[], type: TemplateType) => {
    if (isLoading) {
      return Array.from({ length: 3 }).map((_, index) => (
        <Skeleton key={index} className="h-28 w-full" />
      ));
    }

    // Find pending generations for this type
    const pendingForType = pendingGenerations.filter(gen => gen.templateType === type);

    if (templates.length === 0 && pendingForType.length === 0) {
      return (
        <div className="text-center py-6">
          <p className="text-muted-foreground text-sm">
            Aucun document de ce type n'est associé au projet
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Display pending generation cards */}
        {pendingForType.map((pending) => (
          <div key={pending.id} className="relative">
            <TemplateGenerationCard
              sourceType={pending.sourceType}
              targetType={pending.templateType}
              status={pending.status}
              attempt={pending.attempt}
              maxAttempts={pending.maxAttempts}
              error={pending.error}
              onGenerate={() => {
                // For now, just remove the pending generation
                setPendingGenerations(prev => 
                  prev.filter(gen => gen.id !== pending.id)
                );
              }}
              onRetry={() => handleRetryGeneration(pending)}
            />
          </div>
        ))}
        
        {/* Display existing templates */}
        {templates.map((template) => {
          if (!template.template_data || !template.template_data.data) {
            return null;
          }

          const isGenerationDisabled = generationState.isActive;

          return (
            <div key={template.id} className="relative">
              <TemplatePreview
                templateType={type}
                data={template.template_data}
                onClick={() => handleOpenTemplate(template)}
                className="cursor-pointer"
                showActions={true}
                onAskAI={() => handleAskAI(template)}
                onCommander={type === 'facture' && !isGenerationDisabled ? () => handleCreateCommande(template) : undefined}
                onCreateCahierDesCharges={type === 'commande' && !isGenerationDisabled ? () => handleCreateCahierDesCharges(template) : undefined}
                onCreateDevis={type === 'cahier_des_charges' && !isGenerationDisabled ? () => handleCreateDevis(template) : undefined}
                onGeneratePDF={() => handleGeneratePDF(template)}
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2 z-10 h-6 w-6 p-0 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  const id = getTemplateIdentifier(type, template.template_data.data);
                  if (id) {
                    handleRemoveTemplate(type, id);
                  }
                }}
              >
                ×
              </Button>
            </div>
          );
        })}
      </>
    );
  };

  const totalTemplates = 
    factures.length + 
    commandes.length + 
    devis.length + 
    cahiersDesCharges.length;

  // Fonction pour obtenir le nom d'affichage du type de template
  const getTemplateTypeName = (type: TemplateType): string => {
    switch (type) {
      case "facture": return "Facture";
      case "devis": return "Devis";
      case "commande": return "Commande";
      case "cahier_des_charges": return "Cahier des charges";
      default: return type;
    }
  };

  return (
    <div className="space-y-4">
      {/* Generation Progress Indicator */}
      <GenerationProgress
        isActive={generationState.isActive}
        elapsedMinutes={generationState.elapsedMinutes}
        onCancel={cancelGeneration}
        onContinueInChat={onContinueInChat}
        contextInfo={generationState.generationId ? `ID: ${generationState.generationId}` : undefined}
      />

      {/* Template Recovery Service for background monitoring */}
      <TemplateRecoveryService
        projectId={project.id}
        sessionId={sessionId}
        pendingGenerations={pendingGenerations.map(gen => ({
          id: gen.id,
          templateType: gen.templateType,
          expectedIdentifier: gen.expectedIdentifier,
          timestamp: gen.timestamp,
          sourceType: gen.sourceType
        }))}
        onRecovery={handleTemplateRecovery}
      />

      <div className="flex items-center justify-between sticky top-0 z-10 bg-white py-2">
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={onBack} className="flex-shrink-0">
            <ArrowLeft className="h-4 w-4" />
            <span className={isMobile ? "sr-only" : "ml-1"}>Retour</span>
          </Button>
          <h1 className="text-xl md:text-2xl font-bold truncate">{project.name}</h1>
        </div>
        
        {/* Show chat fallback button if there are errors */}
        {generationState.error && (
          <Button
            variant="outline"
            size="sm"
            onClick={onContinueInChat}
            className="flex items-center"
          >
            <MessageSquare className="h-4 w-4" />
            <span className={isMobile ? "sr-only" : "ml-2"}>Continuer dans le chat</span>
          </Button>
        )}
        
        {/* Toggle for switching between list and workflow views */}
        {(factures.length + commandes.length + devis.length + cahiersDesCharges.length) > 1 && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Vue liste</span>
            <Switch
              checked={isWorkflowView}
              onCheckedChange={setIsWorkflowView}
              aria-label="Toggle workflow view"
            />
            <span className="text-sm text-muted-foreground">Vue workflow</span>
          </div>
        )}
      </div>

      {project.description && (
        <p className="text-muted-foreground text-sm md:text-base">{project.description}</p>
      )}

      <div className="flex items-center space-x-2">
        <Badge variant="outline" className="text-xs md:text-sm">
          {totalTemplates} document{totalTemplates !== 1 ? 's' : ''}
        </Badge>
        {generationState.isActive && (
          <Badge variant="secondary" className="text-xs md:text-sm animate-pulse">
            Génération en cours...
          </Badge>
        )}
      </div>
      
      {/* Show workflow view when toggled */}
      {isWorkflowView ? (
        <div className="mt-4">
          <div className="flex justify-end mb-4">
            <Button 
              variant="outline" 
              onClick={handleOpenTemplatesSearch} 
              className="flex items-center"
              disabled={generationState.isActive}
            >
              <Plus className="h-4 w-4" />
              <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter un document</span>
            </Button>
          </div>
          <Card className="overflow-hidden">
            <ProjectWorkflow
              project={project}
              factures={factures}
              commandes={commandes}
              devis={devis}
              cahiersDesCharges={cahiersDesCharges}
              isLoading={isLoading}
              handleOpenTemplate={handleOpenTemplate}
            />
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-1">
            <TabsList className="grid grid-cols-5 w-full min-w-[500px]">
              <TabsTrigger value="all" className="flex items-center space-x-1">
                <span>{isMobile ? "" : "Tous"}</span>
                {totalTemplates > 0 && (
                  <Badge variant="secondary" className="ml-1">{totalTemplates}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="factures" className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Factures</span>
                {factures.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{factures.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="commandes" className="flex items-center space-x-1">
                <ShoppingCart className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Commandes</span>
                {commandes.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{commandes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="devis" className="flex items-center space-x-1">
                <FileCheck className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>Devis</span>
                {devis.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{devis.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cahiers" className="flex items-center space-x-1">
                <ClipboardList className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : ""}>CdC</span>
                {cahiersDesCharges.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{cahiersDesCharges.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="pt-4">
            {totalTemplates === 0 && !isLoading ? (
              <div className="text-center py-8 md:py-12">
                <p className="text-muted-foreground">
                  Ce projet ne contient encore aucun document
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4" 
                  onClick={handleOpenTemplatesSearch}
                  disabled={generationState.isActive}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter un document
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {totalTemplates > 0 && (
                  <div className="flex justify-end mb-4">
                    <Button 
                      variant="outline" 
                      onClick={handleOpenTemplatesSearch} 
                      className="flex items-center"
                      disabled={generationState.isActive}
                    >
                      <Plus className="h-4 w-4" />
                      <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter un document</span>
                    </Button>
                  </div>
                )}
                
                {factures.length > 0 && (
                  <section>
                    <h3 className="text-base md:text-lg font-medium mb-2">Factures</h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {renderTemplateCards(factures, 'facture')}
                    </div>
                  </section>
                )}

                {commandes.length > 0 && (
                  <section>
                    <h3 className="text-base md:text-lg font-medium mb-2">Commandes</h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {renderTemplateCards(commandes, 'commande')}
                    </div>
                  </section>
                )}

                {devis.length > 0 && (
                  <section>
                    <h3 className="text-base md:text-lg font-medium mb-2">Devis</h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {renderTemplateCards(devis, 'devis')}
                    </div>
                  </section>
                )}

                {cahiersDesCharges.length > 0 && (
                  <section>
                    <h3 className="text-base md:text-lg font-medium mb-2">Cahiers des charges</h3>
                    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {renderTemplateCards(cahiersDesCharges, 'cahier_des_charges')}
                    </div>
                  </section>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="factures" className="pt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                onClick={handleOpenTemplatesSearch} 
                className="flex items-center"
                disabled={generationState.isActive}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter une facture</span>
              </Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {renderTemplateCards(factures, 'facture')}
            </div>
          </TabsContent>

          <TabsContent value="commandes" className="pt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                onClick={handleOpenTemplatesSearch} 
                className="flex items-center"
                disabled={generationState.isActive}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter une commande</span>
              </Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {renderTemplateCards(commandes, 'commande')}
            </div>
          </TabsContent>

          <TabsContent value="devis" className="pt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                onClick={handleOpenTemplatesSearch} 
                className="flex items-center"
                disabled={generationState.isActive}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter un devis</span>
              </Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {renderTemplateCards(devis, 'devis')}
            </div>
          </TabsContent>

          <TabsContent value="cahiers" className="pt-4">
            <div className="flex justify-end mb-4">
              <Button 
                variant="outline" 
                onClick={handleOpenTemplatesSearch} 
                className="flex items-center"
                disabled={generationState.isActive}
              >
                <Plus className="h-4 w-4" />
                <span className={isMobile ? "sr-only" : "ml-2"}>Ajouter un cahier des charges</span>
              </Button>
            </div>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {renderTemplateCards(cahiersDesCharges, 'cahier_des_charges')}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Modal pour rechercher et ajouter des templates */}
      <SearchTemplatesModal 
        isOpen={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)} 
        project={project}
        activeTab={activeTab as TemplateType | 'all'}
      />

      {/* Modal pour afficher le template sélectionné */}
      {selectedTemplate.isOpen && selectedTemplate.templateType && selectedTemplate.data && (
        <TemplateModal
          isOpen={selectedTemplate.isOpen}
          onClose={handleCloseModal}
          templateType={selectedTemplate.templateType}
          data={selectedTemplate.data}
          messageId={selectedTemplate.messageId}
          metadata={{
            displayName: getTemplateTypeName(selectedTemplate.templateType),
            description: "Document du projet",
            mode: "readonly",
            source: "library",
            availableActions: []
          }}
        />
      )}
    </div>
  );
};

export default ProjectDetails;
