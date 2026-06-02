
import React from "react";
import { User } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";
import SlidingChatPanel from "@/components/chat/SlidingChatPanel";
import { Navigate } from "react-router-dom";

interface IndexProps {
  user: User;
  persistentSessionId: string;
}

const Index: React.FC<IndexProps> = ({ user, persistentSessionId }) => {
  return <Navigate to="/" replace />;
};

export default Index;
