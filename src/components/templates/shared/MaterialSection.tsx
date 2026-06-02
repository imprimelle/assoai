// src/components/templates/shared/MaterialSection.tsx
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MaterialCard from "./MaterialCard";
import type { MaterialItem } from "@/types";

interface MaterialSectionProps {
  name: string;
  items: MaterialItem[];
  isEditable?: boolean;
  onAddItem: (section: string) => void;
  onDeleteItem: (section: string, idx: number) => void;
  onChangeItem: (section: string, idx: number, changes: Partial<MaterialItem>) => void;
}

const sectionGradients: Record<string, string> = {
  Découpe:    "from-red-100    to-red-50",
  Éclairage: "from-yellow-100 to-yellow-50",
  Outillage: "from-green-100  to-green-50",
  Métal:     "from-gray-200   to-gray-100",
  Vinyl:     "from-purple-100 to-purple-50",
};

const MaterialSection: React.FC<MaterialSectionProps> = ({
  name,
  items,
  isEditable = false,
  onAddItem,
  onDeleteItem,
  onChangeItem,
}) => {
  const [open, setOpen] = useState(true);
  const gradient = sectionGradients[name] || "from-blue-100 to-blue-50";

  return (
    <div className="rounded-2xl shadow-lg overflow-hidden mb-6">
      {/* En‑tête de section */}
      <div
        className={`flex items-center justify-between px-5 py-4 bg-gradient-to-r ${gradient} cursor-pointer select-none`}
        onClick={() => setOpen(o => !o)}
      >
        {/* Titre + badge */}
        <div className="flex items-baseline space-x-2">
          <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
          <span className="inline-block bg-white/75 text-gray-800 text-sm font-medium px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>

        {/* Bouton + et toggle */}
        <div className="flex items-center space-x-2">
          {isEditable && (
            <Button
              variant="outline"
              size="icon"
              className="hover:bg-white/50 transition"
              onClick={e => {
                e.stopPropagation();
                onAddItem(name);
              }}
            >
              <Plus className="w-5 h-5 text-gray-700" />
            </Button>
          )}
          {open
            ? <ChevronUp   className="w-6 h-6 text-gray-700" />
            : <ChevronDown className="w-6 h-6 text-gray-700" />
          }
        </div>
      </div>

      {/* Contenu de la section */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white"
          >
            <div className="p-5 space-y-4">
              {items.length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Aucun matériau dans cette section.
                </p>
              )}

              {items.map((item, idx) => (
                <MaterialCard
                  key={item.id}
                  item={item}
                  isEditable={isEditable}
                  onDelete={() => onDeleteItem(name, idx)}
                  onChange={changes => onChangeItem(name, idx, changes)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MaterialSection;
