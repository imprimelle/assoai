
import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader
} from "@/components/ui/dialog";
import { 
  TemplateType, 
  TemplateData, 
  TemplateMetadata,
  Message
} from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import TemplateModalHeader from "./TemplateModalHeader";
import TemplateModalContent from "./TemplateModalContent";
import TemplateModalFooter from "./TemplateModalFooter";
import { supabase } from "@/integrations/supabase/client";
import { appLogger } from "@/utils/logger";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateType: TemplateType;
  data: TemplateData;
  metadata?: TemplateMetadata;
  messageId?: string;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  onSave?: (data: TemplateData) => void;
  onGeneratePDF?: (templateType: TemplateType, data: TemplateData) => void;
  onAskAI?: (templateType: TemplateType, data: TemplateData) => void;
  sessionId?: string;
}

const TemplateModal: React.FC<TemplateModalProps> = ({
  isOpen,
  onClose,
  templateType,
  data: initialData,
  metadata,
  messageId,
  setMessages,
  onSave,
  onGeneratePDF,
  onAskAI,
  sessionId
}) => {
  const [data, setData] = useState<TemplateData>(initialData);
  const [mode, setMode] = useState<'editable' | 'preview' | 'readonly'>('preview');
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Détermine si le template est ouvert depuis un message du chat
  const isFromChatMessage = metadata?.source === 'chatMessage';

  // Mettre à jour les données si elles changent à l'extérieur
  useEffect(() => {
    appLogger.info('🔄 Données du template mises à jour', {
      templateType,
      mode,
      source: metadata?.source,
      data: initialData
    });
    setData(initialData);
  }, [initialData]);

  const handleSave = () => {
    if (onSave) {
      appLogger.info('💾 Sauvegarde du template', {
        templateType,
        mode,
        metadata,
        data
      });
      
      // Envoyer les données complètes du template pour sauvegarde
      onSave(data);
      
      // Si c'est un template depuis le chat, ne pas fermer automatiquement après sauvegarde
      if (!isFromChatMessage) {
        toast({
          title: "Modifications enregistrées",
          description: "Vos modifications ont été enregistrées avec succès.",
        });
      }
    }
  };

  // Nouvelle fonction pour sauvegarder rapidement dans Supabase
  const handleQuickSave = async () => {
    appLogger.info('⚡ Tentative d\'enregistrement rapide', { 
      messageId,
      templateType,
      data 
    });
    
    if (!messageId) {
      appLogger.error('❌ Impossible d\'enregistrer: messageId manquant', {
        templateType,
        data
      });
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'effectuer des modifications rapides: ID du message manquant",
      });
      return;
    }

    try {
      // Sérialiser proprement les données avant envoi
      const serializedData = JSON.parse(JSON.stringify(data));
      
      // Créer un objet template_data qui respecte la structure attendue par Supabase
      const template_data: Record<string, any> = {
        data: serializedData
      };
      
      // Ajouter les métadonnées si présentes
      if (metadata) {
        template_data.metadata = metadata;
      }
      
      appLogger.info('📤 Envoi des données à Supabase', {
        messageId,
        templateType,
        serializedData,
        template_data
      });
      
      // Mettre à jour Supabase
      const { error } = await supabase
        .from("messages")
        .update({ template_data })
        .eq("id", messageId);

      if (error) {
        appLogger.error('❌ Erreur lors de la sauvegarde Supabase', { 
          error,
          messageId,
          templateType 
        });
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'enregistrer: " + error.message,
        });
        return;
      }

      appLogger.info('✅ Mise à jour réussie dans Supabase', {
        messageId,
        templateType,
        timestamp: new Date().toISOString()
      });

      // Mise à jour optimiste dans l'état local si disponible
      if (setMessages) {
        appLogger.info('🔄 Mise à jour optimiste de l\'état local', {
          messageId,
          templateType
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, template: { ...m.template!, data } } : m
          )
        );
      }

      toast({ 
        title: "Sauvegardé ✅", 
        description: "Modifications enregistrées avec succès.",
        className: "bg-white rounded-md"
      });
    } catch (e) {
      appLogger.error('❌ Exception lors de la sauvegarde', { 
        error: e,
        messageId,
        templateType 
      });
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'effectuer des modifications rapides",
        className: "bg-white rounded-md"
      });
    }
  };

  const handleGeneratePDF = () => {
    if (onGeneratePDF) {
      onGeneratePDF(templateType, data);
      onClose(); // Fermer la modale après avoir initié la génération du PDF
    }
  };

  const toggleMode = () => {
    setMode(mode === 'editable' ? 'preview' : 'editable');
  };

  const handleDataChange = (newData: TemplateData) => {
    console.log("TemplateModal: données mises à jour", newData);
    setData(newData);
  };

  // Fonction qui délègue à onAskAI avec les données actuelles
  const handleAskAI = () => {
    if (onAskAI) {
      onAskAI(templateType, data);
    }
  };

  // Corrigé: On vérifie si mode === 'editable' et si metadata?.mode n'est pas 'readonly'
  const isEditable = mode === 'editable' && metadata?.mode !== 'readonly';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 sm:rounded-lg rounded-none pb-10 bg-white shadow-lg">
        {/* Barre d'outils - mobile ou desktop */}
        {isMobile ? (
          <TemplateModalHeader
            isMobile={true}
            templateType={templateType}
            metadata={metadata}
            mode={mode}
            isFromChatMessage={isFromChatMessage}
            onClose={onClose}
            toggleMode={toggleMode}
            handleSave={handleSave}
            handleQuickSave={handleQuickSave}
            data={data}
            onGeneratePDF={onGeneratePDF}
            sessionId={sessionId}
          />
        ) : (
          <DialogHeader className="bg-white rounded-t-lg">
            <TemplateModalHeader
              isMobile={false}
              templateType={templateType}
              metadata={metadata}
              mode={mode}
              isFromChatMessage={isFromChatMessage}
              onClose={onClose}
              toggleMode={toggleMode}
              handleSave={handleSave}
              handleQuickSave={handleQuickSave}
              data={data}
              onGeneratePDF={onGeneratePDF}
              sessionId={sessionId}
            />
          </DialogHeader>
        )}
        
        {/* Corps du template */}
        <TemplateModalContent
          templateType={templateType}
          data={data}
          isEditable={isEditable}
          mode={mode}
          isFromChatMessage={isFromChatMessage}
          isMobile={isMobile}
          onDataChange={handleDataChange}
          onSave={handleQuickSave}
        />

        {/* Bouton "Demander à l'IA" pour les templates ouverts depuis un message */}
        <TemplateModalFooter
          isFromChatMessage={isFromChatMessage}
          handleSave={handleSave}
          handleGeneratePDF={onGeneratePDF ? handleGeneratePDF : undefined}
          data={data}
          templateType={templateType}
          onAskAI={handleAskAI}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TemplateModal;
