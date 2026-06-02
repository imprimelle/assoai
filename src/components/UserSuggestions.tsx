
import React, { useState, useEffect } from 'react';
import { 
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
}

interface UserSuggestionsProps {
  searchTerm: string;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export function UserSuggestions({ searchTerm, onSelectUser, onClose }: UserSuggestionsProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Extract the specific @mention being typed
  const getCurrentMention = () => {
    const lastAtIndex = searchTerm.lastIndexOf('@');
    if (lastAtIndex === -1) return '';
    
    // Get the text from the last @ to the end or until a space
    const mentionText = searchTerm.substring(lastAtIndex + 1);
    const endIndex = mentionText.indexOf(' ');
    
    // Return either the full string from @ to the end, or until the space
    return endIndex === -1 
      ? mentionText.toLowerCase() 
      : mentionText.substring(0, endIndex).toLowerCase();
  };
  
  // Fetch users based on search term
  useEffect(() => {
    const fetchUsers = async () => {
      // Only search if there's an @ in the search term
      if (!searchTerm.includes('@')) {
        setUsers([]);
        return;
      }
      
      setLoading(true);
      const query = getCurrentMention();
      
      try {
        console.log("Searching users with query:", query);
        
        const { data, error } = await supabase
          .from('app_users')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .order('name')
          .limit(10);
          
        if (error) throw error;
        
        console.log("Found users:", data);
        setUsers(data || []);
      } catch (err) {
        console.error('Error fetching user suggestions:', err);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsers();
  }, [searchTerm]);
  
  const handleSelect = (user: User) => {
    console.log("User selected:", user);
    onSelectUser(user);
    onClose();
  };
  
  return (
    <Command className="rounded-lg border shadow-md bg-white">
      <CommandList>
        {loading ? (
          <CommandEmpty>Chargement...</CommandEmpty>
        ) : users.length === 0 ? (
          <CommandEmpty>Aucun utilisateur trouvé</CommandEmpty>
        ) : (
          <CommandGroup heading="Utilisateurs">
            {users.map(user => (
              <CommandItem
                key={user.id}
                onSelect={() => handleSelect(user)}
                className="cursor-pointer"
              >
                @{user.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

export default UserSuggestions;
