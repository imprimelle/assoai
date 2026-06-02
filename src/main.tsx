
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeStorage } from "./services/storage";
import { appLogger } from "@/utils/logger";

// Initialize deferredPrompt property for PWA install banner
if (typeof window !== 'undefined') {
  // Use type assertion to avoid TypeScript errors
  (window as any).deferredPrompt = null;
}

// Register the service worker for PWA functionality
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        appLogger.info('✅ Service Worker registered successfully', {
          scope: registration.scope
        });
      })
      .catch(error => {
        appLogger.error('❌ Service Worker registration failed', {
          error: error,
          errorMessage: error instanceof Error ? error.message : String(error)
        });
      });
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
