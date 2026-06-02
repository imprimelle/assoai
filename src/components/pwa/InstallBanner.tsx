
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const InstallBanner: React.FC = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if the banner has been dismissed in the last 24 hours
    const lastDismissed = localStorage.getItem('pwa-banner-dismissed');
    if (lastDismissed) {
      const dismissedTime = parseInt(lastDismissed, 10);
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < twentyFourHoursInMs) {
        setDismissed(true);
      }
    }

    // Initialize deferredPrompt as null if it doesn't exist
    if (typeof window !== 'undefined') {
      // Safely set the deferredPrompt property if it's not already defined
      if (!('deferredPrompt' in window)) {
        (window as any).deferredPrompt = null;
      }
    }

    // Check if the application is installable when component mounts
    if (typeof window !== 'undefined' && 'deferredPrompt' in window && window.deferredPrompt) {
      setIsInstallable(true);
    }

    // Add a listener to detect changes to the deferredPrompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 67+ from automatically showing the prompt
      e.preventDefault();
      
      // Store the event so it can be triggered later
      (window as any).deferredPrompt = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      (window as any).deferredPrompt = null;
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.addEventListener('appinstalled', handleAppInstalled);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      }
    };
  }, []);

  const handleInstallClick = async () => {
    if (typeof window === 'undefined' || !('deferredPrompt' in window) || !window.deferredPrompt) return;
    
    // Show the installation prompt
    window.deferredPrompt.prompt();
    
    // Wait for the user's response
    const { outcome } = await window.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      toast({
        title: "Installation réussie",
        description: "L'application a été installée avec succès"
      });
      console.log('L\'installation a été acceptée');
    } else {
      console.log('L\'installation a été refusée');
    }
    
    // Reset the installation event
    (window as any).deferredPrompt = null;
    setIsInstallable(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    // Store the dismissed timestamp in localStorage
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  if (!isInstallable || dismissed) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed bottom-4 left-0 right-0 mx-auto w-[90%] max-w-md bg-gradient-to-r from-brand-orange to-orange-500 rounded-lg shadow-lg p-4 border border-orange-300 z-50"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 pr-4">
          <h3 className="text-sm font-bold text-white">Téléchargez notre application</h3>
          <p className="text-xs text-white/90">Accédez à AssoAI directement depuis votre écran d'accueil</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={handleInstallClick} 
            size="sm" 
            className="bg-white text-brand-orange hover:bg-white/90 hover:text-orange-600 mobile-touch-target"
          >
            <Download className="h-4 w-4 mr-1" /> Installer
          </Button>
          <button 
            onClick={handleDismiss}
            className="p-1 text-white/80 hover:text-white" 
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
