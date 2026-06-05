
import React, { useState } from "react";
import { PDFAction } from "@/types";
import { appLogger } from "@/utils/logger";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { File, Image, X, Download, Eye, AlertTriangle, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { generatePDFClient } from "@/services/pdfGenerator";
import { toast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import ApiStatus from "./WebhookStatus";

interface PDFActionMessageProps {
  action: PDFAction;
  onRemove?: (actionId: string) => void;
}

const PDFActionMessage: React.FC<PDFActionMessageProps> = ({ action, onRemove }) => {
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"pdf" | "image" | null>(null);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(action.downloadUrl || null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'testing' | 'connected' | 'error'>('unknown');
  const isMobile = useIsMobile();
  
  // Enhanced logging for debugging
  React.useEffect(() => {
    appLogger.info("📄 Rendering PDFActionMessage", { 
      status: action.status, 
      templateType: action.templateType,
      pdfUrl: action.pdfUrl || "No URL yet",
      downloadUrl: action.downloadUrl || "No direct download URL",
      actionId: action.id,
      timestamp: action.timestamp,
      fileName: action.filename || "Unnamed",
      documentNumber: action.documentNumber || "No number",
      hasTemplateData: !!action.templateData,
      hasUserId: !!action.userId
    });
  }, [action]);

  const handleRemove = () => {
    if (onRemove) {
      onRemove(action.id);
    }
  };

  const handleDownloadPDF = async () => {
    // Vérifier d'abord si les données nécessaires sont présentes
    if (!action.templateData || !action.userId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Informations manquantes pour générer le PDF"
      });
      return;
    }
    
    setIsPdfLoading(true);
    try {
      const result = await generatePDFClient(
        action.templateType, 
        action.templateData, 
        action.userId, 
        action.sessionId || "",
        "pdf" // Specify PDF generation type
      );
      
      if (result.success && result.pdfUrl) {
        // Store both URLs - one for preview, one for direct download
        setPreviewUrl(result.pdfUrl);
        setDownloadUrl(result.downloadUrl || result.pdfUrl);
        setPreviewType("pdf");
        setShowPreviewDialog(true);
        setPreviewError(false);
        
        toast({
          title: "PDF généré avec succès",
          description: `Le document ${action.documentNumber || ''} est prêt à être visualisé.`
        });
      } else {
        setLastError(result.errorMessage || "Erreur lors de la génération du PDF");
        setApiStatus('error');
        toast({
          variant: "destructive",
          title: "Erreur de génération",
          description: result.errorMessage || "Une erreur s'est produite lors de la génération du PDF.",
          action: (
            <Button variant="outline" size="sm" onClick={() => handleRetryGeneration('pdf')}>
              Réessayer
            </Button>
          )
        });
        setPreviewError(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      setLastError(errorMessage);
      setApiStatus('error');
      appLogger.error("PDF Generation UI Error:", error);
      toast({
        variant: "destructive",
        title: "Erreur technique",
        description: "Impossible de générer le PDF - problème de connexion",
        action: (
          <Button variant="outline" size="sm" onClick={() => handleRetryGeneration('pdf')}>
            Réessayer
          </Button>
        )
      });
      setPreviewError(true);
    } finally {
      setIsPdfLoading(false);
    }
  };
  
  const handleGenerateImage = async () => {
    // Vérifier d'abord si les données nécessaires sont présentes
    if (!action.templateData || !action.userId) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Informations manquantes pour générer l'image"
      });
      return;
    }
    
    setIsImageLoading(true);
    try {
      const result = await generatePDFClient(
        action.templateType,
        action.templateData,
        action.userId,
        action.sessionId || "",
        "image" // Specify image generation type
      );
      
      if (result.success && result.url) {
        // Store both URLs - one for preview, one for direct download
        setPreviewUrl(result.url);
        setDownloadUrl(result.downloadUrl || result.url);
        setPreviewType("image");
        setShowPreviewDialog(true);
        setPreviewError(false);
        
        toast({
          title: "Image générée",
          description: `L'image du document ${action.documentNumber || ''} est prête à être visualisée.`
        });
      } else {
        setLastError(result.errorMessage || "Erreur lors de la génération de l'image");
        setApiStatus('error');
        toast({
          variant: "destructive",
          title: "Erreur de génération",
          description: result.errorMessage || "Une erreur s'est produite lors de la génération de l'image.",
          action: (
            <Button variant="outline" size="sm" onClick={() => handleRetryGeneration('image')}>
              Réessayer
            </Button>
          )
        });
        setPreviewError(true);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
      setLastError(errorMessage);
      setApiStatus('error');
      appLogger.error("Image Generation UI Error:", error);
      toast({
        variant: "destructive",
        title: "Erreur technique",
        description: "Impossible de générer l'image - problème de connexion",
        action: (
          <Button variant="outline" size="sm" onClick={() => handleRetryGeneration('image')}>
            Réessayer
          </Button>
        )
      });
      setPreviewError(true);
    } finally {
      setIsImageLoading(false);
    }
  };

  // Fonction de téléchargement améliorée avec gestion d'erreur renforcée
  const handleDownloadFile = async () => {
    if (!downloadUrl && !previewUrl) return;
    
    try {
      setIsDownloading(true);
      
      // Détermine le nom de fichier à utiliser
      const fileName = action.filename || 
        `${action.templateType}-${action.documentNumber || "document"}.${previewType === 'pdf' ? 'pdf' : 'png'}`;
      
      // URL à utiliser - priorité à l'URL de téléchargement direct
      const urlToUse = downloadUrl || previewUrl;
      
      // Log pour débogage
      appLogger.info("🔽 Téléchargement du fichier", { 
        downloadUrl: urlToUse, 
        fileName, 
        previewType,
        isDirectDownload: !!downloadUrl
      });
      
      // Utiliser directement l'API de téléchargement du navigateur
      const link = document.createElement('a');
      link.href = urlToUse as string;
      link.download = fileName;
      link.target = '_blank'; // Assure que ça fonctionne même sur certains navigateurs plus anciens
      link.rel = 'noopener noreferrer';
      
      // Ajouter l'élément au DOM, le cliquer, puis le supprimer
      document.body.appendChild(link);
      link.click();
      
      // Petit délai avant de supprimer l'élément pour s'assurer que le téléchargement commence
      setTimeout(() => {
        document.body.removeChild(link);
        
        // Notification de succès
        toast({
          title: "Téléchargement lancé",
          description: `Le document ${action.documentNumber || ''} est en cours de téléchargement.`
        });
        
        setIsDownloading(false);
      }, 100);
      
    } catch (error) {
      console.error("Erreur lors du téléchargement:", error);
      toast({
        variant: "destructive",
        title: "Erreur de téléchargement",
        description: "Impossible de télécharger le fichier. Veuillez réessayer."
      });
      setIsDownloading(false);
    }
  };

  const handleRetryGeneration = async (type: 'pdf' | 'image') => {
    setRetryCount(prev => prev + 1);
    setLastError(null);
    setApiStatus('unknown');
    appLogger.info(`🔄 Retrying ${type} generation`, { 
      templateType: action.templateType, 
      retryCount: retryCount + 1,
      documentNumber: action.documentNumber 
    });
    
    if (type === 'pdf') {
      await handleDownloadPDF();
    } else {
      await handleGenerateImage();
    }
  };

  const closePreviewDialog = () => {
    setShowPreviewDialog(false);
  };

  return (
    <>
      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-4 py-3 border-b">
            <div className="flex items-center justify-between w-full">
              <DialogTitle>
                {previewType === "pdf" ? "Aperçu PDF" : "Aperçu Image"} - {action.filename || `${action.templateType} ${action.documentNumber || ""}`}
              </DialogTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleDownloadFile} 
                className="ml-auto mr-8"
                aria-label="Télécharger le fichier"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500 mr-2"></div>
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                {isDownloading ? "Téléchargement..." : "Télécharger"}
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-0 min-h-[60vh]">
            {previewError ? (
              <div className="flex flex-col items-center justify-center h-full p-4 text-center">
                <AlertTriangle className="h-16 w-16 text-yellow-500 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Erreur de chargement du document</h3>
                <p className="text-gray-500 mb-4">Impossible d'afficher le document demandé</p>
                <Button variant="outline" onClick={closePreviewDialog}>Fermer</Button>
              </div>
            ) : previewType === "pdf" ? (
              <iframe 
                src={previewUrl || ""} 
                className="w-full h-full min-h-[60vh]" 
                title="PDF Viewer"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50">
                <img 
                  src={previewUrl || ""} 
                  alt="Document preview" 
                  className="max-w-full max-h-[70vh] object-contain"
                  onError={() => setPreviewError(true)}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex justify-center my-2 relative">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full"
        >
          <Card className="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-2">
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex-shrink-0 bg-orange-50 p-2 rounded-md">
                <File className="h-5 w-5 text-orange-600" />
              </div>
              
              <div className="flex-grow">
                <div className="flex items-center flex-wrap gap-1">
                  <h4 className="text-sm font-medium text-gray-800">
                    {action.templateType.charAt(0).toUpperCase() + action.templateType.slice(1)}
                  </h4>
                  {action.documentNumber && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100">
                      #{action.documentNumber}
                    </Badge>
                  )}
                </div>
                {action.filename && (
                  <p className="text-xs text-gray-500 truncate max-w-[200px] md:max-w-full">{action.filename}</p>
                )}
              </div>
            </div>
            
            <div className={`flex items-center gap-2 mt-2 md:mt-0 ${isMobile ? 'w-full justify-between' : ''}`}>
              
              {action.status === "pending" ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500"></div>
                  <span className="text-xs text-gray-500">Génération...</span>
                </div>
              ) : action.status === "error" ? (
                <div className="flex flex-col gap-2 w-full">
                  <div className="flex items-center gap-2 justify-between">
                    <span className="text-xs text-red-500">Erreur de génération</span>
                    {onRemove && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemove}
                        className="text-gray-400 hover:bg-gray-100 hover:text-red-600 h-7 w-7 p-0 rounded-full border border-gray-300"
                        aria-label="Fermer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Error details and retry options */}
                  <div className="flex flex-col gap-2">
                    {lastError && (
                      <p className="text-xs text-gray-600 bg-red-50 p-2 rounded border">
                        {lastError}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryGeneration('pdf')}
                        disabled={isPdfLoading}
                        className="flex-1 text-xs py-1 h-7"
                      >
                        {isPdfLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Réessayer PDF
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRetryGeneration('image')}
                        disabled={isImageLoading}
                        className="flex-1 text-xs py-1 h-7"
                      >
                        {isImageLoading ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Réessayer Image
                      </Button>
                    </div>
                    
                    {/* Webhook status indicator */}
                    <ApiStatus 
                      status={apiStatus} 
                      onStatusChange={setApiStatus}
                      compact={true}
                    />
                    
                    {retryCount > 0 && (
                      <p className="text-xs text-gray-500">
                        Tentatives: {retryCount}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`flex items-center gap-2 ${isMobile ? 'w-full flex-wrap justify-between' : ''}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`text-xs py-1 h-7 bg-white hover:bg-gray-50 border-orange-200 text-orange-700 hover:bg-orange-50 ${isMobile ? 'flex-1' : ''}`}
                    onClick={handleDownloadPDF}
                    disabled={isPdfLoading}
                  >
                    {isPdfLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-orange-500 mr-1"></div>
                    ) : previewType === "pdf" && previewUrl ? (
                      <Eye className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <File className="h-3.5 w-3.5 mr-1" />
                    )}
                    {previewType === "pdf" && previewUrl ? "Voir PDF" : "Nouveau PDF"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className={`text-xs py-1 h-7 bg-white hover:bg-gray-50 ${isMobile ? 'flex-1' : ''}`}
                    onClick={handleGenerateImage}
                    disabled={isImageLoading}
                  >
                    {isImageLoading ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-500 mr-1"></div>
                    ) : previewType === "image" && previewUrl ? (
                      <Eye className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Image className="h-3.5 w-3.5 mr-1" />
                    )}
                    {previewType === "image" && previewUrl ? "Voir Image" : "Nouvelle Image"}
                  </Button>
                  
                  {onRemove && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemove}
                      className="text-gray-400 hover:bg-gray-100 hover:text-red-600 h-7 w-7 p-0 rounded-full border border-gray-300"
                      aria-label="Fermer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default PDFActionMessage;
