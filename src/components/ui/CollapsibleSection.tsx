
import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = true,
  className = "",
  titleClassName = "",
  contentClassName = ""
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className={`border border-gray-200 rounded-lg bg-gray-50 mb-4 overflow-hidden ${className}`}
    >
      <CollapsibleTrigger className={`flex justify-between items-center w-full p-3 sm:p-4 text-left font-semibold text-base sm:text-lg hover:bg-gray-100 transition-colors ${titleClassName}`}>
        <h3 className="truncate pr-2 leading-tight">{title}</h3>
        <div className="flex-shrink-0">
          {isOpen ? <ChevronUp className="h-4 w-4 sm:h-5 sm:w-5" /> : <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />}
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              transition={{ duration: 0.3 }}
              className={`p-3 sm:p-4 border-t border-gray-200 ${contentClassName}`}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CollapsibleSection;
