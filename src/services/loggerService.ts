// loggerService.ts — Envoi des logs vers Supabase pour debug temps réel
import { supabase } from "@/integrations/supabase/client";

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  source: string;
  message: string;
  details?: Record<string, any>;
  sessionId?: string;
  userId?: string;
}

// Buffer pour limiter les appels Supabase
let buffer: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL = 2000; // 2 secondes
const MAX_BUFFER = 20;

async function flushBuffer() {
  if (buffer.length === 0) return;
  const batch = buffer.splice(0, MAX_BUFFER);
  try {
    await supabase.from("app_logs").insert(
      batch.map(entry => ({
        level: entry.level,
        source: entry.source,
        message: entry.message,
        details: entry.details || {},
        session_id: entry.sessionId || null,
        user_id: entry.userId || null,
        timestamp: new Date().toISOString(),
      }))
    );
  } catch {
    // Échec silencieux — ne pas casser l'app
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushBuffer();
  }, FLUSH_INTERVAL);
}

export const remoteLog = {
  log(level: LogLevel, source: string, message: string, details?: Record<string, any>) {
    // Toujours dans la console
    const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    fn(`[${source}] ${message}`, details || "");

    // Envoyer à Supabase
    try {
      const sid = localStorage.getItem("persistentSessionId") || undefined;
      const uid = JSON.parse(localStorage.getItem("currentUser") || "{}")?.email || undefined;
      
      buffer.push({ level, source, message, details, sessionId: sid, userId: uid });
      
      // Flush immédiat pour les erreurs
      if (level === "error" || buffer.length >= MAX_BUFFER) {
        flushBuffer();
      } else {
        scheduleFlush();
      }
    } catch {
      // Ignorer les erreurs de logging
    }
  },

  debug(source: string, msg: string, details?: Record<string, any>) { this.log("debug", source, msg, details); },
  info(source: string, msg: string, details?: Record<string, any>) { this.log("info", source, msg, details); },
  warn(source: string, msg: string, details?: Record<string, any>) { this.log("warn", source, msg, details); },
  error(source: string, msg: string, details?: Record<string, any>) { this.log("error", source, msg, details); },
};

// Intercepter les erreurs globales
export function initGlobalErrorLogger() {
  window.addEventListener("error", (event) => {
    remoteLog.error("global", event.message, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    remoteLog.error("global", "Unhandled promise rejection", {
      reason: String(event.reason),
    });
  });
}
