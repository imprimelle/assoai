import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { TeamMember } from "@/types";
import { X } from "lucide-react";

interface TeamMemberCardProps {
  member: TeamMember;
  onDelete: () => void;
  onChange: (changes: Partial<TeamMember>) => void;
  isEditable?: boolean;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onDelete,
  onChange,
  isEditable = false
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
      <div className="w-full">
        <Label htmlFor={`nom-${member.id}`} className="text-xs font-medium text-gray-500 uppercase mb-1">
          Nom
        </Label>
        {isEditable ? (
          <Input
            id={`nom-${member.id}`}
            value={member.nom}
            onChange={(e) => onChange({ nom: e.target.value })}
            className="text-base w-full"
            placeholder="Nom du membre"
          />
        ) : (
          <div className="text-sm text-gray-900">{member.nom}</div>
        )}
      </div>

      <div className="w-full">
        <Label htmlFor={`role-${member.id}`} className="text-xs font-medium text-gray-500 uppercase mb-1">
          Rôle
        </Label>
        {isEditable ? (
          <Input
            id={`role-${member.id}`}
            value={member.role}
            onChange={(e) => onChange({ role: e.target.value })}
            className="text-base w-full"
            placeholder="Rôle dans l'équipe"
          />
        ) : (
          <div className="text-sm text-gray-900">{member.role}</div>
        )}
      </div>

      {isEditable && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-600 hover:text-red-800 h-10 w-10 p-0"
          >
            <X size={16} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default TeamMemberCard;
