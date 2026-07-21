
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
} from "lucide-react";
import { useHomeCounters, type HomeCounters } from "@/hooks/useHomeCounters";
import { usePageVisit } from "@/hooks/usePageVisit";
import HomeMiniKanban from "@/components/home/HomeMiniKanban";

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
};

// Rôles → cartes affichées
const roleCards: Record<string, string[]> = {
  directeur: ["finances", "projet", "wari", "monBara", "produit", "materiaux", "procedure", "agents", "testCycle", "configurateur", "infinityMirror"],
  directrice_adjointe: ["finances", "projet", "wari", "monBara", "produit", "materiaux", "configurateur"],
  commerciale: ["projet", "demande", "wari", "monBara", "produit"],
  chef_technique: ["demande", "monBara", "produit", "configurateur"],
  technicien_adjoint: ["demande", "monBara"],
  superviseur_logistique: ["demande", "monBara", "materiaux"],
};

/**
 * Sections de la page d'accueil.
 * Chaque section a un titre et une liste de cardIds.
 * La section n'est visible que si au moins une carte est dans le roleCards de l'utilisateur.
 * Les cartes défilent horizontalement (slidable).
 */
const homeSections: { id: string; title: string; cardIds: string[] }[] = [
  {
    id: "finance",
    title: "Finance",
    cardIds: ["finances", "demande", "wari"],
  },
  {
    id: "catalogue",
    title: "Catalogue",
    cardIds: ["produit", "materiaux"],
  },
  {
    id: "atelier",
    title: "Atelier",
    cardIds: ["configurateur", "infinityMirror", "monBara"],
  },
  {
    id: "parametres",
    title: "Paramètres",
    cardIds: ["procedure", "agents"],
  },
];

/**
 * Mapping page → clé de visite pour user_page_visits
 */
const pageToVisitKey: Record<string, string> = {
  "/finances": "finances",
  "/projects": "projets",
  "/mon-bara": "mon_bara",
  "/demande": "demandes",
};

/** IDs de cartes qui sont déjà dans une section — le reste s'affiche en grille classique */
const sectionCardIds = new Set(homeSections.flatMap((s) => s.cardIds));

// ── Composant carte bouton (réutilisé dans les sections et la grille) ──

interface CardButtonProps {
  card: HomeCard;
  counters: HomeCounters | null;
  onClick: () => void;
  compact?: boolean;
}

const CardButton: React.FC<CardButtonProps> = ({ card, counters, onClick, compact = false }) => {
  const badgeCount = card.counterKey && counters ? counters[card.counterKey] : 0;
  const showBadge = badgeCount > 0;

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center rounded-2xl border-2 border-gray-100 bg-white shadow-sm hover:shadow-lg hover:border-brand-orange/30 transition-all duration-200 text-left ${
        compact
          ? "p-4 min-w-[140px] min-h-[130px]"
          : "p-6 min-h-[160px]"
      }`}
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

      {/* 🆕 Mini Kanban des projets en cours */}
      <HomeMiniKanban user={user} />

      {/* Sections avec scroll horizontal */}
      {homeSections.map((section) => {
        // Filtrer : ne garder que les cartes autorisées pour ce rôle
        const sectionCards = section.cardIds
          .filter((id) => allowedCardIds.has(id))
          .map((id) => cardDefs[id])
          .filter(Boolean);

        // Ne pas afficher la section si aucune carte n'est visible
        if (sectionCards.length === 0) return null;

        return (
          <div key={section.id} className="mb-8">
            {/* Titre de section */}
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-1">
              {section.title}
            </h3>

            {/* Conteneur scrollable horizontal */}
            <div className="overflow-x-auto -mx-4 px-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
              <div className="flex gap-3 pb-2 min-w-min">
                {sectionCards.map((card) => (
                  <CardButton
                    key={card.id}
                    card={card}
                    counters={counters ?? null}
                    onClick={() => handleNavigate(card)}
                    compact
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {/* Cartes hors-section (projet, testCycle) — grille classique 2 colonnes */}
      {(() => {
        const otherCards = cardIds
          .filter((id) => !sectionCardIds.has(id))
          .map((id) => cardDefs[id])
          .filter(Boolean);

        if (otherCards.length === 0) return null;

        return (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 ml-1">
              Autres
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {otherCards.map((card) => (
                <CardButton
                  key={card.id}
                  card={card}
                  counters={counters ?? null}
                  onClick={() => handleNavigate(card)}
                />
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default HomePage;
