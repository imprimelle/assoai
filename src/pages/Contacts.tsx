import React, { useState } from 'react';
import { useHumanContacts, phoneToJid, HumanContact } from '@/hooks/useHumanContacts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

const ROLES = [
  { value: 'directeur', label: '👔 Directeur (Emmanuel)' },
  { value: 'directrice_adjointe', label: '👔 Directrice adjointe (Fatou)' },
  { value: 'commerciale', label: '💼 Commerciale' },
  { value: 'chef_technique', label: '🔧 Chef d\'équipe technique' },
  { value: 'technicien_adjoint', label: '🔧 Technicien adjoint' },
  { value: 'superviseur_logistique', label: '📦 Superviseur logistique' },
];

const PHONE_REGEX = /^\+?[0-9]{8,15}$/;
const isValidPhone = (phone: string) => PHONE_REGEX.test(phone.trim());

interface EditForm {
  name: string;
  role: string;
  phone: string;
  whatsapp_jid: string;
  is_active: boolean;
  can_initialize_project: boolean;
  can_approve_phase: boolean;
}

const emptyForm: EditForm = {
  name: '', role: 'chef_technique', phone: '', whatsapp_jid: '',
  is_active: true, can_initialize_project: false, can_approve_phase: false,
};

const Contacts: React.FC = () => {
  const { contacts, isLoading, createContact, updateContact, deleteContact } = useHumanContacts();
  const [editForm, setEditForm] = useState<EditForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = async () => {
    // JID : manuel si fourni, sinon auto-généré depuis le phone
    const jid = editForm.whatsapp_jid.trim() || phoneToJid(editForm.phone);
    const data = {
      name: editForm.name,
      role: editForm.role,
      phone: editForm.phone,
      whatsapp_jid: jid,
      is_active: editForm.is_active,
      can_initialize_project: editForm.can_initialize_project,
      can_approve_phase: editForm.can_approve_phase,
    };

    if (editingId) {
      await updateContact.mutateAsync({ id: editingId, ...data });
    } else {
      await createContact.mutateAsync(data);
    }
    setDialogOpen(false);
    setEditForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (c: HumanContact) => {
    setEditForm({
      name: c.name, role: c.role, phone: c.phone,
      whatsapp_jid: c.whatsapp_jid || '',
      is_active: c.is_active, can_initialize_project: c.can_initialize_project,
      can_approve_phase: c.can_approve_phase,
    });
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer ce contact ?')) await deleteContact.mutateAsync(id);
  };

  const roleLabel = (role: string) => ROLES.find(r => r.value === role)?.label || role;

  if (isLoading) return <div className="container mx-auto px-4 py-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">👥 Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intervenants terrain — le JID WhatsApp est généré automatiquement au format <code>{'{numéro}'}@s.whatsapp.net</code>
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditForm(emptyForm); setEditingId(null); }}>
              <Plus className="h-4 w-4 mr-1" /> Nouveau contact
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingId ? 'Modifier' : 'Nouveau'} contact</DialogTitle></DialogHeader>
            <div className="grid gap-3 py-2">
              <Input placeholder="Nom complet" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
              <Select value={editForm.role} onValueChange={v => setEditForm({...editForm, role: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <div className="space-y-2">
                <Input 
                  placeholder="Téléphone (ex: 2250506070809)" 
                  value={editForm.phone} 
                  onChange={e => setEditForm({...editForm, phone: e.target.value, whatsapp_jid: ''})} 
                  className={editForm.phone.trim() && !isValidPhone(editForm.phone) ? 'border-red-400' : ''}
                />
                {editForm.phone.trim() && !isValidPhone(editForm.phone) && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Format invalide (8 à 15 chiffres attendus)
                  </p>
                )}
                {editForm.phone.trim() && isValidPhone(editForm.phone) && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Format valide
                  </p>
                )}
                {editForm.phone.trim().length >= 8 && isValidPhone(editForm.phone) && (
                  <div className="bg-gray-50 rounded p-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      📱 JID auto : <code className="text-green-600">{phoneToJid(editForm.phone)}</code>
                    </p>
                    {!editForm.whatsapp_jid.trim() && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Ce contact utilise-t-il WhatsApp en appareil lié (LID) ? Si oui, remplis le champ JID manuel.
                      </p>
                    )}
                  </div>
                )}
                <Input 
                  placeholder="JID WhatsApp manuel (ex: 218914919305318@lid)" 
                  value={editForm.whatsapp_jid} 
                  onChange={e => setEditForm({...editForm, whatsapp_jid: e.target.value})}
                  className="text-xs"
                />
                {editForm.whatsapp_jid.trim() && (
                  <p className="text-xs text-muted-foreground">
                    {editForm.whatsapp_jid.includes('@lid') ? (
                      <span className="text-amber-600">🟠 JID LID (appareil lié) — sera utilisé tel quel</span>
                    ) : (
                      <span className="text-green-600">🟢 JID manuel — sera utilisé tel quel</span>
                    )}
                  </p>
                )}
                {!editForm.whatsapp_jid.trim() && (
                  <p className="text-xs text-muted-foreground">
                    ⚠️ Laisse vide pour utiliser le JID auto. Remplis uniquement si le contact utilise un LID.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Actif</span>
                <Switch checked={editForm.is_active} onCheckedChange={v => setEditForm({...editForm, is_active: v})} className="data-[state=checked]:bg-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Peut initialiser un projet</span>
                <Switch checked={editForm.can_initialize_project} onCheckedChange={v => setEditForm({...editForm, can_initialize_project: v})} className="data-[state=checked]:bg-green-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Peut valider une phase</span>
                <Switch checked={editForm.can_approve_phase} onCheckedChange={v => setEditForm({...editForm, can_approve_phase: v})} className="data-[state=checked]:bg-green-500" />
              </div>
              <Button onClick={handleSave} disabled={!editForm.name || !editForm.phone || !isValidPhone(editForm.phone)}>
                <Save className="h-4 w-4 mr-1" /> Sauvegarder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nom</TableHead>
            <TableHead>Rôle</TableHead>
            <TableHead>Téléphone</TableHead>
            <TableHead>JID WhatsApp</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(contacts || []).map(c => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{roleLabel(c.role)}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {c.whatsapp_jid ? (
                  <code className={c.whatsapp_jid.includes('@lid') ? 'text-amber-600' : 'text-green-600'}>
                    {c.whatsapp_jid}
                  </code>
                ) : (
                  <span className="text-gray-400 italic">auto</span>
                )}
              </TableCell>
              <TableCell>{c.is_active ? '✅' : '❌'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(c)}><Pencil className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Contacts;
