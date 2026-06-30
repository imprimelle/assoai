import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X, Clock, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchSuggestion {
  id: string;
  label: string;
  subtitle?: string;
  icon?: string;
  onClick: () => void;
}

interface ProjectSearchWidgetProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions?: SearchSuggestion[];
  className?: string;
}

export const ProjectSearchWidget: React.FC<ProjectSearchWidgetProps> = ({
  placeholder = 'Rechercher un projet...',
  value,
  onChange,
  suggestions = [],
  className,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fermer les suggestions au clic extérieur
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const hasSuggestions = suggestions.length > 0 && value.length > 0;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          className="pl-9 pr-8"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
        />
        {value && (
          <button
            onClick={() => { onChange(''); setShowSuggestions(false); }}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && hasSuggestions && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-0"
              onClick={() => {
                suggestion.onClick();
                setShowSuggestions(false);
              }}
            >
              {suggestion.icon && (
                <span className="text-lg shrink-0">{suggestion.icon}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{suggestion.label}</p>
                {suggestion.subtitle && (
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {suggestion.subtitle}
                  </p>
                )}
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
