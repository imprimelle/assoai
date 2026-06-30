
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
  X,
  SlidersHorizontal,
  TrendingUp
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useChat } from "@/contexts/ChatContext";
import { NotificationBell } from "@/components/notifications";
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
  alwaysShowLabel?: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ to, icon, label, onClick, alwaysShowLabel }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
          isActive
            ? "bg-brand-orange/10 text-brand-orange"
            : "text-gray-700 hover:bg-gray-100"
        )
      }
      onClick={onClick}
      title={label}
    >
      {icon}
      {alwaysShowLabel && <span className="hidden md:inline">{label}</span>}
    </NavLink>
  );
};

const TopBar: React.FC<TopBarProps> = ({ className }) => {
  const { isChatOpen, toggleChat } = useChat();

  // Menu principal (toujours visible — icônes uniquement)
  const primaryNavItems = [
    { to: "/", icon: <Home className="h-4 w-4" />, label: "Accueil" },
    { to: "/library", icon: <Book className="h-4 w-4" />, label: "Bibliothèque" },
    { to: "/projects", icon: <Folder className="h-4 w-4" />, label: "Projets" },
  ];

  // Menu secondaire (toujours dans le dropdown)
  const secondaryNavItems = [
    { to: "/products", icon: <Package className="h-4 w-4" />, label: "Produits" },
    { to: "/procedures", icon: <Book className="h-4 w-4" />, label: "Procédures" },
    { to: "/contacts", icon: <User className="h-4 w-4" />, label: "Contacts" },
    { to: "/logs", icon: <FileText className="h-4 w-4" />, label: "Logs" },
    { to: "/agent-config", icon: <SlidersHorizontal className="h-4 w-4" />, label: "Agents" },
    { to: "/communicator", icon: <MessageSquare className="h-4 w-4" />, label: "Communicateur" },
    { to: "/finances", icon: <TrendingUp className="h-4 w-4" />, label: "Finances" },
  ];

  return (
    <nav
      className={cn(
        "border-b bg-white px-3 py-1.5 flex items-center justify-between sticky top-0 z-30",
        className
      )}
    >
      <div className="flex items-center gap-1">
        {/* Logo */}
        <span 
          className="logo-text cursor-pointer flex items-center mr-1" 
          onClick={toggleChat}
          title="Chat"
        >
          Asso<span className="logo-highlight">AI</span>
          <MessageSquare className={cn("ml-1 h-4 w-4 transition-all", 
            isChatOpen ? "text-brand-orange" : "text-gray-500"
          )} />
        </span>

        {/* Items principaux (icônes uniquement) */}
        {primaryNavItems.map((item) => (
          <NavItem 
            key={item.to} 
            to={item.to} 
            icon={item.icon} 
            label={item.label} 
          />
        ))}

        {/* Menu dropdown pour les items secondaires (toujours, desktop et mobile) */}
        <Menubar className="border-none bg-transparent p-0">
          <MenubarMenu>
            <MenubarTrigger className="px-2.5 py-1.5 cursor-pointer data-[state=open]:bg-gray-100 rounded-md">
              <Menu className="h-4 w-4" />
            </MenubarTrigger>
            <MenubarContent align="start" className="w-48">
              {secondaryNavItems.map((item) => (
                <MenubarItem key={item.to} asChild>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 w-full px-2 py-1.5",
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
      </div>

      {/* Notifications */}
      <NotificationBell />

      {/* Profil (icône uniquement) */}
      <NavItem 
        to="/profile" 
        icon={<User className="h-4 w-4" />} 
        label="Profil" 
      />
    </nav>
  );
};

export default TopBar;
