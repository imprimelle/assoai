
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserTagProps {
  userName: string;
  onRemove?: () => void;
  className?: string;
  isValid?: boolean;
}

export function UserTag({ userName, onRemove, className, isValid = true }: UserTagProps) {
  return (
    <div 
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm",
        isValid ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800",
        className
      )}
      data-testid="user-tag"
    >
      <span>@{userName}</span>
      {onRemove && (
        <button 
          onClick={(e) => {
            e.stopPropagation(); // Prevent container click event
            onRemove();
          }}
          className={cn(
            "h-4 w-4 rounded-full flex items-center justify-center",
            isValid ? "hover:bg-green-200" : "hover:bg-orange-200"
          )}
          aria-label="Supprimer le filtre utilisateur"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export default UserTag;
