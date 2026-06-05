// webhook.ts — Utilitaires de classification des messages
// Note: les fonctions d'appel webhook ont été migrées vers chatService.ts

// Determine message payload type based on content
export const determineMessagePayloadType = (hasText: boolean, hasAttachments: boolean, hasTemplate: boolean): string => {
  if (hasTemplate && hasText) return "template_with_text";
  if (hasTemplate) return "template";
  if (hasAttachments && hasText) return "attachment_with_text";
  if (hasAttachments) return "attachment";
  return "text";
};
