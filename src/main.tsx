
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeStorage } from "./services/storage";
import { appLogger } from "@/utils/logger";

// PWA: Service Worker is auto-registered by vite-plugin-pwa (registerType: 'autoUpdate')
// The plugin injects the SW registration code into the build output automatically.
// No manual registration needed here.

// PWA: Capture beforeinstallprompt for custom install button
if (typeof window !== 'undefined') {
  (window as any).deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar from appearing
    e.preventDefault();
    // Stash the event so it can be triggered later by the InstallBanner
    (window as any).deferredPrompt = e;
    appLogger.info('📲 beforeinstallprompt capturé — app installable');
  });

  window.addEventListener('appinstalled', () => {
    (window as any).deferredPrompt = null;
    appLogger.info('✅ App installée avec succès');
  });
}

// Initialize storage buckets on application start with better error handling
const initApp = async () => {
  appLogger.info("🚀 Starting application initialization...");
  
  try {
    // Initialize storage buckets
    appLogger.info("🔄 Starting storage initialization...");
    const storageSuccess = await initializeStorage();
    
    if (storageSuccess) {
      appLogger.info("✅ Storage initialized successfully");
    } else {
      appLogger.error("❌ Storage initialization failed");
      // Try again once more in case of failure
      setTimeout(async () => {
        appLogger.info("🔄 Retrying storage initialization...");
        const retrySuccess = await initializeStorage();
        
        if (retrySuccess) {
          appLogger.info("✅ Storage initialization succeeded on retry");
        } else {
          appLogger.error("❌ Storage initialization failed on retry");
        }
      }, 3000); // Wait 3 seconds before retry
    }
  } catch (err) {
    appLogger.error("❌ Application initialization error", { 
      error: err,
      errorDetails: err instanceof Error ? err.message : String(err)
    });
  }
};

// Start initialization process
initApp();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
