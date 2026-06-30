import React, { useState, useEffect, useMemo } from "react";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SearchableDropdown, type DropdownItem } from "./SearchableDropdown";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ClientInfo {
  nom: string;
  adresse: string;
  telephone?: string;
}

interface ClientDropdownItem extends DropdownItem {
  client: ClientInfo;
}

interface ClientSuggestionsProps {
  onSelectClient: (client: ClientInfo) => void;
  currentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

// ──────────────────────────────────────────────
// Composant
// ──────────────────────────────────────────────

const ClientSuggestions: React.FC<ClientSuggestionsProps> = ({
  onSelectClient,
  currentValue = "",
  disabled = false,
  className = "",
  placeholder = "Rechercher un client...",
}) => {
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Charger les clients à l'ouverture (le dropdown gère son propre état open/close)
  // → on utilise un state local ouvert pour déclencher le fetch
  const [shouldFetch, setShouldFetch] = useState(false);

  useEffect(() => {
    if (!shouldFetch || clients.length > 0) return;

    const fetchClients = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("template_data")
          .not("template_data", "is", null)
          .in("template_type", ["facture", "commande", "devis"])
          .order("timestamp", { ascending: false });

        if (error) throw error;

        const uniqueClients = new Map<string, ClientInfo>();
        data?.forEach((message) => {
          if (typeof message.template_data === "object" && message.template_data !== null) {
            const td = message.template_data as any;
            if (td.data && typeof td.data === "object") {
              const cd = td.data.client;
              if (cd && typeof cd === "object" && cd.nom) {
                if (!uniqueClients.has(cd.nom)) {
                  uniqueClients.set(cd.nom, {
                    nom: cd.nom,
                    adresse: cd.adresse || "",
                    telephone: cd.telephone || "",
                  });
                }
              }
            }
          }
        });

        setClients(Array.from(uniqueClients.values()));
      } catch (error) {
        console.error("Error fetching client suggestions:", error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger les suggestions de clients.",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [shouldFetch, toast]);

  // À l'ouverture, déclencher le fetch
  const handleOpen = () => {
    if (clients.length === 0) setShouldFetch(true);
  };

  const dropdownItems: ClientDropdownItem[] = useMemo(
    () =>
      clients.map((c) => ({
        id: c.nom,
        label: c.nom,
        subtitle: [c.adresse, c.telephone].filter(Boolean).join(" • "),
        client: c,
        icon: React.createElement(User, {
          className: "h-4 w-4 text-gray-500",
        }),
      })),
    [clients]
  );

  const handleSelect = (item: ClientDropdownItem) => {
    onSelectClient(item.client);
  };

  return (
    <SearchableDropdown<ClientDropdownItem>
      items={dropdownItems}
      loading={loading}
      placeholder={placeholder}
      emptyMessage="Aucun client dans l'historique"
      showCount
      onSelect={handleSelect}
      onOpen={handleOpen}
      triggerValue={currentValue}
      triggerPlaceholder={placeholder}
      disabled={disabled}
      className={className}
    />
  );
};

export default ClientSuggestions;
