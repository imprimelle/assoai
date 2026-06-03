// ErrorBoundary.tsx — Capture erreurs React et les envoie dans les logs
import React from "react";
import { remoteLog } from "@/services/loggerService";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    remoteLog.error("React", error.message, {
      stack: error.stack?.split("\n").slice(0, 5).join("\n"),
      componentStack: info.componentStack?.split("\n").slice(0, 5).join("\n"),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <div className="bg-white p-8 rounded-lg shadow-md max-w-md text-center">
              <h2 className="text-xl font-bold text-red-600 mb-2">Une erreur est survenue</h2>
              <p className="text-gray-600 mb-1">L'erreur a été enregistrée dans les logs.</p>
              <p className="text-xs text-gray-400 font-mono">{this.state.error?.message}</p>
              <button
                className="mt-4 px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                onClick={() => window.location.reload()}
              >
                Rafraîchir la page
              </button>
            </div>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
