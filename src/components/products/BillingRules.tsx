
import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BillingRules as BillingRulesType } from '@/types/product';
import {
  FileText,
  Lightbulb,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

interface BillingRulesProps {
  rules: BillingRulesType;
  onChange: (rules: BillingRulesType) => void;
  isEditable?: boolean;
}

/**
 * Template canonique des règles de facturation.
 * Miroir de ManufacturingRules : structure la formule de prix (coûts → marges → total)
 * pour que le prix soit calculable de manière déterministe à partir des dimensions.
 */
const CANONICAL_TEMPLATE = `# [Nom du Produit] — Formule de prix

## COÛT MATÉRIAUX
• Coût_matériaux = Σ(quantité × prix_unitaire)  (issu des règles de fabrication)
  Exple: pour L=X, H=Y → [résultat chiffré en FCFA]

## COÛT ÉCLAIRAGE
• Coût_LED = LED_nécessaires × prix_LED + transfo + câblage
  Exple: pour surface S → [résultat chiffré]

## MAIN D'ŒUVRE
• MO = [nb_heures × taux_horaire]  OU  [forfait par produit]
  Exple: [résultat chiffré]

## MARGES
• Marge atelier = 20% du coût matériaux
• Marge commerciale = [%] du sous-total
• TVA = [% ou exonéré]

## FORMULE FINALE
• Prix_HT = (Coût_matériaux + Coût_LED + MO) × (1 + marge_atelier) × (1 + marge_commerciale)
• Prix_TTC = Prix_HT × (1 + TVA)
  Exple chiffré complet avec calcul de bout en bout.
`;

const CANONICAL_EXAMPLES = `EXEMPLES (2 minimum — petit format & grand format)

| Poste            | Détail                    | Montant (FCFA) |
|------------------|---------------------------|----------------|
| Coût matériaux   | ...                       | ...            |
| Coût éclairage   | LED + transfo + câblage   | ...            |
| Main d'œuvre     | ...                       | ...            |
| Sous-total       | somme                     | ...            |
| Marge atelier    | 20%                       | ...            |
| Marge commerciale| ...%                      | ...            |
| Prix HT          |                           | ...            |
| TVA              | ...%                      | ...            |
| Prix TTC         |                           | ...            |
`;

const BillingRules: React.FC<BillingRulesProps> = ({
  rules,
  onChange,
  isEditable = true,
}) => {
  const data = rules || { description_complete: '', exemples: '' };
  const [showGuide, setShowGuide] = useState(false);

  const update = (field: keyof BillingRulesType, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const insertTemplate = () => {
    const current = (data.description_complete || '').trim();
    if (
      current.length > 0 &&
      !window.confirm(
        'La formule de prix contient déjà du texte. Remplacer par le template canonique ?'
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
        <h3 className="text-lg font-medium">Règles de facturation</h3>
        {isEditable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={insertTemplate}
            className="gap-2 text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <ClipboardList className="h-4 w-4" />
            Insérer le template canonique
          </Button>
        )}
      </div>

      {/* Panneau de guidage repliable */}
      <div className="rounded-xl border border-purple-100 bg-purple-50/40">
        <button
          type="button"
          onClick={() => setShowGuide((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold text-purple-700"
        >
          {showGuide ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          Comment écrire une formule de prix (coûts → marges → total)
        </button>
        {showGuide && (
          <div className="px-4 pb-4 pt-1 space-y-3 text-xs text-gray-700">
            <p>
              La règle de facturation doit rendre le prix <strong>calculable de manière déterministe</strong>{' '}
              à partir des dimensions. Empilez les coûts, puis appliquez les marges.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>COÛT MATÉRIAUX</strong> → Σ(quantité × prix_unitaire), issu des règles de fabrication</li>
              <li><strong>COÛT ÉCLAIRAGE</strong> → LED + transfo + câblage</li>
              <li><strong>MAIN D'ŒUVRE</strong> → heures × taux, ou forfait</li>
              <li><strong>MARGES</strong> → atelier 20% + commerciale + TVA</li>
              <li><strong>FORMULE FINALE</strong> → Prix_HT puis Prix_TTC</li>
            </ul>
            <div className="flex items-start gap-2 rounded-lg bg-amber-100/70 p-2 text-amber-800">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                <strong>Cohérence obligatoire :</strong> les quantités matériaux doivent correspondre
                exactement aux formules des règles de fabrication — sinon le devis et le CDC divergent.
              </p>
            </div>
            <p className="text-gray-500">
              Règles strictes : toujours une formule exploitable · toujours l'unité (FCFA) ·
              toujours un Exple chiffré de bout en bout · 2 exemples (petit & grand format).
            </p>
          </div>
        )}
      </div>

      {/* Description complète */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-purple-600" />
          <Label className="text-sm font-semibold">Formule de prix</Label>
        </div>
        <p className="text-xs text-gray-500">
          Décrivez ici la formule de calcul du prix : coût des matériaux, marge atelier,
          marge commerciale, main d'œuvre, options, TVA. Utilisez des formules exploitables
          (ex: Prix = (Surface × prix_m²_matériaux + LED × prix_LED + MO) × marge).
        </p>
        <Textarea
          value={data.description_complete || ''}
          onChange={(e) => update('description_complete', e.target.value)}
          placeholder="Saisissez la formule de prix et les règles de facturation..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
          disabled={!isEditable}
        />
      </div>

      {/* Exemples */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <Label className="text-sm font-semibold">Exemples de factures</Label>
        </div>
        <p className="text-xs text-gray-500">
          Ajoutez des exemples concrets de factures pour différents scénarios
          (dimensions, options, configurations types avec prix calculés).
        </p>
        <Textarea
          value={data.exemples || ''}
          onChange={(e) => update('exemples', e.target.value)}
          placeholder="Saisissez les exemples de factures..."
          rows={14}
          className="bg-white font-mono text-sm resize-y min-h-[200px]"
          disabled={!isEditable}
        />
      </div>
    </div>
  );
};

export default BillingRules;
