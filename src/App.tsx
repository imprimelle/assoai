
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
import ProjectDetail from "./pages/ProjectDetail";
import AgentConfig from "./pages/AgentConfig";
import TestCycleRunner from "./pages/TestCycleRunner";
import Finance from "./pages/Finance";
import Procedures from "./pages/Procedures";
import Contacts from "./pages/Contacts";
import PublicChecklist from "./pages/PublicChecklist";
import PublicChecklists from "./pages/PublicChecklists";
import PublicDocument from "./pages/PublicDocument";
import NotFound from "./pages/NotFound";
import InstallBanner from "./components/pwa/InstallBanner";
import { initializeRealtime } from "./integrations/supabase/realtime";
import Login from "./components/auth/Login";
import MinimalHeader from "./components/ui/MinimalHeader";
import HomePage from "./pages/HomePage";

import Wari from "./pages/Wari";
import Demande from "./pages/Demande";
import { User } from "./types";
import { supabase } from "./integrations/supabase/client";
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

// Guard : vérifie qu'un utilisateur est connecté
const RequireAuth: React.FC<{
  children: React.ReactNode;
  persistentSessionId: string | null;
}> = ({ children, persistentSessionId }) => {
  if (!persistentSessionId) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

// Composant pour gérer l'affichage conditionnel du header
const AppContent = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(
    () => {
      try {
        const stored = localStorage.getItem("currentUser");
        return stored ? JSON.parse(stored) : null;
      } catch {
        localStorage.removeItem("currentUser");
        return null;
      }
    }
  );
  const [persistentSessionId, setPersistentSessionId] = useState<string | null>(
    () => localStorage.getItem("persistentSessionId")
  );
  const location = useLocation();
  const isLoginPage = location.pathname === "/login";
  const hideHeader = isLoginPage;

  useEffect(() => {
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
    const syncFromContact = async () => {
      if (currentUser && !persistentSessionId) {
        const { data, error } = await supabase
          .from("human_contacts")
          .select("session_id")
          .eq("id", currentUser.id)
          .single();
        if (error) {
          console.error("❌ lecture human_contacts.session_id échouée", error);
          return;
        }
        if (data?.session_id) {
          setPersistentSessionId(data.session_id);
          localStorage.setItem("persistentSessionId", data.session_id);
        }
      }
    };
    syncFromContact();
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

  // Rendu conditionnel du MinimalHeader
  const renderHeader = () => {
    if (hideHeader) return null;
    return (
      <MinimalHeader
        userName={currentUser?.name}
        onLogout={handleLogout}
      />
    );
  };

  return (
    <ChatProvider>
      <ErrorBoundary>
      <div className="flex flex-col h-screen">
        {/* Notification Handler - Always present to handle notifications */}
        {currentUser && <NotificationHandler />}

        {/* Header minimal (pas de navbar) */}
        {renderHeader()}

        <div className="flex-1 overflow-y-auto">
          <Routes>
            {/* Page d'accueil par rôle */}
            <Route
              path="/"
              element={
                persistentSessionId ? (
                  <HomePage user={currentUser} />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Chat pleine page (Wari) */}
            <Route
              path="/wari"
              element={
                persistentSessionId && currentUser ? (
                  <Wari
                    user={currentUser}
                    persistentSessionId={persistentSessionId}
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Chat legacy */}
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

            {/* Login */}
            <Route
              path="/login"
              element={
                <Login
                  onSuccess={(user, sessionId) => {
                    setCurrentUser(user);
                    setPersistentSessionId(sessionId);
                    localStorage.setItem("persistentSessionId", sessionId);
                    localStorage.setItem("currentUser", JSON.stringify(user));
                  }}
                />
              }
            />

            {/* Profil */}
            <Route
              path="/profile"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <Profile
                    user={currentUser}
                    onLogout={handleLogout}
                  />
                </RequireAuth>
              }
            />

            {/* Projets */}
            <Route
              path="/projects"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <Projects
                    user={currentUser}
                    persistentSessionId={persistentSessionId}
                  />
                </RequireAuth>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <ProjectDetail
                    user={currentUser}
                    persistentSessionId={persistentSessionId}
                  />
                </RequireAuth>
              }
            />

            {/* Mon Bara — redirige vers la page publique de checklists */}
            <Route
              path="/mon-bara"
              element={
                persistentSessionId && currentUser ? (
                  <Navigate
                    to={`/public/checklists?user=${encodeURIComponent(currentUser.name)}&role=${encodeURIComponent(currentUser.role)}`}
                    replace
                  />
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Demande — formulaire simplifié (hors directeur/adjointe) */}
            <Route
              path="/demande"
              element={
                persistentSessionId && currentUser ? (
                  (currentUser.role === "directeur" || currentUser.role === "directrice_adjointe") ? (
                    <Navigate to="/" replace />
                  ) : (
                    <Demande user={currentUser} />
                  )
                ) : (
                  <Navigate to="/login" replace />
                )
              }
            />

            {/* Finances — réservé Directeur / Adjointe */}
            <Route
              path="/finances"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  {currentUser && (currentUser.role === "directeur" || currentUser.role === "directrice_adjointe") ? (
                    <Finance />
                  ) : (
                    <Navigate to="/" replace />
                  )}
                </RequireAuth>
              }
            />

            {/* Procédures */}
            <Route
              path="/procedures"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <Procedures />
                </RequireAuth>
              }
            />

            {/* Test Cycle (Directeur uniquement) */}
            <Route
              path="/test-cycle"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  {currentUser && currentUser.role === "directeur" ? (
                    <TestCycleRunner user={currentUser} />
                  ) : (
                    <Navigate to="/" replace />
                  )}
                </RequireAuth>
              }
            />

            {/* Contacts */}
            <Route
              path="/contacts"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <Contacts />
                </RequireAuth>
              }
            />

            {/* Produits */}
            <Route
              path="/products"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <ProductCatalog />
                </RequireAuth>
              }
            />

            {/* 🔒 Pages publiques — désormais protégées par login */}
            <Route
              path="/public/checklists"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <PublicChecklists />
                </RequireAuth>
              }
            />
            <Route
              path="/public/checklist/:id"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <PublicChecklist />
                </RequireAuth>
              }
            />
            <Route
              path="/public/doc/:id"
              element={
                <RequireAuth persistentSessionId={persistentSessionId}>
                  <PublicDocument />
                </RequireAuth>
              }
            />

            {/* Pages inchangées */}
            <Route path="/demo" element={<Demo />} />
            <Route path="/logs" element={<Logs />} />
            <Route path="/library" element={<CrmTemplates />} />
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
