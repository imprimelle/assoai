// agentPrompts.ts — Rétro-compatibilité : réexporte depuis agentConfigStore
// Le store gère les prompts éditables (localStorage) + injection données

export {
  type AgentMode,
  type AgentConfig,
  AGENTS_META as AGENTS,
  DEFAULT_AGENT,
  getPrompt,
  setPrompt,
  resetPrompt,
  isCustomized,
} from "./agentConfigStore";
