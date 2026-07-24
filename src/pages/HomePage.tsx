
import React from "react";
import { useNavigate } from "react-router-dom";
import { User } from "@/types";
import {
  TrendingUp,
  Folder,
  MessageSquare,
  ClipboardCheck,
  Package,
  Boxes,
  FileText,
  BookOpen,
  Bot,
  Zap,
  Sparkles,
  Wrench,
  DollarSign,
  BriefcaseBusiness,
  Settings,
  Hammer,
  Receipt,
} from "lucide-react";
import { useHomeCounters, type HomeCounters } from "@/hooks/useHomeCounters";
import { usePageVisit } from "@/hooks/usePageVisit";
import HomeMiniKanban from "@/components/home/HomeMiniKanban";
import MiniMonBara from "@/components/dashboard/MiniMonBara";

interface HomePageProps {
  user: User | null;
}

interface HomeCard {
  id: string;
  title: string;
  icon: React.ReactNode;
  path: string;
  color: string;
  counterKey?: keyof HomeCounters;
}

const cardDefs: Record<string, HomeCard> = {
  finances: {
    id: "finances",
    title: "Finances",
    icon: <TrendingUp className="h-7 w-7" />,
    path: "/finances",
    color: "bg-emerald-100 text-emerald-700",
    counterKey: "finances",
  },
  projet: {
    id: "projet",
    title: "Projet",
    icon: <Folder className="h-7 w-7" />,
    path: "/projects",
    color: "bg-blue-100 text-blue-700",
    counterKey: "projets",
  },
  wari: {
    id: "wari",
    title: "Wari",
    icon: <MessageSquare className="h-7 w-7" />,
    path: "/wari",
    color: "bg-purple-100 text-purple-700",
  },
  monBara: {
    id: "monBara",
    title: "Mon Bara",
    icon: <ClipboardCheck className="h-7 w-7" />,
    path: "/mon-bara",
    color: "bg-amber-100 text-amber-700",
    counterKey: "monBara",
  },
  produit: {
    id: "produit",
    title: "Produit",
    icon: <Package className="h-7 w-7" />,
    path: "/products",
    color: "bg-rose-100 text-rose-700",
  },
  materiaux: {
    id: "materiaux",
    title: "Matériaux",
    icon: <Boxes className="h-7 w-7" />,
    path: "/materials",
    color: "bg-amber-100 text-amber-700",
  },
  demande: {
    id: "demande",
    title: "Demande",
    icon: <FileText className="h-7 w-7" />,
    path: "/demande",
    color: "bg-indigo-100 text-indigo-700",
    counterKey: "demandes",
  },
  procedure: {
    id: "procedure",
    title: "Procédures",
    icon: <BookOpen className="h-7 w-7" />,
    path: "/procedures",
    color: "bg-teal-100 text-teal-700",
  },
  agents: {
    id: "agents",
    title: "Agents",
    icon: <Bot className="h-7 w-7" />,
    path: "/agent-config",
    color: "bg-violet-100 text-violet-700",
  },
  testCycle: {
    id: "testCycle",
    title: "Test Cycle",
    icon: <Zap className="h-7 w-7" />,
    path: "/test-cycle",
    color: "bg-orange-100 text-orange-700",
  },
  configurateur: {
    id: "configurateur",
    title: "Configurateur",
    icon: <Wrench className="h-7 w-7" />,
    path: "/configurateur",
    color: "bg-orange-100 text-orange-700",
  },
  infinityMirror: {
    id: "infinityMirror",
    title: "Miroir Infini",
    icon: <Sparkles className="h-7 w-7" />,
    path: "/infinity-mirror",
    color: "bg-cyan-100 text-cyan-700",
  cdcBuilder: {
    id: "cdcBuilder",
    title: "Fabrication",
    description: "Construire un cahier des charges",
    icon: <Hammer className="h-7 w-7" />,
    path: "/cdc-liste",
    color: "bg-orange-100 text-orange-700",
  },
  factures: {
    id: "factures",
    title: "Factures",
    icon: <Receipt className="h-7 w-7" />,
    path: "/factures",
    color: "bg-orange-100 text-orange-700",
  },
};

const roleCards: Record<string, string[]> = {
  directeur: ["finances", "projet", "monBara", "produit", "materiaux", "procedure", "agents", "cdcBuilder", "factures"],
  directrice_adjointe: ["finances", "projet", "monBara", "produit", "materiaux", "cdcBuilder", "factures"],
  commerciale: ["projet", "demande", "monBara", "produit", "factures"],
  chef_technique: ["demande", "monBara", "produit", "cdcBuilder"],
  technicien_adjoint: ["demande", "monBara"],
  superviseur_logistique: ["demande", "monBara", "materiaux"],
};

/**
 * Sections de la HomePage.
 * Chaque section a un bandeau titre et une grille 2 colonnes de boutons.
 * On scroll pour passer d'une section à l'autre.
 * Une section est masquée si aucune carte n'est autorisée pour le rôle.
 */
const homeSections: {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  cardIds: string[];
}[] = [
  {
    id: "finance",
    title: "Finance",
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-emerald-500 to-emerald-600",
    cardIds: ["finances", "demande"],
  },
  {
    id: "travail",
    title: "Travail",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    color: "from-blue-500 to-blue-600",
    cardIds: ["projet", "monBara", "factures", "cdcBuilder"],
  },
  {
    id: "catalogue",
    title: "Catalogue",
    icon: <Package className="h-5 w-5" />,
    color: "from-rose-500 to-rose-600",
    cardIds: ["produit", "materiaux"],
  },
  {
    id: "atelier",
    title: "Atelier",
    icon: <Wrench className="h-5 w-5" />,
    color: "from-amber-500 to-amber-600",
    cardIds: [],
  },
  {
    id: "parametres",
    title: "Paramètres",
    icon: <Settings className="h-5 w-5" />,
    color: "from-violet-500 to-violet-600",
    cardIds: ["procedure", "agents"],
  },
];

const pageToVisitKey: Record<string, string> = {
  "/finances": "finances",
  "/projects": "projets",
  "/mon-bara": "mon_bara",
  "/demande": "demandes",
  "/factures": "factures",
  "/facture-builder": "factures",
};

// ── Bouton simplifié : icône + titre ──

const SimpleCardButton: React.FC<{
  card: HomeCard;
  counters: HomeCounters | null;
  onClick: () => void;
}> = ({ card, counters, onClick }) => {
  const badgeCount = card.counterKey && counters ? counters[card.counterKey] : 0;
  const showBadge = badgeCount > 0;

  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-gray-100 bg-white shadow-sm hover:shadow-lg hover:border-brand-orange/30 transition-all duration-200 active:scale-95"
    >
      {showBadge && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shadow-md">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        </div>
      )}

      <div
        className={`p-3 rounded-xl group-hover:scale-110 transition-transform duration-200 ${card.color}`}
      >
        {card.icon}
      </div>

      <span className="text-sm font-semibold text-gray-800">{card.title}</span>
    </button>
  );
};

