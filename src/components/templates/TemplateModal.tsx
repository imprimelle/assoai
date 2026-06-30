
import React, { useState, useEffect, useCallback } from "react";
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
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

/** Entrée de la chaîne documentaire pour le slider horizontal */
export interface ChainDocumentEntry {
  messageId: string;
  templateType: TemplateType;
  label: string;       // "Facture", "Commande", "CDC"
  locked: boolean;     // lecture seule pour cette entrée
  numero?: string;
}

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
  /** Si true, le modal est en lecture seule — pas de bascule vers l'édition */
  forceReadOnly?: boolean;
  /** Chaîne documentaire pour le slider horizontal (optionnel — rétrocompatible) */
  chainDocuments?: ChainDocumentEntry[];
  /** Index du document actif dans la chaîne */
  currentChainIndex?: number;
  /** Callback quand l'utilisateur navigue vers un autre document de la chaîne */
  onChainNavigate?: (index: number, entry: ChainDocumentEntry) => void;
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
  sessionId,
  forceReadOnly = false,
  chainDocuments,
  currentChainIndex = 0,
  onChainNavigate,
}) => {
  const [data, setData] = useState<TemplateData>(initialData);
  const [mode, setMode] = useState<'editable' | 'preview' | 'readonly'>(forceReadOnly ? 'readonly' : 'preview');
  const [activeChainIndex, setActiveChainIndex] = useState(currentChainIndex);
  const [chainDocMessageId, setChainDocMessageId] = useState(messageId || '');
  const [chainDocTemplateType, setChainDocTemplateType] = useState(templateType);
  const [chainLoading, setChainLoading] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  
  // Détermine si le template est ouvert depuis un message du chat
  const isFromChatMessage = metadata?.source === 'chatMessage';

  // Le document courant verrouillé dépend de l'entrée active dans la chaîne
  const currentLocked = chainDocuments?.[activeChainIndex]?.locked ?? false;
  const effectiveReadOnly = forceReadOnly || currentLocked;
  const hasChain = (chainDocuments?.length ?? 0) > 1;

  // Synchroniser l'index actif
  useEffect(() => {
    setActiveChainIndex(currentChainIndex);
  }, [currentChainIndex]);

  // Synchroniser le type et l'ID du document actif quand le modal s'ouvre
  // 🔧 BUGFIX: Sans cette synchro, chainDocTemplateType garde la valeur
  // du précédent document ouvert → mauvais template rendu (ex: facture au lieu de CDC)
  useEffect(() => {
    if (isOpen) {
      setChainDocTemplateType(templateType);
      setChainDocMessageId(messageId || '');
      setData(initialData);
    }
  }, [isOpen, templateType, messageId, initialData]);

  // Naviguer dans la chaîne
  const navigateChain = useCallback(async (newIndex: number) => {
    if (!chainDocuments || newIndex < 0 || newIndex >= chainDocuments.length) return;
    const entry = chainDocuments[newIndex];
    if (!entry.messageId) return;

    setActiveChainIndex(newIndex);
    
    // Notifier le parent (pour qu'il puisse rafraîchir les données)
    onChainNavigate?.(newIndex, entry);

    // Charger les données du document
    setChainLoading(true);
    try {
      const { data: msg, error } = await supabase
        .from('messages')
        .select('template_type, template_data')
        .eq('id', entry.messageId)
        .single();
      if (!error && msg) {
        setChainDocMessageId(entry.messageId);
        setChainDocTemplateType((msg.template_type || entry.templateType) as TemplateType);
        const docData = (msg.template_data as any)?.data || {};
        setData(docData);
        // Forcer le mode selon le verrouillage
        setMode(entry.locked || forceReadOnly ? 'readonly' : 'preview');
      }
    } catch (e) {
      console.error('[TemplateModal] Erreur navigation chaîne:', e);
    } finally {
      setChainLoading(false);
    }
  }, [chainDocuments, forceReadOnly, onChainNavigate]);

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

  // Forcer le mode readonly à chaque ouverture si forceReadOnly est actif
  useEffect(() => {
    if (isOpen && forceReadOnly) {
      setMode('readonly');
    }
  }, [isOpen, forceReadOnly]);

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
    const saveMessageId = effectiveMessageId;
    appLogger.info('⚡ Tentative d\'enregistrement rapide', { 
      messageId: saveMessageId,
      templateType: effectiveType,
      data 
    });
    
    if (!saveMessageId) {
      appLogger.error('❌ Impossible d\'enregistrer: messageId manquant', {
        templateType: effectiveType,
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
        messageId: saveMessageId,
        templateType: effectiveType,
        serializedData,
        template_data
      });
      
      // Mettre à jour Supabase
      const { error } = await supabase
        .from("messages")
        .update({ template_data })
        .eq("id", saveMessageId);

      if (error) {
        appLogger.error('❌ Erreur lors de la sauvegarde Supabase', { 
          error,
          messageId: saveMessageId,
          templateType: effectiveType 
        });
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible d'enregistrer: " + error.message,
        });
        return;
      }

      appLogger.info('✅ Mise à jour réussie dans Supabase', {
        messageId: saveMessageId,
        templateType: effectiveType,
        timestamp: new Date().toISOString()
      });

      // Mise à jour optimiste dans l'état local si disponible
      if (setMessages) {
        appLogger.info('🔄 Mise à jour optimiste de l\'état local', {
          messageId: saveMessageId,
          templateType: effectiveType
        });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === saveMessageId ? { ...m, template: { ...m.template!, data } } : m
          )
        );
      }

      // ✅ Notifier le parent pour mise à jour de son state (ex: PublicDocument.handleSaveEdit)
      if (onSave) {
        onSave(data);
      }

      toast({ 
        title: "Sauvegardé ✅", 
        description: "Modifications enregistrées avec succès.",
        className: "bg-white rounded-md"
      });
    } catch (e) {
      appLogger.error('❌ Exception lors de la sauvegarde', { 
        error: e,
        messageId: saveMessageId,
        templateType: effectiveType 
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
    if (effectiveReadOnly) return;
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
  const isEditable = !effectiveReadOnly && mode === 'editable' && metadata?.mode !== 'readonly';

  // Type et messageId effectifs (chaîne ou document unique)
  const effectiveType = hasChain ? chainDocTemplateType : templateType;
  const effectiveMessageId = hasChain ? chainDocMessageId : (messageId || '');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 sm:rounded-lg rounded-none pb-10 bg-white shadow-lg">
        {/* Barre de navigation chaîne documentaire */}
        {hasChain && (
          <div className="flex items-center justify-center gap-3 px-4 py-2 bg-gray-50 border-b shrink-0">
            <button
              onClick={() => navigateChain(activeChainIndex - 1)}
              disabled={activeChainIndex <= 0 || chainLoading}
              className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Document précédent"
            >
              <ChevronLeft className="h-5 w-5 text-gray-600" />
            </button>

            <div className="flex items-center gap-1.5">
              {chainDocuments!.map((entry, i) => (
                <button
                  key={entry.messageId || i}
                  onClick={() => i !== activeChainIndex && navigateChain(i)}
                  disabled={chainLoading}
                  className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                    i === activeChainIndex
                      ? 'bg-brand-orange text-white font-medium'
                      : entry.locked
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  title={entry.locked ? `${entry.label} (lecture seule)` : entry.label}
                >
                  {entry.locked ? '🔒 ' : ''}{entry.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => navigateChain(activeChainIndex + 1)}
              disabled={activeChainIndex >= (chainDocuments?.length ?? 0) - 1 || chainLoading}
              className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Document suivant"
            >
              <ChevronRight className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        )}

        {/* Indicateur de chargement chaîne */}
        {chainLoading && (
          <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
          </div>
        )}

        {/* Barre d'outils - mobile ou desktop */}
        {isMobile ? (
          <TemplateModalHeader
            isMobile={true}
            templateType={effectiveType}
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
            forceReadOnly={effectiveReadOnly}
          />
        ) : (
          <DialogHeader className="bg-white rounded-t-lg">
            <TemplateModalHeader
              isMobile={false}
              templateType={effectiveType}
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
              forceReadOnly={effectiveReadOnly}
            />
          </DialogHeader>
        )}
        
        {/* Corps du template */}
        <TemplateModalContent
          templateType={effectiveType}
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
          templateType={effectiveType}
          onAskAI={handleAskAI}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TemplateModal;
