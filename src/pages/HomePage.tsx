
import React from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/types";
import {
  TrendingUp,
  Folder,
  MessageSquare,
  ClipboardCheck,
  Package,
  FileText,
  BookOpen,
  Bot,
  Zap,
} from "lucide-react";
import { useHomeCounters, type HomeCounters } from "@/hooks/useHomeCounters";
import { usePageVisit } from "@/hooks/usePageVisit";

interface HomePageProps {
  user: User | null;
}

interface HomeCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  /** Clé du compteur associé (optionnel) */
  counterKey?: keyof HomeCounters;
}

const cardDefs: Record<string, HomeCard> = {
  finances: {
    id: "finances",
    title: "Finances",
    description: "Trésorerie, demandes, rapports financiers",
    icon: <TrendingUp className="h-8 w-8" />,
    path: "/finances",
    color: "bg-emerald-100 text-emerald-700",
    counterKey: "finances",
  },
  projet: {
    id: "projet",
    title: "Projet",
    description: "Liste des projets, kanban, checklists",
    icon: <Folder className="h-8 w-8" />,
    path: "/projects",
    color: "bg-blue-100 text-blue-700",
    counterKey: "projets",
  },
  wari: {
    id: "wari",
    title: "Wari",
    description: "Le chat — discute avec l'assistant",
    icon: <MessageSquare className="h-8 w-8" />,
    path: "/wari",
    color: "bg-purple-100 text-purple-700",
  },
  monBara: {
    id: "monBara",
    title: "Mon Bara",
    description: "Mes checklists et tâches en cours",
    icon: <ClipboardCheck className="h-8 w-8" />,
    path: "/mon-bara",
    color: "bg-amber-100 text-amber-700",
    counterKey: "monBara",
  },
  produit: {
    id: "produit",
    title: "Produit",
    description: "Catalogue des produits et prix",
    icon: <Package className="h-8 w-8" />,
    path: "/products",
    color: "bg-rose-100 text-rose-700",
  },
  demande: {
    id: "demande",
    title: "Demande",
    description: "Créer une demande de matériel ou service",
    icon: <FileText className="h-8 w-8" />,
    path: "/demande",
    color: "bg-indigo-100 text-indigo-700",
    counterKey: "demandes",
  },
  procedure: {
    id: "procedure",
    title: "Procédures",
    description: "Manuels et règles de fabrication",
    icon: <BookOpen className="h-8 w-8" />,
    path: "/procedures",
    color: "bg-teal-100 text-teal-700",
  },
  agents: {
    id: "agents",
    title: "Agents",
    description: "Configuration des agents Hermes",
    icon: <Bot className="h-8 w-8" />,
    path: "/agent-config",
    color: "bg-violet-100 text-violet-700",
  },
  testCycle: {
    id: "testCycle",
    title: "Test Cycle",
    description: "Simulation complète du cycle projet",
    icon: <Zap className="h-8 w-8" />,
    path: "/test-cycle",
    color: "bg-orange-100 text-orange-700",
  },
};

// Rôles → cartes affichées
const roleCards: Record<string, string[]> = {
  directeur: ["finances", "projet", "wari", "monBara", "produit", "procedure", "agents", "testCycle"],
  directrice_adjointe: ["finances", "projet", "wari", "monBara", "produit"],
  commerciale: ["projet", "demande", "wari", "monBara", "produit"],
  chef_technique: ["demande", "monBara"],
  technicien_adjoint: ["demande", "monBara"],
  superviseur_logistique: ["demande", "monBara"],
};

/**
 * Mapping page → clé de visite pour user_page_visits
 */
const pageToVisitKey: Record<string, string> = {
  "/finances": "finances",
  "/projects": "projets",
  "/mon-bara": "mon_bara",
  "/demande": "demandes",
};

const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const navigate = useNavigate();
  const { data: counters } = useHomeCounters(user);
  const { recordVisit } = usePageVisit();

  if (!user) return null;

  const cardIds = roleCards[user.role] || ["wari", "projet", "monBara", "demande"];
  const cards = cardIds.map((id) => cardDefs[id]).filter(Boolean);

  const handleNavigate = (card: HomeCard) => {
    // Enregistrer la visite AVANT de naviguer
    const visitKey = pageToVisitKey[card.path];
    if (visitKey) {
      recordVisit(user.id, visitKey);
    }
    // Pour Mon Bara, on utilise déjà la clé 'mon_bara'
    if (card.path === "/mon-bara") {
      recordVisit(user.id, "mon_bara");
    }
    navigate(card.path);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Salutation */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Bonjour {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Que veux-tu faire ?</p>
      </div>

      {/* Grille de cartes — 2 colonnes */}
      <div className="grid grid-cols-2 gap-4">
        {cards.map((card) => {
          const badgeCount =
            card.counterKey && counters ? counters[card.counterKey] : 0;
          const showBadge = badgeCount > 0;

          return (
            <button
              key={card.id}
              onClick={() => handleNavigate(card)}
              className="group relative flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-gray-100 bg-white shadow-sm hover:shadow-lg hover:border-brand-orange/30 transition-all duration-200 text-left min-h-[160px]"
            >
              {/* Badge compteur */}
              {showBadge && (
                <div className="absolute -top-2 -right-2 z-10">
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shadow-md animate-in fade-in zoom-in duration-200">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                </div>
              )}

              {/* Icône */}
              <div
                className={`p-4 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200 ${card.color}`}
              >
                {card.icon}
              </div>

              {/* Titre */}
              <h2 className="text-lg font-semibold text-gray-800 group-hover:text-brand-orange transition-colors">
                {card.title}
              </h2>

              {/* Description */}
              <p className="text-sm text-gray-500 mt-1 text-center leading-tight">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
