
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { User } from "@/types";
import { LogOut, User as UserIcon, Settings } from "lucide-react";

interface ProfileProps {
  user: User | null;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Vous n'êtes pas connecté</CardTitle>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => navigate("/login")}>Se connecter</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const handleLogout = () => {
    setDialogOpen(false);
    onLogout();
    navigate("/login");
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Profil utilisateur</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5" /> Informations utilisateur
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Nom</p>
            <p className="font-medium">{user.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium">{user.email}</p>
          </div>
          {user.role && (
            <div>
              <p className="text-sm text-gray-500">Rôle</p>
              <p className="font-medium capitalize">{user.role === 'super-agent' ? 'Administrateur' : 'Agent'}</p>
            </div>
          )}
          <div>
            <p className="text-sm text-gray-500">ID utilisateur</p>
            <p className="font-medium text-xs truncate">{user.id}</p>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmation de déconnexion</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir vous déconnecter ?</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button variant="destructive" onClick={handleLogout}>Se déconnecter</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Profile;
