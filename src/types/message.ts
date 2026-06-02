
import type { TemplateType, Template } from "./template";
import type { User } from "./user";
import type { TemplateData, PromptGuidelines } from "./template-data";

export type MessageType = "text" | "image" | "audio" | "video" | "document";

export type MessagePayloadType =
  | "text"
  | "attachment"
  | "template"
  | "text_and_template"
  | "text_and_attachment"
  | "template_and_attachment"
  | "text_template_and_attachment";

export type ResponseMode = "text" | "template";

export interface MessagePayload {
  userId: string;
  sessionId: string;
  timestamp: string;
  message: {
    type: MessagePayloadType;
    content: string;
    attachments: string[];
    promptGuidelines?: PromptGuidelines;
    template?: {
      templateType: TemplateType;
      data: TemplateData;
    };
    quote?: {
      type: string;
      templateType: string;
      numero?: string;
      client?: string;
      montant?: string; // Explicitly typed as string
      date?: string;
      title?: string;
      additionalText?: string;
      version?: number;
      is_latest?: boolean;
    };
  };
}

export interface Message {
  id: string;
  sessionId: string;
  userId: string;
  content: string;
  timestamp: string;
  type: MessageType;
  attachments: string[];
  isUser: boolean;
  promptGuidelines?: PromptGuidelines;
  template?: Template;
  quote?: {
    type: string;
    templateType: string;
    numero?: string;
    client?: string;
    montant?: string; // Explicitly typed as string
    title?: string;
    date?: string;
    additionalText?: string;
    version?: number;
    is_latest?: boolean;
  };
}
export interface ResponsePayload {
  agentId: string;
  sessionId: string;
  timestamp: string;
  response: {
    mode: ResponseMode;
    textFallback?: string;
    templateType?: TemplateType;
    data?: TemplateData;
    metadata?: import("./template").TemplateMetadata;
  };
}
export interface ChatContainerProps {
  user: User;
  persistentSessionId?: string;
}

// Ensure the MessageInputProps interface is exported from types
export interface MessageInputProps {
  onSendMessage: (content: string, attachments: File[], template?: { templateType: TemplateType, data: TemplateData }, promptGuidelines?: PromptGuidelines) => void;
  onSetActiveTemplate?: (templateType: TemplateType, data: TemplateData) => void;
  hasUserSentMessage?: boolean;
  activeTemplate?: { templateType: TemplateType, data: TemplateData };
  onCancelTemplate?: () => void;
}
