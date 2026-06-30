
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, X, Share2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const InstallBanner: React.FC = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Détecter iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if the banner has been dismissed in the last 7 days (or 24h for non-iOS)
    const storageKey = iOS ? 'pwa-ios-hint-dismissed' : 'pwa-banner-dismissed';
    const lastDismissed = localStorage.getItem(storageKey);
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed, 10);
      const cooldownMs = iOS ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < cooldownMs) {
        setDismissed(true);
        return;
      }
    }

    // Check if the deferredPrompt is already available (captured in main.tsx)
    const dp = (window as any).deferredPrompt;
    if (dp) {
      setIsInstallable(true);
      return;
    }

    // Sur iOS, on affiche après un délai (pas de beforeinstallprompt)
    if (iOS) {
      const timer = setTimeout(() => setIsInstallable(true), 4000);
      return () => clearTimeout(timer);
    }

    // Listen for the event (may arrive after mount)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      (window as any).deferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    // iOS : pas de prompt, on affiche juste un toast d'instruction
    if (isIOS) {
      toast({
        title: "Installer AssoAI",
        description: "Appuyez sur Partager ↑ puis « Sur l'écran d'accueil »"
      });
      handleDismiss();
      return;
    }

    const deferredPrompt = (window as any).deferredPrompt;
    if (!deferredPrompt) return;
    
    // Show the installation prompt
    deferredPrompt.prompt();
    
    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "Installation réussie",
        description: "L'application a été installée avec succès"
      });
    }
    
    // Reset the installation event
    (window as any).deferredPrompt = null;
    setIsInstallable(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    const storageKey = isIOS ? 'pwa-ios-hint-dismissed' : 'pwa-banner-dismissed';
    localStorage.setItem(storageKey, Date.now().toString());
  };

  if (!isInstallable || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={isIOS
        ? "fixed bottom-4 left-0 right-0 mx-auto w-[90%] max-w-md bg-white rounded-xl shadow-lg p-4 border border-gray-200 z-50"
        : "fixed bottom-4 left-0 right-0 mx-auto w-[90%] max-w-md bg-gradient-to-r from-brand-orange to-orange-500 rounded-lg shadow-lg p-4 border border-orange-300 z-50"
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <h3 className={isIOS ? "text-sm font-bold text-gray-900" : "text-sm font-bold text-white"}>
            {isIOS ? "Installer AssoAI" : "Téléchargez notre application"}
          </h3>
          <p className={isIOS ? "text-xs text-gray-500 mt-0.5" : "text-xs text-white/90"}>
            {isIOS
              ? "Appuyez sur Partager ↑ puis « Sur l'écran d'accueil »"
              : "Accédez à AssoAI directement depuis votre écran d'accueil"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleInstallClick} 
            size="sm" 
            className={isIOS
              ? "bg-brand-orange text-white hover:bg-brand-orange/90 mobile-touch-target"
              : "bg-white text-brand-orange hover:bg-white/90 hover:text-orange-600 mobile-touch-target"
            }
          >
            {isIOS ? <Share2 className="h-4 w-4 mr-1" /> : <Download className="h-4 w-4 mr-1" />}
            {isIOS ? "Comment faire" : "Installer"}
          </Button>
          <button 
            onClick={handleDismiss}
            className={isIOS ? "p-1 text-gray-400 hover:text-gray-600" : "p-1 text-white/80 hover:text-white"}
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default InstallBanner;
