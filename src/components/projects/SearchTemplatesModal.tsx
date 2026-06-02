import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileText, ShoppingCart, FileCheck, ClipboardList, Plus } from 'lucide-react';
import { useLatestTemplates } from '@/hooks/useLatestTemplates';
import { TemplateType } from '@/types/template';
import { Project } from '@/types/project';
import { useProjects } from '@/hooks/useProjects';
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from '@/hooks/use-toast';
import { getTemplateIdentifier } from '@/utils/template-utils';

interface SearchTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  activeTab: TemplateType | 'all';
}

const SearchTemplatesModal: React.FC<SearchTemplatesModalProps> = ({ 
  isOpen, 
  onClose, 
  project,
  activeTab
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<TemplateType | 'all'>(activeTab);
  const { toast } = useToast();
  const { addTemplateToProject } = useProjects();

  // Reset search term when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedTab(activeTab);
    }
  }, [isOpen, activeTab]);

  const templateTypes: TemplateType[] = ['facture', 'commande', 'devis', 'cahier_des_charges'];
  
  const renderTemplateList = (type: TemplateType) => {
    return <TemplateList 
      templateType={type} 
      searchTerm={searchTerm}
      project={project}
      onAddToProject={(id, type) => handleAddToProject(id, type)}
    />;
  };

  const handleAddToProject = (templateId: string, templateType: TemplateType) => {
    addTemplateToProject.mutate({
      projectId: project.id,
      templateType,
      templateId
    }, {
      onSuccess: () => {
        toast({
          title: "Document ajouté",
          description: `Le document a été ajouté au projet "${project.name}".`,
        });
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un document au projet</DialogTitle>
          <DialogDescription>
            Recherchez un document pour l'ajouter au projet "{project.name}"
          </DialogDescription>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher un document..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <Tabs defaultValue={selectedTab} value={selectedTab} onValueChange={(v) => setSelectedTab(v as TemplateType | 'all')} className="w-full">
          <TabsList className="grid grid-cols-5 w-full mb-4">
            <TabsTrigger value="all">Tous</TabsTrigger>
            <TabsTrigger value="facture" className="flex items-center gap-1">
              <FileText className="h-4 w-4" /> Factures
            </TabsTrigger>
            <TabsTrigger value="commande" className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4" /> Commandes
            </TabsTrigger>
            <TabsTrigger value="devis" className="flex items-center gap-1">
              <FileCheck className="h-4 w-4" /> Devis
            </TabsTrigger>
            <TabsTrigger value="cahier_des_charges" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" /> CdC
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {templateTypes.map(type => (
              <div key={type} className="mb-6">
                <h3 className="font-medium mb-2">{type.charAt(0).toUpperCase() + type.slice(1)}s</h3>
                {renderTemplateList(type)}
              </div>
            ))}
          </TabsContent>

          {templateTypes.map(type => (
            <TabsContent key={type} value={type}>
              {renderTemplateList(type)}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

interface TemplateListProps {
  templateType: TemplateType;
  searchTerm: string;
  project: Project;
  onAddToProject: (id: string, type: TemplateType) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ 
  templateType, 
  searchTerm,
  project,
  onAddToProject
}) => {
  const { templates, isLoading } = useLatestTemplates(templateType, searchTerm);
  
  // Filter out templates that are already in the project
  const filteredTemplates = templates.filter(template => {
    if (!template.template?.data) return false;
    
    const id = getTemplateIdentifier(templateType, template.template.data);
    if (!id) return false;
    
    switch (templateType) {
      case 'facture':
        return !project.templates.factures.includes(id);
      case 'commande':
        return !project.templates.commandes.includes(id);
      case 'devis':
        return !project.templates.devis.includes(id);
      case 'cahier_des_charges':
        return !project.templates.cahiers_des_charges.includes(id);
      default:
        return false;
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (filteredTemplates.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        Aucun document disponible à ajouter
      </div>
    );
  }

  const getTemplateId = (template: any): string => {
    if (!template.template?.data) return '';
    return getTemplateIdentifier(templateType, template.template.data);
  };

  return (
    <div className="space-y-2">
      {filteredTemplates.slice(0, 5).map((template) => {
        const templateId = getTemplateId(template);
        if (!templateId) return null;
        
        return (
          <div key={template.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{templateType}</Badge>
              <span className="font-medium">{templateId}</span>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => onAddToProject(templateId, templateType)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" /> Ajouter
            </Button>
          </div>
        );
      })}
      {filteredTemplates.length > 5 && (
        <div className="text-center text-sm text-muted-foreground py-2">
          + {filteredTemplates.length - 5} autres documents
        </div>
      )}
    </div>
  );
};

export default SearchTemplatesModal;
