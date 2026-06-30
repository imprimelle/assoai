
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home, LogOut, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MinimalHeaderProps {
  userName?: string;
  onLogout?: () => void;
  className?: string;
}

const MinimalHeader: React.FC<MinimalHeaderProps> = ({ userName, onLogout, className }) => {
  const navigate = useNavigate();

  return (
    <header
      className={cn(
        "border-b bg-white px-4 py-2 flex items-center justify-between sticky top-0 z-30",
        className
      )}
    >
      {/* Logo — retour accueil */}
      <button
        onClick={() => navigate("/")}
        className="logo-text text-xl cursor-pointer flex items-center gap-1 hover:opacity-80 transition-opacity"
        title="Accueil"
      >
        Asso<span className="logo-highlight">AI</span>
        <Home className="h-4 w-4 text-gray-400 ml-1" />
      </button>

      {/* Droite : nom + logout */}
      <div className="flex items-center gap-3">
        {userName && (
          <span className="text-sm text-gray-600 hidden sm:inline-flex items-center gap-1">
            <UserIcon className="h-3.5 w-3.5" />
            {userName}
          </span>
        )}
        {onLogout && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="text-gray-500 hover:text-red-600"
            title="Déconnexion"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
};

export default MinimalHeader;
