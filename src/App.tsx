
// src/App.tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import Index from "./pages/Index";
import Demo from "./pages/Demo";
import Logs from "./pages/Logs";
import Profile from "./pages/Profile";
import CrmTemplates from "./pages/CrmTemplates";
import ProductCatalog from "./pages/ProductCatalog";
import Projects from "./pages/Projects";
import AgentConfig from "./pages/AgentConfig";
import NotFound from "./pages/NotFound";
import InstallBanner from "./components/pwa/InstallBanner";
import { initializeRealtime } from "./integrations/supabase/realtime";
import Login from "./components/auth/Login";
import { User } from "./types";
import TopBar from "./components/ui/TopBar";
import { supabase } from "./integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import { ChatProvider } from "./contexts/ChatContext";
import SlidingChatPanel from "./components/chat/SlidingChatPanel";
import { NotificationHandler } from "./components/notifications";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { initGlobalErrorLogger } from "./services/loggerService";

// Configuration du client React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Composant pour gérer l'affichage conditionnel du TopBar
const AppContent = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [persistentSessionId, setPersistentSessionId] = useState<string | null>(
    () => localStorage.getItem("persistentSessionId")
  );
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";

  useEffect(() => {
    // Au démarrage, charger depuis le localStorage
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    const storedSession = localStorage.getItem("persistentSessionId");
    if (storedSession) {
      setPersistentSessionId(storedSession);
    }

    // Initialiser Supabase Realtime
    const initRealtime = async () => {
      try {
        await initializeRealtime();
        console.log("Réplication en temps réel initialisée");
      } catch (err) {
        console.error("Erreur d'initialisation du temps réel:", err);
      }
    };
    initRealtime();

    // Initialiser le logger global (envoi erreurs vers Supabase)
    initGlobalErrorLogger();
  }, []);

  // Si on a un user mais pas de session en local, on va la piocher en base
  useEffect(() => {
    const syncFromAppUser = async () => {
      if (currentUser && !persistentSessionId) {
        const { data, error } = await supabase
          .from("app_users")
          .select("session_id")
          .eq("id", currentUser.id)
          .single();
        if (error) {
          console.error("❌ lecture app_users.session_id échouée", error);
          return;
        }
        if (data?.session_id) {
          setPersistentSessionId(data.session_id);
          localStorage.setItem("persistentSessionId", data.session_id);
        }
      }
    };
    syncFromAppUser();
  }, [currentUser, persistentSessionId]);

  const handleLogout = () => {
    // Supprimer les données de session du localStorage
    localStorage.removeItem("persistentSessionId");
    localStorage.removeItem("currentUser");
    
    // Réinitialiser l'état
    setCurrentUser(null);
    setPersistentSessionId(null);
  };

  // Rendu du panneau de chat si l'utilisateur est connecté
  const renderChatPanel = () => {
    if (currentUser && persistentSessionId) {
      return (
        <SlidingChatPanel 
          user={currentUser} 
          persistentSessionId={persistentSessionId} 
        />
      );
    }
    return null;
  };

  return (
    <ChatProvider>
      <ErrorBoundary>
      <div className="flex flex-col h-screen">
        {/* Notification Handler - Always present to handle notifications */}
        {currentUser && <NotificationHandler />}
        
        {/* Afficher le TopBar uniquement si ce n'est pas la page de login */}
        {!isLoginPage && <TopBar />}
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route
              path="/"
              element={
                persistentSessionId ? (
                  <Dashboard />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/chat"
              element={
                persistentSessionId ? (
                  <Index
                    user={currentUser!}
                    persistentSessionId={persistentSessionId}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/login"
              element={
                <Login
                  onSuccess={(user, sessionId) => {
                    // Mettre à jour le contexte global après connexion
                    setCurrentUser(user);
                    setPersistentSessionId(sessionId);
                    // ← Ajouter ces deux lignes :
                    localStorage.setItem("persistentSessionId", sessionId);
                    localStorage.setItem("currentUser", JSON.stringify(user));
                  }}
                />
              }
            />
            <Route
              path="/profile"
              element={
                persistentSessionId ? (
                  <Profile 
                    user={currentUser} 
                    onLogout={handleLogout} 
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/projects"
              element={
                persistentSessionId ? (
                  <Projects 
                    user={currentUser} 
                    persistentSessionId={persistentSessionId}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                persistentSessionId ? (
                  <Projects 
                    user={currentUser} 
                    persistentSessionId={persistentSessionId}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />
            <Route path="/demo" element={<Demo />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/library" element={<CrmTemplates />} />
            <Route path="/products" element={<ProductCatalog />} />
            <Route path="/agent-config" element={<AgentConfig />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        
        {/* Panneau de chat coulissant */}
        {renderChatPanel()}
      </div>
      </ErrorBoundary>
    </ChatProvider>
  );
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <InstallBanner />
          <AppContent />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
