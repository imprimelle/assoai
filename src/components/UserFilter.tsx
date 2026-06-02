
import { useState, useEffect } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface User {
  id: string;
  name: string;
  role?: string;
  session_id?: string;
}

interface UserFilterProps {
  currentUser: {
    id: string;
    role?: string;
  };
  onSelect: (sessionId: string, userId: string) => void;
  selectedValue?: string;
}

export function UserFilter({ currentUser, onSelect, selectedValue }: UserFilterProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUsers() {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('app_users')
          .select('id, name, role, session_id')
          .order('name');

        if (error) {
          console.error('Error loading users:', error);
        } else {
          console.log('Loaded users:', data);
          setUsers(data || []);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadUsers();
  }, []);

  // Check if the current user has the 'super-agent' (admin) role
  const isAdmin = currentUser?.role === 'super-agent';
  
  // Utiliser 'ALL' comme valeur par défaut, qu'il s'agisse d'un admin ou non
  const defaultValue = selectedValue || 'ALL';

  const handleChange = (value: string) => {
    if (value === 'ALL') {
      console.log('Selected ALL users');
      onSelect('ALL', 'ALL');
    } else {
      const selectedUser = users.find(user => user.id === value);
      if (selectedUser) {
        // Make sure we send both session_id and user_id to the parent component
        const sessionId = selectedUser.session_id || selectedUser.id;
        console.log(`Selected user: ${selectedUser.name}, session_id: ${sessionId}, user_id: ${selectedUser.id}`);
        onSelect(sessionId, selectedUser.id);
      }
    }
  };

  return (
    <Select onValueChange={handleChange} value={selectedValue || defaultValue}>
      <SelectTrigger className="w-48">
        <SelectValue placeholder="Utilisateur..." />
      </SelectTrigger>
      <SelectContent>
        {isLoading ? (
          <SelectItem value="loading" disabled>Chargement...</SelectItem>
        ) : (
          <>
            {<SelectItem value="ALL">Tous</SelectItem>}
            {users.map(user => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.id.substring(0, 8)}
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}

export default UserFilter;
