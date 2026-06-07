// pageContextDetector.ts — Détection automatique du contexte de page
// Utilisé par hermesRouter pour router vers le bon profil Hermes

import type { TemplateType } from "@/types";

export interface PageContext {
  route: string;
  pageType: 'general' | 'products' | 'project' | 'agent-config' | 'templates';
  projectId?: string;
  documentType?: TemplateType;
  forcedAgent?: 'wari' | 'brico';
}

/**
 * Détecte le contexte de la page courante pour le routage intelligent.
 * Appelé à chaque envoi de message dans la sidebar.
 */
export function detectPageContext(forcedAgent?: 'wari' | 'brico'): PageContext {
  const path = window.location.pathname;

  // Projet dédié — /projects/:id
  const projectMatch = path.match(/^\/projects\/(.+)$/);
  if (projectMatch) {
    return {
      route: path,
      pageType: 'project',
      projectId: projectMatch[1],
      forcedAgent,
    };
  }

  // Page liste des projets
  if (path === '/projects') {
    return { route: path, pageType: 'general', forcedAgent };
  }

  // Page Catalogue Produits
  if (path.startsWith('/products')) {
    return { route: path, pageType: 'products', forcedAgent };
  }

  // Page Configuration Agents
  if (path.startsWith('/agent-config') || path.startsWith('/configuration')) {
    return { route: path, pageType: 'agent-config', forcedAgent };
  }

  // Page Logs
  if (path.startsWith('/logs')) {
    return { route: path, pageType: 'agent-config', forcedAgent };
  }

  // CRM Templates (lecture seule)
  if (path.startsWith('/templates')) {
    return { route: path, pageType: 'templates', forcedAgent };
  }

  // Dashboard, Chat, ou autres — détection par défaut
  return { route: path, pageType: 'general', forcedAgent };
}

/**
 * Détermine le profil Hermes à utiliser selon le contexte de page.
 */
export function routeToProfile(context: PageContext): string {
  // Agent forcé par l'utilisateur (priorité absolue)
  if (context.forcedAgent === 'brico') return 'hermes-brico';
  if (context.forcedAgent === 'wari') return 'hermes-wari';

  // Routage automatique selon la page
  switch (context.pageType) {
    case 'products':
      return 'hermes-brico';
    case 'project':
      return 'hermes-pm';
    default:
      return 'hermes-wari';
  }
}

/**
 * Détermine les skills à charger selon le contexte.
 */
export function getSkillsForContext(context: PageContext): string[] {
  const base = ['assoai-development'];

  switch (context.pageType) {
    case 'products':
      return [...base, 'product-search', 'manufacturing-rules'];
    case 'project':
      return [...base, 'project-orchestrator', 'kanban-manager', 'checklist-validator'];
    case 'templates':
      return [...base, 'product-search', 'document-create'];
    default:
      return [...base, 'product-search', 'document-create'];
  }
}
