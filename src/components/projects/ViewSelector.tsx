import React from 'react';
import { Button } from '@/components/ui/button';
import { List, Columns3, Calendar, Map } from 'lucide-react';

export type ProjectView = 'list' | 'kanban' | 'calendar' | 'map';

interface ViewSelectorProps {
  active: ProjectView;
  onChange: (view: ProjectView) => void;
}

const views: { value: ProjectView; icon: React.ReactNode; label: string }[] = [
  { value: 'list', icon: <List className="h-4 w-4" />, label: 'Liste' },
  { value: 'kanban', icon: <Columns3 className="h-4 w-4" />, label: 'Kanban' },
  { value: 'calendar', icon: <Calendar className="h-4 w-4" />, label: 'Calendrier' },
  { value: 'map', icon: <Map className="h-4 w-4" />, label: 'Carte' },
];

export const ViewSelector: React.FC<ViewSelectorProps> = ({ active, onChange }) => {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
      {views.map((v) => (
        <Button
          key={v.value}
          variant={active === v.value ? 'default' : 'ghost'}
          size="sm"
          className={`gap-1.5 h-8 text-xs ${active === v.value ? 'bg-background shadow-sm' : ''}`}
          onClick={() => onChange(v.value)}
          title={v.label}
        >
          {v.icon}
          <span className="hidden sm:inline">{v.label}</span>
        </Button>
      ))}
    </div>
  );
};
