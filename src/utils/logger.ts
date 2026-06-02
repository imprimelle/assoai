
type LogType = 'APP_LOG_INFO' | 'APP_LOG_WARNING' | 'APP_LOG_ERROR';

interface LogData {
  type: LogType;
  message: string;
  data?: any;
  timestamp: number;
}

const STORAGE_KEY = 'app_logs';
const MAX_LOGS = 100; // Limiter le nombre de logs stockés

const saveToLocalStorage = (log: LogData) => {
  try {
    const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    
    // Ajouter le nouveau log
    existingLogs.push(log);
    
    // Garder uniquement les MAX_LOGS plus récents logs
    const trimmedLogs = existingLogs.slice(-MAX_LOGS);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLogs));
  } catch (error) {
    console.error('Erreur lors de la sauvegarde des logs:', error);
    
    // En cas d'erreur de quota, essayer de supprimer les anciens logs
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      try {
        const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        // Réduire de moitié le nombre de logs et garder les plus récents
        const reducedLogs = existingLogs.slice(Math.floor(existingLogs.length / 2));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedLogs));
        // Réessayer d'ajouter le log actuel
        reducedLogs.push(log);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedLogs));
      } catch (innerError) {
        // En dernier recours, effacer complètement les logs
        console.error('Impossible de réduire les logs, on efface tout:', innerError);
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(STORAGE_KEY, JSON.stringify([log]));
        } catch {
          // Abandonner silencieusement
        }
      }
    }
  }
};

export const appLogger = {
  info: (message: string, data?: any) => {
    const logData: LogData = {
      type: 'APP_LOG_INFO',
      message,
      data,
      timestamp: Date.now()
    };
    
    console.log(`[INFO] ${message}`, data);
    window.dispatchEvent(new CustomEvent('app-log', { detail: logData }));
    saveToLocalStorage(logData);
  },
  
  warning: (message: string, data?: any) => {
    const logData: LogData = {
      type: 'APP_LOG_WARNING',
      message,
      data,
      timestamp: Date.now()
    };
    
    console.warn(`[WARNING] ${message}`, data);
    window.dispatchEvent(new CustomEvent('app-log', { detail: logData }));
    saveToLocalStorage(logData);
  },
  
  error: (message: string, data?: any) => {
    const logData: LogData = {
      type: 'APP_LOG_ERROR',
      message,
      data,
      timestamp: Date.now()
    };
    
    console.error(`[ERROR] ${message}`, data);
    window.dispatchEvent(new CustomEvent('app-log', { detail: logData }));
    saveToLocalStorage(logData);
  },

  getLogs: (): LogData[] => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  },
  
  clearLogs: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }
};
