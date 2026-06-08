export interface AppNotification {
  id: string;
  user_id: string;
  project_id?: string;
  type: 'alerte' | 'rappel' | 'info' | 'escalade';
  level: 'critical' | 'warning' | 'info';
  title: string;
  message?: string;
  link?: string;
  read: boolean;
  created_at: string;
}