// ── Composant principal ──

const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const navigate = useNavigate();
  const { data: counters } = useHomeCounters(user);
  const { recordVisit } = usePageVisit();

  if (!user) return null;

  const cardIds = roleCards[user.role] || ["wari", "projet", "monBara", "demande"];
  const allowedCardIds = new Set(cardIds);

  const handleNavigate = (card: HomeCard) => {
    const visitKey = pageToVisitKey[card.path];
    if (visitKey) {
      recordVisit(user.id, visitKey);
    }
    if (card.path === "/mon-bara") {
      recordVisit(user.id, "mon_bara");
    }
    navigate(card.path);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Salutation */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Bonjour {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Que veux-tu faire ?</p>
      </div>

      {/* Mini Mon Bara — tâches à faire / en cours */}
      <MiniMonBara userRole={user.role} userName={user.name} />

      {/* Mini Kanban des projets en cours */}
      <HomeMiniKanban user={user} />

      {/* Sections avec grille 2 colonnes — scroll pour naviguer */}
      <div className="flex flex-col gap-8">
        {homeSections.map((section) => {
          const sectionCards = section.cardIds
            .filter((id) => allowedCardIds.has(id))
            .map((id) => cardDefs[id])
            .filter(Boolean);

          if (sectionCards.length === 0) return null;

          return (
            <div key={section.id}>
              {/* Bandeau titre de section */}
              <div
                className={`flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-r ${section.color} text-white shadow-md mb-4`}
              >
                <div className="p-1.5 bg-white/20 rounded-lg">
                  {section.icon}
                </div>
                <span className="font-semibold text-base">{section.title}</span>
              </div>

              {/* Grille 2 colonnes de boutons */}
              <div className="grid grid-cols-2 gap-3">
                {sectionCards.map((card) => (
                  <SimpleCardButton
                    key={card.id}
                    card={card}
                    counters={counters ?? null}
                    onClick={() => handleNavigate(card)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HomePage;
