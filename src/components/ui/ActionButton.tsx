
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  variant?: "orange" | "green" | "gray" | "purple" | "blue";
}

export const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ icon: Icon, label, onClick, variant = "gray" }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false);

    const getVariantClasses = () => {
      switch (variant) {
        case "orange":
          return "border-brand-orange text-brand-orange hover:bg-orange-50 hover:shadow-sm";
        case "green":
          return "border-green-600 text-green-600 hover:bg-green-50 hover:shadow-sm";
        case "purple":
          return "border-purple-500 text-purple-500 hover:bg-purple-50 hover:shadow-sm";
        case "blue":
          return "border-blue-500 text-blue-500 hover:bg-blue-50 hover:shadow-sm";
        case "gray":
        default:
          return "border-gray-300 text-gray-600 hover:bg-gray-50 hover:shadow-sm";
      }
    };

    return (
      <motion.button
        ref={ref}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "group relative flex items-center overflow-hidden border h-8 transition-all duration-300 ease-in-out px-1.5 bg-white",
          getVariantClasses(),
          isHovered ? "rounded-full" : "w-8 justify-center rounded-md"
        )}
        animate={{ width: isHovered ? "auto" : "2rem" }}
        whileTap={{ scale: 0.97 }}
        aria-label={label}
      >
        <div className="flex items-center justify-center">
          <Icon className="h-3.5 w-3.5" />
        </div>

        <AnimatePresence>
          {isHovered && (
            <motion.span
              className="ml-1 pr-1.5 text-xs font-medium whitespace-nowrap"
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    );
  }
);

ActionButton.displayName = "ActionButton";
