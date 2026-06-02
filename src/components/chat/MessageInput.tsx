import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Image, ListIcon, Mic, Send, Sparkles, SunIcon, Plus, Check, X, FileText, Video, Upload, Loader } from "lucide-react";
import { MessageType, TemplateType, TemplateData, FactureData, DevisData, CahierDesChargesData } from "@/types";
import { Toggle } from "@/components/ui/toggle";
import { motion, AnimatePresence } from "framer-motion";
import { TemplatePreview } from "@/components/templates";
import TemplateQuoteCard from "@/components/ui/TemplateQuoteCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

interface MessageInputProps {
  onSendMessage: (content: string, attachments: File[], template?: { templateType: TemplateType; data: TemplateData }) => void;
  hasUserSentMessage: boolean;
  activeTemplate: {
    templateType: TemplateType;
    data: TemplateData;
  } | null;
  onCancelTemplate: () => void;
  isLoading?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  hasUserSentMessage, 
  activeTemplate,
  onCancelTemplate,
  isLoading = false
}) => {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isImageMode, setIsImageMode] = useState(false);
  const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleWindowResize = () => {
      if (inputRef.current === document.activeElement) {
        setTimeout(() => {
          inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const handleSend = () => {
    if ((message.trim() !== "" || attachments.length > 0 || activeTemplate) && !isLoading) {
      console.log("Sending message with activeTemplate:", activeTemplate);
      console.log("Sending attachments:", attachments);
      
      // Si activeTemplate existe, envoyer le message avec le template complet
      if (activeTemplate) {
        // Nouveau: envoyer le message avec le template complet
        onSendMessage(message, attachments, {
          templateType: activeTemplate.templateType,
          data: activeTemplate.data
        });
      } else {
        onSendMessage(message, attachments);
      }
      
      // Reset state
      setMessage("");
      setAttachments([]);
      setIsImageMode(false);
      setIsRecording(false);

      // Restaurer la hauteur initiale du textarea
      if (inputRef.current) {
        inputRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl+Enter envoie, Entrée seul insère une nouvelle ligne
    if (e.key === "Enter" && e.ctrlKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  };

  const triggerFileUpload = (type: MessageType) => {
    // Seules les images peuvent être uploadées, les autres types sont désactivés
    if (!isLoading && fileInputRef.current && type === "image") {
      fileInputRef.current.setAttribute("accept", getAcceptTypes(type));
      fileInputRef.current.click();
    }
    // Fermer le menu après la sélection
    setIsUploadMenuOpen(false);
  };

  const getAcceptTypes = (type: MessageType): string => {
    switch (type) {
      case "image": return "image/*";
      case "audio": return "audio/*";
      case "video": return "video/*";
      case "document": return ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
      default: return "*/*";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
      console.log("Files selected:", newFiles);
    }
    // Reset the input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Helper function to check if a file is an image
  const isImageFile = (file: File): boolean => {
    return file.type.startsWith('image/');
  };

  // Function to generate a local object URL for preview
  const getFilePreviewUrl = (file: File): string | null => {
    if (isImageFile(file)) {
      return URL.createObjectURL(file);
    }
    return null;
  };

  // Clean up object URLs when component unmounts or attachments change
  useEffect(() => {
    const previewUrls: string[] = [];
    
    attachments.forEach(file => {
      if (isImageFile(file)) {
        const previewUrl = getFilePreviewUrl(file);
        if (previewUrl) previewUrls.push(previewUrl);
      }
    });
    
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [attachments]);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const toggleImageMode = () => {
    setIsImageMode(!isImageMode);
    if (!isImageMode) {
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setIsImageMode(false);
    }
  };

  // Action buttons à afficher sous la zone de saisie
  const suggestedActions = [
    { icon: <Image className="h-5 w-5" />, label: "Créer une image", onClick: () => console.log("Créer une image") },
    { icon: <Sparkles className="h-5 w-5" />, label: "Surprends-moi", onClick: () => console.log("Surprends-moi") },
    { icon: <SunIcon className="h-5 w-5" />, label: "Élaborer un plan", onClick: () => console.log("Élaborer un plan") },
    { icon: <Plus className="h-5 w-5" />, label: "Plus", onClick: () => console.log("Plus") },
  ];

  // Style commun pour les boutons d'action (isActive est un booléen qui indique si le mode est actif)
  const getActionButtonStyles = (isActive: boolean) => {
    return `flex items-center justify-center p-2 rounded-full transition-all border border-gray-300 bg-transparent ${
      isActive 
        ? "bg-orange-100 text-brand-orange border-brand-orange" 
        : "text-gray-500 hover:bg-gray-50 hover:border-gray-400"
    }`;
  };

  // Définir si le bouton d'envoi est actif (au moins un élément à envoyer)
  const sendButtonActive = (message.trim() !== "" || attachments.length > 0 || activeTemplate !== null) && !isLoading;

  // Variable pour suivre si les suggestions ont déjà été affichées
  const [suggestionsShown, setSuggestionsShown] = useState(true);

  // Effet pour masquer les suggestions après le premier message
  useEffect(() => {
    if (hasUserSentMessage && suggestionsShown) {
      setSuggestionsShown(false);
    }
  }, [hasUserSentMessage]);

  // Déboguer l'état du template actif 
  useEffect(() => {
    if (activeTemplate) {
      console.log("Template actif dans MessageInput:", activeTemplate);
    }
  }, [activeTemplate]);

  // Fonction pour obtenir le nom du client à partir du template actif
  const getClientNameFromTemplate = (): string => {
    if (!activeTemplate) return "Client";
    
    switch (activeTemplate.templateType) {
      case "facture":
        return (activeTemplate.data as FactureData).client?.nom || "Client";
      case "devis":
        return (activeTemplate.data as DevisData).client?.nom || "Client";
      case "commande":
        return (activeTemplate.data as any).client?.nom || "Client";
      case "cahier_des_charges":
        // Le cahier des charges n'a pas de propriété client
        const cahierData = activeTemplate.data as CahierDesChargesData;
        return cahierData.titre || "Projet";
      default:
        return "Client";
    }
  };

  // Fonction pour obtenir le montant total à partir du template actif
  // Modifié pour retourner une chaîne au lieu d'un nombre
  const getMontantFromTemplate = (): string => {
    if (!activeTemplate) return "0";
    
    switch (activeTemplate.templateType) {
      case "facture":
        return ((activeTemplate.data as FactureData).total || 0).toString();
      case "devis":
        return ((activeTemplate.data as DevisData).total || 0).toString();
      case "commande":
        return ((activeTemplate.data as any).total || 0).toString();
      case "cahier_des_charges":
        // Le cahier des charges n'a pas de propriété total
        return "0";
      default:
        return "0";
    }
  };

  // Fonction pour obtenir l'ID du template actif
  const getTemplateIdFromTemplate = (): string | undefined => {
    if (!activeTemplate) return undefined;
    
    switch (activeTemplate.templateType) {
      case "facture":
        return (activeTemplate.data as FactureData).factureNumero;
      case "devis":
        return (activeTemplate.data as DevisData).devisNumero;
      case "commande":
        return (activeTemplate.data as any).commandeNumero;
      case "cahier_des_charges":
        const cahierData = activeTemplate.data as CahierDesChargesData;
        return cahierData.commande_id || cahierData.titre;
      default:
        return undefined;
    }
  };

  return (
 <div
   className="fixed bottom-0 left-0 w-full z-10 border-t p-3 space-y-4 bg-transparent"
   ref={containerRef}
 >
      {/* Template actif en style WhatsApp */}
      {activeTemplate && (
        <div className="mb-2 bg-white/80 rounded-xl p-2">
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className=""
            >
              <TemplateQuoteCard
                templateType={activeTemplate.templateType}
                clientName={getClientNameFromTemplate()}
                montant={getMontantFromTemplate()}
                templateId={getTemplateIdFromTemplate()}
                isWhatsAppStyle={true}
                showRemoveButton={true}
                onRemove={onCancelTemplate}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}
      
      {/* Pièces jointes avec prévisualisations pour les images */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map((file, index) => {
            const isImage = isImageFile(file);
            const previewUrl = isImage ? getFilePreviewUrl(file) : null;
            
            return (
              <div 
                key={index} 
                className={`bg-gray-100 rounded-lg px-2 py-1 text-sm flex items-center ${isImage ? 'pr-2' : 'pr-3 rounded-full'}`}
              >
                {isImage && previewUrl ? (
                  <img 
                    src={previewUrl} 
                    alt={file.name}
                    className="h-8 w-8 object-cover rounded mr-2"
                  />
                ) : (
                  <FileText className="h-5 w-5 mr-2 text-gray-600" />
                )}
                <span className="truncate max-w-[150px]">{file.name}</span>
                <button 
                  className="ml-2 text-gray-500 hover:text-red-500"
                  onClick={() => removeAttachment(index)}
                  aria-label="Supprimer la pièce jointe"
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Actions suggérées - affichées uniquement au premier chargement et masquées après le premier message */}
      {!hasUserSentMessage && suggestionsShown && (
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestedActions.map((action, index) => (
            <button
              key={index}
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 text-gray-800 hover:bg-gray-50 transition-colors"
              disabled={isLoading}
            >
              <span className="text-brand-orange">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
      
      <div className="rounded-3xl border border-gray-300 bg-white p-4 shadow-lg">
        <div className="flex items-center">
<textarea
  ref={inputRef}
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  onInput={(e) => {
    const el = e.currentTarget;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }}
  onKeyDown={handleKeyDown}
  onFocus={() => {
    setTimeout(() => {
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
  }}
  placeholder={activeTemplate ? "Ajouter un commentaire." : "Poser une question"}
  rows={1}
  className="w-full py-3 px-4 outline-none bg-transparent text-lg resize-none overflow-hidden"
  disabled={isLoading}
/>

        </div>
        
        <div className="flex justify-between items-center mt-1 px-1">
          <div className="flex space-x-2">
            <AnimatePresence>
              {/* Menu déroulant pour l'upload de fichiers */}
              <DropdownMenu open={isUploadMenuOpen} onOpenChange={setIsUploadMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <motion.button
                    key="upload-button"
                    className={getActionButtonStyles(isUploadMenuOpen)}
                    whileTap={{ scale: 0.95 }}
                    aria-label="Upload de fichier"
                    disabled={isLoading}
                  >
                    <AnimatePresence mode="wait">
                      {isUploadMenuOpen ? (
                        <motion.div
                          key="upload-active"
                          initial={{ opacity: 0, rotate: -90 }}
                          animate={{ opacity: 1, rotate: 0 }}
                          exit={{ opacity: 0, rotate: 90 }}
                        >
                          <X className="h-4 w-4" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="upload-inactive"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <Plus className="h-5 w-5" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-white border border-gray-200 rounded-lg shadow-md p-2 min-w-[150px]">
                  <DropdownMenuItem onClick={() => triggerFileUpload("image")} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-2 rounded text-sm">
                    <Image className="h-5 w-5 text-brand-orange" />
                    <span>Image</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 cursor-not-allowed"
                    disabled={true}
                  >
                    <Video className="h-5 w-5 text-gray-400" />
                    <span>Vidéo</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="flex items-center gap-2 px-3 py-2 rounded text-sm text-gray-400 cursor-not-allowed"
                    disabled={true}
                  >
                    <FileText className="h-5 w-5 text-gray-400" />
                    <span>Document</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </AnimatePresence>
            
            <motion.button
              key="list-button"
              className={getActionButtonStyles(false)}
              whileTap={{ scale: 0.95 }}
              aria-label="Liste de choix"
              disabled={isLoading}
            >
              <ListIcon className="h-4 w-4" />
            </motion.button>
            
            <AnimatePresence>
              <motion.button
                key="record-button"
                onClick={toggleRecording}
                className={getActionButtonStyles(isRecording)}
                whileTap={{ scale: 0.95 }}
                aria-label="Enregistrement vocal"
                disabled={isLoading}
              >
                <AnimatePresence mode="wait">
                  {isRecording ? (
                    <motion.div 
                      key="mic-active"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center space-x-1"
                    >
                      <Check className="h-4 w-4" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="mic-inactive"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Mic className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </AnimatePresence>
          </div>
          
          <motion.button 
            onClick={handleSend}
            disabled={!sendButtonActive || isLoading}
            className={`flex items-center justify-center p-2 rounded-full transition-all ${
              sendButtonActive && !isLoading
                ? "text-brand-orange hover:bg-gray-100"
                : "text-gray-400 cursor-not-allowed"
            }`}
            whileTap={sendButtonActive && !isLoading ? { scale: 0.95 } : {}}
          >
            {isLoading ? (
              <Loader className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </motion.button>
        </div>
      </div>
      
      <input 
        ref={fileInputRef}
        type="file" 
        className="hidden" 
        onChange={handleFileChange}
      />
    </div>
  );
};

export default MessageInput;
