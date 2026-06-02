
// src/components/ui/StatusLine.tsx
import React from "react";
import { motion } from "framer-motion";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  Edit2,
  FileDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface StatusLineProps {
  label: string;
  status: "loading" | "success" | "error" | "warning" | "info" | "draft";
  link?: string;
}

const StatusLine: React.FC<StatusLineProps> = ({ label, status, link }) => {
  const renderIcon = () => {
    switch (status) {
      case "loading":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        );
      case "success":
        return (
          <motion.span
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.3, 1] }}
            transition={{ duration: 0.5 }}
            className="inline-flex"
          >
            <CheckCircle className="h-4 w-4 text-green-500" />
          </motion.span>
        );
      case "error":
        return (
          <motion.span
            initial={{ x: 0 }}
            animate={{ x: [0, -6, 6, -6, 6, 0] }}
            transition={{ duration: 0.4 }}
            className="inline-flex text-red-500"
          >
            <XCircle className="h-4 w-4" />
          </motion.span>
        );
      case "warning":
        return (
          <motion.span
            initial={{ scale: 0.6, opacity: 0.6 }}
            animate={{ scale: [0.6, 1, 0.6], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-flex text-yellow-500"
          >
            <AlertTriangle className="h-4 w-4" />
          </motion.span>
        );
      case "info":
        return (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="inline-flex text-blue-500"
          >
            <Info className="h-4 w-4" />
          </motion.span>
        );
      case "draft":
        return (
          <motion.span
            initial={{ rotate: 0, opacity: 0.5 }}
            animate={{ rotate: [0, 5, 0], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="inline-flex text-gray-500"
          >
            <Edit2 className="h-4 w-4" />
          </motion.span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full px-4 py-3 bg-gray-50 border rounded-md shadow-sm text-sm text-gray-800 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {renderIcon()}
        <span>{label}</span>
      </div>

      {status === "success" && link && (
        <Button
          asChild
          className="bg-brand-orange hover:bg-brand-orange/90 text-white font-medium w-fit mt-1"
          size="sm"
        >
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <FileDown className="h-4 w-4" /> Télécharger le PDF
          </a>
        </Button>
      )}
    </div>
  );
};

export default StatusLine;
