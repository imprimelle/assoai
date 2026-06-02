
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrollToBottomButtonProps {
  onClick: () => void;
  visible: boolean;
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  onClick,
  visible
}) => {
  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        "fixed bottom-23 right-6 z-50 rounded-full shadow-md transition-all justify-center duration-300",
        "bg-black/50 hover:bg-orange-600 text-white",
        visible ? "opacity-70 scale-50" : "opacity-0 scale-75 pointer-events-none"
      )}
      onClick={onClick}
    >
      <ChevronDown className="h-5 w-5" />
    </Button>
  );
};

export default ScrollToBottomButton;
