import React, { useState } from "react";
import { X, Save, Edit, Eye, FileText, FileDown, Check, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { TemplateData, TemplateType, TemplateAction, TemplateMetadata } from "@/types";
import { Badge } from "@/components/ui/badge";
import AddToProjectModal from "@/components/projects/AddToProjectModal";
import { getTemplateIdentifier } from "@/utils/template-utils";

interface TemplateModalHeaderProps {
  isMobile: boolean;
  templateType: TemplateType;
  metadata?: TemplateMetadata;
  mode: 'editable' | 'preview' | 'readonly';
  isFromChatMessage: boolean;
  onClose: () => void;
  toggleMode: () => void;
  handleSave: () => void;
  handleQuickSave?: () => void;
  data: TemplateData;
  onGeneratePDF?: (templateType: TemplateType, data: TemplateData) => void;
  sessionId?: string;
}

const TemplateModalHeader: React.FC<TemplateModalHeaderProps> = ({
  isMobile,
  templateType,
  metadata,
  mode,
  isFromChatMessage,
  onClose,
  toggleMode,
  handleSave,
  handleQuickSave,
  data,
  onGeneratePDF,
  sessionId
}) => {
  const [addToProjectModalOpen, setAddToProjectModalOpen] = useState(false);
  
  const getTemplateTitle = () => {
    return metadata?.displayName || templateType.charAt(0).toUpperCase() + templateType.slice(1);
  };

  const getAvailableActions = (): TemplateAction[] => {
    return metadata?.availableActions || ['save', 'download'] as TemplateAction[];
  };

  const isActionAvailable = (action: TemplateAction) => {
    return getAvailableActions().includes(action);
  };

  // Get the template ID based on type
  const getTemplateId = (): string => {
    return getTemplateIdentifier(templateType, data);
  };
  
  const templateId = getTemplateId();

  // Version badge display logic - Enhanced for clarity
  const showVersionBadge = data && typeof data === 'object' && 'version' in data;
  const version = showVersionBadge ? data.version : undefined;
  const isLatest = showVersionBadge && 'is_latest' in data ? data.is_latest : false;

  if (isMobile) {
    return (
      <>
        <div className="sticky top-0 left-0 right-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between rounded-t-lg shadow-sm">
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-brand-orange" />
              <span>{getTemplateTitle()}</span>
            </DialogTitle>
            
            {showVersionBadge && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs py-0 px-2 h-5 bg-white">
                  v{version}
                </Badge>
                {isLatest && (
                  <Badge variant="default" className="bg-emerald-500 text-xs py-0 px-2 h-5">
                    Latest
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* On vérifie si metadata?.mode !== 'readonly' */}
            {metadata?.mode !== 'readonly' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleMode}
                className="h-8 w-8 mobile-touch-target bg-white rounded-md"
                aria-label={mode === 'editable' ? 'Aperçu' : 'Modifier'}
              >
                {mode === 'editable' ? 
                  <Eye className="h-3.5 w-3.5" /> : 
                  <Edit className="h-3.5 w-3.5" />
                }
              </Button>
            )}
      
            {/* Bouton d'enregistrement rapide - Mobile */}
            {mode === 'editable' && handleQuickSave && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleQuickSave}
                className="h-8 w-8 mobile-touch-target text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 bg-white rounded-md"
                aria-label="Enregistrer rapidement"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            
            {/* Add to Project button - Mobile */}
            {sessionId && templateId && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAddToProjectModalOpen(true)}
                className="h-8 w-8 mobile-touch-target bg-white rounded-md"
                aria-label="Ajouter au projet"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </Button>
            )}
      
            {/* PDF Download Button - Mobile View - Always show if onGeneratePDF exists */}
            {onGeneratePDF && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (onGeneratePDF) {
                    onGeneratePDF(templateType, data);
                    onClose();
                  }
                }}
                className="h-8 w-8 mobile-touch-target bg-white rounded-md"
                aria-label="Télécharger PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
              </Button>
            )}
      
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 mobile-touch-target bg-white rounded-md"
              aria-label="Fermer"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Add to Project Modal */}
        {sessionId && (
          <AddToProjectModal
            isOpen={addToProjectModalOpen}
            onClose={() => setAddToProjectModalOpen(false)}
            templateId={templateId}
            templateType={templateType}
            sessionId={sessionId}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="px-6 py-4 border-b sticky top-0 bg-white z-10 flex-shrink-0 rounded-t-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5 text-brand-orange" />
              <span>{getTemplateTitle()}</span>
            </DialogTitle>
            
            {showVersionBadge && (
              <div className="flex items-center gap-1 ml-2">
                <Badge variant="outline" className="text-xs bg-white">
                  v{version}
                </Badge>
                {isLatest && (
                  <Badge variant="default" className="bg-emerald-500 text-xs">
                    Latest
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* On vérifie si metadata?.mode !== 'readonly' */}
            {metadata?.mode !== 'readonly' && (
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMode}
                className="gap-1 bg-white rounded-md h-8 px-2.5"
              >
                {mode === 'editable' ? (
                  <>
                    <Eye className="h-3.5 w-3.5" /> Aperçu
                  </>
                ) : (
                  <>
                    <Edit className="h-3.5 w-3.5" /> Modifier
                  </>
                )}
              </Button>
            )}
            
            {/* Bouton d'enregistrement rapide - Desktop */}
            {mode === 'editable' && handleQuickSave && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickSave}
                className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 bg-white rounded-md h-8 px-2.5"
              >
                <Check className="h-3.5 w-3.5" /> Enregistrer
              </Button>
            )}
            
            {/* Add to Project button - Desktop */}
            {sessionId && templateId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddToProjectModalOpen(true)}
                className="gap-1 bg-white rounded-md h-8 px-2.5"
              >
                <FolderPlus className="h-3.5 w-3.5" /> Projet
              </Button>
            )}
            
            {/* PDF Download Button - Always show if onGeneratePDF exists */}
            {onGeneratePDF && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onGeneratePDF) {
                    onGeneratePDF(templateType, data);
                    onClose();
                  }
                }}
                className="gap-1 bg-white rounded-md h-8 px-2.5"
              >
                <FileDown className="h-3.5 w-3.5" /> PDF
              </Button>
            )}
            
            <AnimatePresence>
              {mode === 'editable' && isActionAvailable('save') && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                >
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={handleSave}
                    className="gap-1 bg-brand-orange hover:bg-brand-orange/90 rounded-md h-8 px-2.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Enregistrer
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 bg-white rounded-md"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Add to Project Modal */}
      {sessionId && (
        <AddToProjectModal
          isOpen={addToProjectModalOpen}
          onClose={() => setAddToProjectModalOpen(false)}
          templateId={templateId}
          templateType={templateType}
          sessionId={sessionId}
        />
      )}
    </>
  );
};

export default TemplateModalHeader;
