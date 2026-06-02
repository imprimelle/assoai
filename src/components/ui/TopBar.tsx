
import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { 
  Book, 
  FileText, 
  Home, 
  User, 
  Package, 
  MessageSquare, 
  Folder,
  Menu,
  X 
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useChat } from "@/contexts/ChatContext";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { 
  Menubar, 
  MenubarContent, 
  MenubarItem, 
  MenubarMenu, 
  MenubarTrigger 
} from "@/components/ui/menubar";

interface TopBarProps {
  className?: string;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick }) => {
  const isMobile = useIsMobile();
  
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-orange/10 text-brand-orange"
            : "text-gray-700 hover:bg-gray-100"
        )
      }
      onClick={onClick}
    >
      {icon}
      {!isMobile && <span>{label}</span>}
    </NavLink>
  );
};

const TopBar: React.FC<TopBarProps> = ({ className }) => {
  const isMobile = useIsMobile();
  const { isChatOpen, toggleChat } = useChat();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Menu principal (toujours visible)
  const primaryNavItems = [
    { to: "/", icon: <Home className="h-4 w-4" />, label: "Accueil" },
    { to: "/library", icon: <Book className="h-4 w-4" />, label: "Bibliothèque" },
    { to: "/projects", icon: <Folder className="h-4 w-4" />, label: "Projets" },
  ];

  // Menu secondaire (regroupé dans un menu sur mobile)
  const secondaryNavItems = [
    { to: "/products", icon: <Package className="h-4 w-4" />, label: "Produits" },
    { to: "/logs", icon: <FileText className="h-4 w-4" />, label: "Logs" },
  ];

  return (
    <nav
      className={cn(
        "border-b bg-white px-4 py-2 flex items-center justify-between sticky top-0 z-30",
        className
      )}
    >
      <div className="flex items-center space-x-2 md:space-x-4">
        {/* Logo text qui ouvre/ferme le chat */}
        <span 
          className="logo-text cursor-pointer flex items-center" 
          onClick={toggleChat}
        >
          Asso<span className="logo-highlight">AI</span>
          <MessageSquare className={cn("ml-1 h-4 w-4 transition-all", 
            isChatOpen ? "text-brand-orange" : "text-gray-500"
          )} />
        </span>

        {/* Items principaux toujours visibles */}
        <div className="flex items-center space-x-1">
          {primaryNavItems.map((item) => (
            <NavItem 
              key={item.to} 
              to={item.to} 
              icon={item.icon} 
              label={item.label} 
            />
          ))}
        </div>

        {/* Menu déroulant pour les éléments secondaires sur mobile */}
        {isMobile ? (
          <Menubar className="border-none bg-transparent p-0">
            <MenubarMenu>
              <MenubarTrigger className="px-2 cursor-pointer data-[state=open]:bg-gray-100 rounded-md">
                <Menu className="h-4 w-4" />
              </MenubarTrigger>
              <MenubarContent align="start" className="w-48">
                {secondaryNavItems.map((item) => (
                  <MenubarItem key={item.to} asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2 w-full",
                          isActive ? "text-brand-orange" : "text-gray-700"
                        )
                      }
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </NavLink>
                  </MenubarItem>
                ))}
              </MenubarContent>
            </MenubarMenu>
          </Menubar>
        ) : (
          // Afficher tous les items côte à côte sur desktop
          <>
            {secondaryNavItems.map((item) => (
              <NavItem 
                key={item.to} 
                to={item.to} 
                icon={item.icon} 
                label={item.label} 
              />
            ))}
          </>
        )}
      </div>

      <div>
        <NavItem 
          to="/profile" 
          icon={<User className="h-4 w-4" />} 
          label="Profil" 
        />
      </div>
    </nav>
  );
};

export default TopBar;
