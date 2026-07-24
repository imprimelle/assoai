
import React, { useState } from "react";
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
  ChevronDown,
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
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
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
  materiaux: {
    id: "materiaux",
    title: "Matériaux",
    description: "Catalogue des matières premières",
    icon: <Boxes className="h-8 w-8" />,
    path: "/materials",
    color: "bg-amber-100 text-amber-700",
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
  configurateur: {
    id: "configurateur",
    title: "Configurateur",
    description: "Visualiser et configurer les produits en 3D",
    icon: <Wrench className="h-8 w-8" />,
    path: "/configurateur",
    color: "bg-orange-100 text-orange-700",
  },
  infinityMirror: {
    id: "infinityMirror",
    title: "Miroir Infini",
    description: "Simulateur 3D d'effet miroir infini",
    icon: <Sparkles className="h-8 w-8" />,
    path: "/infinity-mirror",
    color: "bg-cyan-100 text-cyan-700",
  },
  cdcBuilder: {
    id: "cdcBuilder",
    title: "CDC Builder",
    description: "Construire un cahier des charges manuellement",
    icon: <Hammer className="h-8 w-8" />,
    path: "/cdc-liste",
    color: "bg-orange-100 text-orange-700",
  },
  factures: {
    id: "factures",
    title: "Factures",
    description: "Liste des factures, téléchargement PDF",
    icon: <Receipt className="h-8 w-8" />,
    path: "/factures",
    color: "bg-orange-100 text-orange-700",
  },
};

const roleCards: Record<string, string[]> = {
  directeur: ["finances", "projet", "wari", "monBara", "produit", "materiaux", "procedure", "agents", "testCycle", "configurateur", "infinityMirror", "cdcBuilder", "factures"],
  directrice_adjointe: ["finances", "projet", "wari", "monBara", "produit", "materiaux", "configurateur", "cdcBuilder", "factures"],
  commerciale: ["projet", "demande", "wari", "monBara", "produit", "factures"],
  chef_technique: ["demande", "monBara", "produit", "configurateur", "cdcBuilder"],
  technicien_adjoint: ["demande", "monBara"],
  superviseur_logistique: ["demande", "monBara", "materiaux"],
};

/**
 * Sections de la HomePage.
 * Chaque section est un bloc collapsible.
 * Fermée → bouton compact avec titre + icône.
 * Ouverte → animation de dépliement + cartes en scroll horizontal.
 * La section n'est visible que si ≥1 carte est autorisée pour le rôle.
 */
const homeSections: {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;       // couleur du bandeau header
  cardIds: string[];
}[] = [
  {
    id: "finance",
    title: "Finance",
    icon: <DollarSign className="h-5 w-5" />,
    color: "from-emerald-500 to-emerald-600",
    cardIds: ["finances", "demande", "wari"],
  },
  {
    id: "travail",
    title: "Travail",
    icon: <BriefcaseBusiness className="h-5 w-5" />,
    color: "from-blue-500 to-blue-600",
    cardIds: ["projet", "monBara"],
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
    cardIds: ["configurateur", "cdcBuilder", "infinityMirror"],
  },
  {
    id: "parametres",
    title: "Paramètres",
    icon: <Settings className="h-5 w-5" />,
    color: "from-violet-500 to-violet-600",
    cardIds: ["procedure", "agents", "testCycle"],
  },
];

const pageToVisitKey: Record<string, string> = {
  "/finances": "finances",
  "/projects": "projets",
  "/mon-bara": "mon_bara",
  "/demande": "demandes",
};

// ── Carte bouton réutilisable ──

const CardButton: React.FC<{
  card: HomeCard;
  counters: HomeCounters | null;
  onClick: () => void;
}> = ({ card, counters, onClick }) => {
  const badgeCount = card.counterKey && counters ? counters[card.counterKey] : 0;
  const showBadge = badgeCount > 0;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-gray-100 bg-white shadow-sm hover:shadow-lg hover:border-brand-orange/30 transition-all duration-200 text-left min-w-[140px] min-h-[130px] shrink-0"
    >
      {showBadge && (
        <div className="absolute -top-2 -right-2 z-10">
          <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold shadow-md animate-in fade-in zoom-in duration-200">
            {badgeCount > 99 ? "99+" : badgeCount}
          </span>
        </div>
      )}

      <div
        className={`p-4 rounded-xl mb-3 group-hover:scale-110 transition-transform duration-200 ${card.color}`}
      >
        {card.icon}
      </div>

      <h2 className="text-sm font-semibold text-gray-800 group-hover:text-brand-orange transition-colors">
        {card.title}
      </h2>

      <p className="text-xs text-gray-500 mt-1 text-center leading-tight">
        {card.description}
      </p>
    </button>
  );
};

// ── Section collapsible ──

const CollapsibleSection: React.FC<{
  section: (typeof homeSections)[number];
  cards: HomeCard[];
  counters: HomeCounters | null;
  onCardClick: (card: HomeCard) => void;
}> = ({ section, cards, counters, onCardClick }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-5">
      {/* Header — bouton collapsible */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl bg-gradient-to-r ${section.color} text-white shadow-md hover:shadow-lg transition-all duration-300 ${
          expanded ? "rounded-b-lg" : "rounded-2xl"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-white/20 rounded-lg">
            {section.icon}
          </div>
          <span className="font-semibold text-base">{section.title}</span>
          <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
            {cards.length}
          </span>
        </div>
        <ChevronDown
          className={`h-5 w-5 transition-transform duration-300 ${
            expanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* Contenu — scroll horizontal animé */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded
            ? "max-h-[500px] opacity-100 mt-3"
            : "max-h-0 opacity-0 mt-0"
        }`}
      >
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
          <div className="flex gap-3 pb-2 min-w-min">
            {cards.map((card) => (
              <CardButton
                key={card.id}
                card={card}
                counters={counters}
                onClick={() => onCardClick(card)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
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
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Salutation */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Bonjour {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-gray-500 mt-1">Que veux-tu faire ?</p>
      </div>

      {/* 🆕 Mini Mon Bara — tâches à faire / en cours */}
      <MiniMonBara userRole={user.role} userName={user.name} />

      {/* Mini Kanban des projets en cours */}
      <HomeMiniKanban user={user} />

      {/* Sections collapsibles */}
      {homeSections.map((section) => {
        const sectionCards = section.cardIds
          .filter((id) => allowedCardIds.has(id))
          .map((id) => cardDefs[id])
          .filter(Boolean);

        if (sectionCards.length === 0) return null;

        return (
          <CollapsibleSection
            key={section.id}
            section={section}
            cards={sectionCards}
            counters={counters ?? null}
            onCardClick={handleNavigate}
          />
        );
      })}
    </div>
  );
};

export default HomePage;
