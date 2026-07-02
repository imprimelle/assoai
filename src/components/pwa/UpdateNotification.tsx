import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

/**
 * Bannière de notification quand une nouvelle version de l'app est disponible.
 * 
 * Fonctionne avec vite-plugin-pwa en mode registerType: 'prompt'.
 * Le registerSW.js émet un événement 'pwaNeedRefresh' quand une mise à jour
 * est disponible. L'utilisateur clique pour activer la nouvelle version.
 */
const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    // Écouter l'événement 'needRefresh' émis par registerSW.js (mode prompt)
    const handleNeedRefresh = () => {
      setUpdateAvailable(true);
    };

    // Vérifier si c'est déjà en attente (event émis avant le montage du composant)
    if ((window as any).__PWA_UPDATE_READY__) {
      setUpdateAvailable(true);
    }

    window.addEventListener('pwaNeedRefresh', handleNeedRefresh);

    return () => {
      window.removeEventListener('pwaNeedRefresh', handleNeedRefresh);
    };
  }, []);

  const handleUpdate = () => {
    setUpdating(true);
    // Appeler la fonction updateSW mise à disposition par registerSW.js (mode prompt)
    const updateSW = (window as any).__PWA_UPDATE_SW__;
    if (updateSW) {
      updateSW(true).then(() => {
        // Le SW va skipWaiting et le navigateur va recharger automatiquement
      }).catch(() => {
        // Fallback : reload simple
        window.location.reload();
      });
    } else {
      // Fallback : chercher les SW en attente et les activer
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((reg) => {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          window.location.reload();
        }).catch(() => {
          window.location.reload();
        });
      }
    }
  };

  if (!updateAvailable) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.3 }}
        className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center p-2"
      >
        <div className="bg-brand-orange text-white rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 max-w-sm w-full mx-2 animate-pulse">
          <RefreshCw className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium flex-1">
            Nouvelle version disponible
          </span>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="bg-white text-brand-orange rounded-lg px-3 py-1.5 text-xs font-bold hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {updating ? 'Mise à jour...' : 'Mettre à jour'}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default UpdateNotification;
