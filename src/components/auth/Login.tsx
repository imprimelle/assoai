
// src/components/auth/Login.tsx
import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { v4 as uuidv4 } from "uuid";
import type { User } from "@/types";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

interface LoginProps {
  /** Callback appelé en cas de succès pour remonter l'utilisateur et la session */
  onSuccess?: (user: User, sessionId: string) => void;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [service, setService] = useState<"Commercial" | "Graphiste" | "Technique" | "Partenaire" | "Superviseur">("Commercial");
  const [role, setRole] = useState<"agent" | "super-agent">("agent");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    setError(null);
    try {
      const { data, error: supaErr } = await supabase
        .from("app_users")
        .select("*")
        .eq("email", email)
        .single();

      if (supaErr || !data) {
        setError("Utilisateur introuvable.");
        return;
      }

      // Cast the role from database to our accepted types
      const userRole = data.role as "agent" | "super-agent" | undefined;
      const userService = data.service as "Commercial" | "Graphiste" | "Technique" | "Partenaire" | "Superviseur" | undefined;

      const currentUser: User = {
        id: data.session_id,
        name: data.name || email,
        email,
        role: userRole,
        service: userService
      };

      localStorage.setItem("persistentSessionId", data.session_id);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      onSuccess?.(currentUser, data.session_id);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Erreur de connexion:", error);
      setError("Erreur de connexion au serveur.");
    }
  };

  const handleSignup = async () => {
    setError(null);
    if (!email || !name || !service) {
      setError("Tous les champs sont requis pour l'inscription.");
      return;
    }
    const session_id = uuidv4();
    try {
      const { error: supaErr } = await supabase
        .from("app_users")
        .insert([
          { email, name, session_id, role }
        ]);

      if (supaErr) {
        setError("Impossible de créer le compte.");
        return;
      }

      const newUser: User = { 
        id: session_id, 
        name, 
        email,
        role,
        service
      };
      localStorage.setItem("persistentSessionId", session_id);
      localStorage.setItem("currentUser", JSON.stringify(newUser));
      onSuccess?.(newUser, session_id);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Erreur d'inscription:", error);
      setError("Erreur lors de la création du compte.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <span className="logo-text text-3xl">
              Asso<span className="logo-highlight">AI</span>
            </span>
          </div>
          <CardTitle className="text-2xl text-center">
            {mode === "login" ? "Connexion" : "Inscription"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Votre e‑mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />

            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">Nom</Label>
                  <Input
                    id="name"
                    placeholder="Votre nom"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="service">Service</Label>
                  <Select 
                    value={service} 
                    onValueChange={(value) => setService(value as "Commercial" | "Graphiste" | "Technique" | "Partenaire" | "Superviseur")}
                  >
                    <SelectTrigger id="service" className="w-full">
                      <SelectValue placeholder="Sélectionnez un service" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="Commercial">Commercial</SelectItem>
                      <SelectItem value="Graphiste">Graphiste</SelectItem>
                      <SelectItem value="Technique">Technique</SelectItem>
                      <SelectItem value="Partenaire">Partenaire</SelectItem>
                      <SelectItem value="Superviseur">Superviseur</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="role">Rôle</Label>
                  <Select 
                    value={role} 
                    onValueChange={(value) => setRole(value as "agent" | "super-agent")}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Sélectionnez un rôle" />
                    </SelectTrigger>
                    <SelectContent className="bg-white">
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="super-agent">Administrateur</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {role === "super-agent" ? 
                      "Administrateur : accès à tous les templates et aux fonctionnalités avancées" : 
                      "Agent : accès uniquement à vos propres templates"}
                  </p>
                </div>
              </>
            )}

            {error && <p className="text-red-600">{error}</p>}

            <Button
              className="w-full"
              onClick={mode === "login" ? handleLogin : handleSignup}
            >
              {mode === "login" ? "Se connecter" : "S'inscrire"}
            </Button>

            <div className="text-center text-sm mt-2">
              {mode === "login" ? (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setError(null);
                      setMode("signup");
                    }}
                  >
                    Inscrivez-vous
                  </button>
                </>
              ) : (
                <>
                  Déjà inscrit ?{" "}
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={() => {
                      setError(null);
                      setMode("login");
                    }}
                  >
                    Connectez-vous
                  </button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
