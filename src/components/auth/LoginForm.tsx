
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { User } from "@/types";

interface LoginFormProps {
  onLogin: (user: User) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError("Veuillez saisir une adresse email");
      return;
    }
    
    if (!email.includes("@")) {
      setError("Veuillez saisir une adresse email valide");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    // Simuler une connexion
    setTimeout(() => {
      // Générer un ID utilisateur fictif
      const user: User = {
        id: `user_${Date.now()}`,
        name: email.split("@")[0],
        email: email // Maintenant email est une propriété valide de User
      };
      
      onLogin(user);
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Card className="w-full max-w-md animate-fade-in">
      <CardHeader className="space-y-1">
        <div className="flex justify-center mb-4">
          <span className="logo-text text-3xl">Asso<span className="logo-highlight">AI</span></span>
        </div>
        <CardTitle className="text-2xl text-center">Bienvenue</CardTitle>
        <CardDescription className="text-center">
          Connectez-vous pour accéder à l'interface de chat
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="exemple@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <Button 
            type="submit" 
            className="w-full mt-4"
            disabled={isLoading}
          >
            {isLoading ? "Connexion en cours..." : "Se connecter"}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-gray-500">
          Version de démonstration - Aucun mot de passe requis
        </p>
      </CardFooter>
    </Card>
  );
};

export default LoginForm;
