
import React, { useState, useEffect } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Search, User, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export interface ClientInfo {
  nom: string;
  adresse: string;
  telephone?: string;
}

interface ClientSuggestionsProps {
  onSelectClient: (client: ClientInfo) => void;
  currentValue?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

const ClientSuggestions: React.FC<ClientSuggestionsProps> = ({
  onSelectClient,
  currentValue = "",
  disabled = false,
  className = "",
  placeholder = "Rechercher un client..."
}) => {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Fetch unique clients from the messages table
  useEffect(() => {
    const fetchClients = async () => {
      if (open && clients.length === 0) {
        setLoading(true);
        try {
          // Query messages table for templates with client information
          const { data, error } = await supabase
            .from('messages')
            .select('template_data')
            .not('template_data', 'is', null)
            .in('template_type', ['facture', 'commande', 'devis'])
            .order('timestamp', { ascending: false });

          if (error) throw error;

          // Extract unique clients based on name
          const uniqueClients = new Map<string, ClientInfo>();
          
          data?.forEach(message => {
            // Safely access nested properties
            if (typeof message.template_data === 'object' && message.template_data !== null) {
              // Check if data property exists and is an object
              const templateData = message.template_data as any;
              if (templateData.data && typeof templateData.data === 'object') {
                // Check if client property exists and has the required fields
                const clientData = templateData.data.client;
                if (clientData && typeof clientData === 'object' && clientData.nom) {
                  // Only add if not already in our map (based on name)
                  if (!uniqueClients.has(clientData.nom)) {
                    uniqueClients.set(clientData.nom, {
                      nom: clientData.nom,
                      adresse: clientData.adresse || '',
                      telephone: clientData.telephone || ''
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
            description: "Impossible de charger les suggestions de clients."
          });
        } finally {
          setLoading(false);
        }
      }
    };

    fetchClients();
  }, [open, toast]);

  // Filter clients based on search term
  const filteredClients = clients.filter(client => 
    client.nom.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between text-left font-normal",
            !currentValue && "text-muted-foreground",
            className
          )}
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          {currentValue || placeholder}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput 
            placeholder={placeholder} 
            className="h-9" 
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? "Chargement..." : "Aucun client trouvé"}
            </CommandEmpty>
            <CommandGroup heading="Clients">
              {filteredClients.map((client) => (
                <CommandItem
                  key={client.nom}
                  value={client.nom}
                  onSelect={() => {
                    onSelectClient(client);
                    setOpen(false);
                    setSearchTerm("");
                  }}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{client.nom}</span>
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {client.adresse}
                    </span>
                  </div>
                  {currentValue === client.nom && (
                    <Check className="h-4 w-4 text-green-500" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default ClientSuggestions;
