
// src/components/auth/Login.tsx
import React, { useState, useEffect } from "react";
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
  onSuccess?: (user: User, sessionId: string) => void;
}

interface ContactOption {
  id: string;
  name: string;
  role: string;
  login: string;
}

const Login: React.FC<LoginProps> = ({ onSuccess }) => {
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Charger la liste des contacts actifs
  useEffect(() => {
    (async () => {
      try {
        const { data, error: supaErr } = await supabase
          .from("human_contacts")
          .select("id, name, role, login")
          .eq("is_active", true)
          .order("name");
        if (supaErr) throw supaErr;
        setContacts(data || []);
      } catch (err) {
        console.error("Erreur chargement contacts:", err);
      } finally {
        setLoadingContacts(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    setError(null);
    if (!selectedContactId) {
      setError("Sélectionne ton nom dans la liste.");
      return;
    }
    if (!pin || pin.length < 4) {
      setError("Entre ton code PIN (6 chiffres).");
      return;
    }

    setSubmitting(true);
    try {
      // Vérifier le PIN
      const { data, error: supaErr } = await supabase
        .from("human_contacts")
        .select("id, name, role, phone, login, pin_code")
        .eq("id", selectedContactId)
        .single();

      if (supaErr || !data) {
        setError("Contact introuvable.");
        setSubmitting(false);
        return;
      }

      if (data.pin_code !== pin) {
        setError("Code PIN incorrect.");
        setSubmitting(false);
        return;
      }

      // Générer une nouvelle session
      const sessionId = uuidv4();

      // Sauver la session en base
      await supabase
        .from("human_contacts")
        .update({ session_id: sessionId })
        .eq("id", data.id);

      const currentUser: User = {
        id: data.id,
        name: data.name,
        role: data.role,
        phone: data.phone,
        login: data.login,
        session_id: sessionId,
      };

      localStorage.setItem("persistentSessionId", sessionId);
      localStorage.setItem("currentUser", JSON.stringify(currentUser));
      onSuccess?.(currentUser, sessionId);
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Erreur de connexion:", err);
      setError("Erreur de connexion au serveur.");
    } finally {
      setSubmitting(false);
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
          <CardTitle className="text-2xl text-center">Connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Sélecteur de contact */}
            <div>
              <Label htmlFor="contact">Qui es-tu ?</Label>
              <Select
                value={selectedContactId}
                onValueChange={(v) => {
                  setSelectedContactId(v);
                  setError(null);
                }}
                disabled={loadingContacts}
              >
                <SelectTrigger id="contact" className="w-full">
                  <SelectValue placeholder={
                    loadingContacts ? "Chargement..." : "Choisis ton nom"
                  } />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  {contacts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Code PIN */}
            <div>
              <Label htmlFor="pin">Code PIN</Label>
              <Input
                id="pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/[^0-9]/g, ""));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLogin();
                }}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Entre le code à 6 chiffres qui t'a été communiqué.
              </p>
            </div>

            {error && (
              <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>
            )}

            <Button
              className="w-full"
              onClick={handleLogin}
              disabled={submitting || loadingContacts}
            >
              {submitting ? "Connexion..." : "Se connecter"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
