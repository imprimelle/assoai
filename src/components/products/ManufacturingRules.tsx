
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FabricationRules } from '@/types/product';
import {
  FileText,
  Lightbulb,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface ManufacturingRulesProps {
  rules: FabricationRules;
  onChange: (rules: FabricationRules) => void;
  isEditable?: boolean;
}

/**
 * Template canonique des règles de fabrication (6 blocs).
 * Aligné sur le skill `manufacturing-rules` : chaque bloc nourrit exactement
 * UNE section du CDC (Découpe, Éclairage, Outillage, Métal, Vinyl) + Structure + Opérations.
 */
const CANONICAL_TEMPLATE = `# [Nom du Produit]

## DÉCOUPE
• [Matériau] [épaisseur] [Réf] — Formule: [expression]
  Exple: pour L=X, H=Y → [résultat chiffré]

## ÉCLAIRAGE
• LED [Réf] — Formule: ⌈L×H × [densité]⌉
• Transfo [Réf] — Formule: P = q×100W → {200,300,400}
• Câblage [Réf] — 1 lot

## OUTILLAGE
• Entretoises [Réf] — Formule: d≤0.15→2, 0.15<d≤0.8→4, d>0.8→6
• Kit visserie [Réf] — 1 lot
• Colle [Réf] — ⌈surface⌉ tubes

## MÉTAL
[Si applicable — sinon marquer explicitement « Pas de section Métal »]

## VINYL
[Si applicable — sinon marquer explicitement « Pas de section Vinyl »]

## STRUCTURE
• Si Surface ≥ 1,05 → Box métallique / Si < 1,05 → Box forex/plexi
• Exple chiffré avec calcul complet

## OPÉRATIONS
1. DÉCOUPE → Rôle: Découpeur
2. FABRICATION → Rôle: Assembleur
3. ASSEMBLAGE → Rôles: Éclairagiste, Finisseur
`;

const CANONICAL_EXAMPLES = `EXEMPLES (2 minimum — un par branche du binaire)

| Section   | Matériau            | Qté | Unité   | Réf            |
|-----------|---------------------|-----|---------|----------------|
| Découpe   | ...                 | ... | plaque  | ...            |
| Éclairage | LED Samsung 12V     | ... | rouleau | LED-SAM-CW-12V |
| Outillage | Entretoises         | ... | lot     | ...            |
`;

const ManufacturingRules: React.FC<ManufacturingRulesProps> = ({
  rules,
  onChange,
  isEditable = true,
}) => {
  const data = rules || { description_complete: '', exemples: '' };
  const [showGuide, setShowGuide] = useState(false);

  const update = (field: keyof FabricationRules, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const insertTemplate = () => {
    const current = (data.description_complete || '').trim();
    if (
      current.length > 0 &&
      !window.confirm(
        'La description contient déjà du texte. Remplacer par le template canonique ?'
      )
    ) {
      return;
    }
    onChange({
      ...data,
      description_complete: CANONICAL_TEMPLATE,
      exemples: (data.exemples || '').trim().length > 0 ? data.exemples : CANONICAL_EXAMPLES,
    });
  };

  return (
    <div className="space-y-6 bg-white rounded-md p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-medium">Règles de fabrication</h3>
        {isEditable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={insertTemplate}
            className="gap-2 text-brand-orange border-orange-200 hover:bg-orange-50"
          >
            <ClipboardList className="h-4 w-4" />
            Insérer le template canonique
          </Button>
        )}
      </div>

      {/* Panneau de guidage repliable — rappel du skill manufacturing-rules */}
      <div className="rounded-xl border border-orange-100 bg-orange-50/40">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-orange-700"
        >
          {showGuide ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Comment écrire une règle (5 sections + Structure + Opérations)
        </button>
        {showGuide && (
          <div className="px-4 pb-4 pt-1 space-y-3 text-xs text-gray-700">
            <p>
              Une règle n'est pas un document technique : c'est un <strong>prompt structuré</strong> que
              Brico lit pour remplir les 5 sections du CDC. Chaque bloc nourrit exactement une section.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>DÉCOUPE</strong> → materiauxSections.Découpe</li>
              <li><strong>ÉCLAIRAGE</strong> → materiauxSections.Éclairage</li>
              <li><strong>OUTILLAGE</strong> → materiauxSections.Outillage</li>
              <li><strong>MÉTAL</strong> → materiauxSections.Métal</li>
              <li><strong>VINYL</strong> → materiauxSections.Vinyl</li>
              <li><strong>STRUCTURE</strong> → details.technique.type_structure</li>
              <li><strong>OPÉRATIONS</strong> → method_fabrication + équipe</li>
            </ul>
            <div className="flex items-start gap-2 rounded-lg bg-amber-100/70 p-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                <strong>Piège Outillage :</strong> ne jamais l'omettre. Toujours au minimum
                entretoises (formule par surface) + kit visserie (1 lot) + colle (1 tube/m²).
              </p>
            </div>
            <p className="text-gray-500">
              Règles strictes : 5 sections toujours traitées (vides marquées « Pas de section X ») ·
              toujours une formule · toujours une [Réf] catalogue · toujours l'unité · toujours un Exple
              chiffré · 2 exemples couvrant les 2 branches (si binaire).
            </p>
          </div>
        )}
      </div>

      {/* Description complète */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-orange" />
          <Label className="text-sm font-semibold">Description complète</Label>
        </div>
        <p className="text-xs text-gray-500">
          Décrivez ici l'ensemble du processus de fabrication : matériaux requis, étapes,
          calculs, règles spécifiques, options disponibles, etc.
        </p>
        <Textarea
          value={data.description_complete || ''}
          onChange={(e) => update('description_complete', e.target.value)}
          placeholder="Saisissez la description complète des règles de fabrication..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
          disabled={!isEditable}
        />
      </div>

      {/* Exemples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-semibold">Exemples</Label>
        </div>
        <p className="text-xs text-gray-500">
          Ajoutez des exemples concrets de cahiers des charges pour différents scénarios
          (dimensions, options, configurations types).
        </p>
        <Textarea
          value={data.exemples || ''}
          onChange={(e) => update('exemples', e.target.value)}
          placeholder="Saisissez les exemples de cahiers des charges..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
          disabled={!isEditable}
        />
      </div>
    </div>
  );
};

export default ManufacturingRules;
