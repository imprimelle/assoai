# Documentation Webhooks N8N - Reconstruction des Workflows

Cette documentation détaille les structures de données et workflows nécessaires pour reconstruire les intégrations N8N.

---

## 📋 Vue d'ensemble

L'application utilise **2 webhooks N8N** :
1. **Webhook Chat** : Génération de réponses IA et création de templates
2. **Webhook PDF** : Génération de documents PDF/Images à partir de templates

---

## 🔗 1. WEBHOOK CHAT - Génération de Réponses IA

### URL
```
https://n8n-imprimelle-clone-u36828.vm.elestio.app/webhook/edf43b0b-d887-4a9d-ace5-bc554c888474
```

### Configuration
- **Méthode** : POST
- **Content-Type** : application/json
- **Timeout** : 
  - 15 minutes pour sessions chat normales
  - 30 minutes pour sessions projet (sessionId commence par `project_`)
- **Headers requis** :
  - `Content-Type: application/json`
  - `User-Agent: Lovable-WebApp/1.0`
  - `X-Session-ID: {sessionId}`
  - `X-Request-ID: {timestamp}-{random}`

### Structure de Requête (MessagePayload)

```typescript
{
  userId: string;              // ID de l'utilisateur
  sessionId: string;           // ID de session unique
  timestamp: string;           // ISO 8601 timestamp
  message: {
    type: MessagePayloadType;  // Type déterminé automatiquement
    content: string;           // Contenu textuel du message
    attachments: string[];     // URLs des fichiers attachés
    
    // Optionnel : Guidelines pour l'IA
    promptGuidelines?: {
      title: string;
      description: string;
      examples: string[];
    };
    
    // Optionnel : Template existant (édition)
    template?: {
      templateType: TemplateType;
      data: TemplateData;      // Voir structures ci-dessous
    };
    
    // Optionnel : Citation d'un document
    quote?: {
      type: string;            // "template"
      templateType: string;    // Type du document cité
      numero?: string;         // Numéro du document
      client?: string;         // Nom du client
      montant?: string;        // Montant (string)
      date?: string;           // Date
      title?: string;          // Titre
      additionalText?: string; // Texte additionnel
      version?: number;
      is_latest?: boolean;
    };
  };
}
```

### Types de Messages (MessagePayloadType)

Le type est déterminé automatiquement par la fonction `determineMessagePayloadType` :
- `"text"` : Message texte simple
- `"attachment"` : Uniquement des fichiers
- `"template"` : Uniquement un template
- `"template_with_text"` : Template + texte
- `"attachment_with_text"` : Fichiers + texte

### Structure de Réponse Attendue (ResponsePayload)

```typescript
{
  agentId: string;           // ID de l'agent IA
  sessionId: string;         // Même sessionId que la requête
  timestamp: string;         // ISO 8601 timestamp
  response: {
    mode: "text" | "template";
    
    // Si mode = "text"
    textFallback?: string;   // Réponse textuelle
    
    // Si mode = "template"
    templateType?: TemplateType;
    data?: TemplateData;     // Données du template généré
    metadata?: {
      displayName: string;
      description?: string;
      availableActions: string[]; // ["save", "download", "edit", "pdf"]
      mode: "readonly" | "editable";
      source?: "chatMessage" | "library" | "userGenerated" | "webhook";
    };
  };
}
```

---

## 📄 2. WEBHOOK PDF - Génération de Documents

### URL
```
https://n8n-imprimelle-clone-u36828.vm.elestio.app/webhook/90129170-109a-4494-b907-9522ffdfe84b
```

### Configuration
- **Méthode** : POST
- **Content-Type** : application/json
- **Timeout** : 15 minutes
- **Headers requis** :
  - `Content-Type: application/json`
  - `User-Agent: CRM-Template-App/1.0`
  - `X-Request-ID: {sessionId}-{timestamp}`

### Structure de Requête (PDFGenerationPayload)

```typescript
{
  templateType: TemplateType;    // Type de template
  data: TemplateData;            // Données complètes du template
  userId: string;                // ID utilisateur
  sessionId: string;             // ID session
  generationType: "pdf" | "image"; // Type de génération
  timestamp: string;             // ISO 8601 timestamp
  requestId: string;             // ID unique de requête
}
```

### Structure de Réponse Attendue (PDFGenerationResponse)

```typescript
{
  success: boolean;
  status: "ok" | "error" | "success";
  
  // URLs du document généré
  url?: string;                  // URL originale
  pdfUrl?: string;              // URL du PDF
  imageUrl?: string;            // URL de l'image (si generationType = "image")
  downloadUrl?: string;         // URL de téléchargement direct
  
  // Métadonnées
  filename?: string;            // Nom du fichier généré
  templateType?: string;        // Type de template
  message?: string;             // Message de succès/erreur
  documentNumber?: string;      // Numéro du document
  
  // En cas d'erreur
  error?: string;
  errorMessage?: string;
  errorType?: string;           // "TIMEOUT", "NETWORK_ERROR", "SERVICE_ERROR", etc.
  webhookUrl?: string;          // URL du webhook (debug)
  responseTime?: number;        // Temps de réponse en ms
}
```

---

## 📝 3. STRUCTURES DE DONNÉES PAR TYPE DE TEMPLATE

### 3.1 FACTURE (FactureData)

```typescript
{
  factureNumero: string;        // Auto-généré (ex: "F-2025-001")
  dateEmission: string;         // Format: "YYYY-MM-DD"
  statut?: "Brouillon" | "infographie" | "demande" | "Payé" | "Livré";
  
  client: {
    nom: string;                // Nom du client
    adresse: string;            // Adresse complète
    telephone?: string;         // Téléphone (optionnel)
  };
  
  details: Array<{              // Lignes de facturation
    id: string;                 // ID unique
    description: string;        // Description de l'article
    quantite: number;           // Quantité
    prixUnitaire: number;       // Prix unitaire
    sous_total: number;         // Sous-total (quantite * prixUnitaire)
  }>;
  
  total: number;                // Total de la facture
  version: number;              // Numéro de version (incrémenté à chaque modification)
  is_latest: boolean;           // true si c'est la version actuelle
  
  // Optionnels
  contact?: string;             // Personne de contact
  delaiLivraison?: string;      // Délai de livraison
  echeancier?: string;          // Échéancier de paiement
  reduction?: number;           // Réduction en %
  deliveryAddress?: {           // Adresse de livraison si différente
    street: string;
    city: string;
    postalCode: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
}
```

**Exemple de Facture** :
```json
{
  "factureNumero": "F-2025-001",
  "dateEmission": "2025-01-15",
  "statut": "Payé",
  "client": {
    "nom": "SARL TechnoPlus",
    "adresse": "12 Rue de la République, 75001 Paris",
    "telephone": "+33 1 42 33 44 55"
  },
  "details": [
    {
      "id": "detail-1",
      "description": "Enseigne lumineuse LED 2m x 1m",
      "quantite": 2,
      "prixUnitaire": 850.00,
      "sous_total": 1700.00
    },
    {
      "id": "detail-2",
      "description": "Installation et mise en service",
      "quantite": 1,
      "prixUnitaire": 300.00,
      "sous_total": 300.00
    }
  ],
  "total": 2000.00,
  "version": 1,
  "is_latest": true,
  "delaiLivraison": "15 jours",
  "reduction": 0
}
```

---

### 3.2 DEVIS (DevisData)

```typescript
{
  devisNumero: string;          // Auto-généré (ex: "D-2025-001")
  dateEmission: string;         // Format: "YYYY-MM-DD"
  validiteJours: number;        // Durée de validité en jours
  statut?: "Brouillon" | "En attente" | "Accepté" | "Refusé" | "Expiré";
  
  client: {
    nom: string;
    adresse: string;
    telephone?: string;
  };
  
  details: Array<{              // Même structure que Facture
    id: string;
    description: string;
    quantite: number;
    prixUnitaire: number;
    sous_total: number;
  }>;
  
  total: number;
  version: number;
  is_latest: boolean;
  
  // Optionnels
  deliveryAddress?: DeliveryAddress;
  cdc_id?: string;              // ID du cahier des charges lié
  type_structure?: string;      // Type de structure (si applicable)
  method_fabrication?: string;  // Méthode de fabrication
}
```

**Exemple de Devis** :
```json
{
  "devisNumero": "D-2025-042",
  "dateEmission": "2025-01-15",
  "validiteJours": 30,
  "statut": "En attente",
  "client": {
    "nom": "Restaurant Le Gourmet",
    "adresse": "45 Avenue des Champs, 69002 Lyon",
    "telephone": "+33 4 78 90 12 34"
  },
  "details": [
    {
      "id": "detail-1",
      "description": "Enseigne néon personnalisée",
      "quantite": 1,
      "prixUnitaire": 1200.00,
      "sous_total": 1200.00
    }
  ],
  "total": 1200.00,
  "version": 1,
  "is_latest": true,
  "type_structure": "Caisson lumineux",
  "method_fabrication": "Néon LED"
}
```

---

### 3.3 COMMANDE (CommandeData)

```typescript
{
  commandeNumero: string;       // Auto-généré (ex: "C-2025-001")
  dateCommande?: string;        // Date de commande
  dateEmission?: string;        // Date d'émission
  dateLivraison?: string;       // Date de livraison prévue
  statut: string;               // Statut de la commande
  
  client: {
    nom: string;
    adresse: string;
    telephone?: string;
  };
  
  items: Array<{                // Articles commandés
    id: string;
    nom: string;                // Nom de l'article
    quantite: number;
    prixUnitaire: number;
    sous_total: number;
    image_url?: string;         // Image du produit
  }>;
  
  details?: Array<{             // Détails supplémentaires
    note?: string;
    option?: string;
    delaiLivraison?: string;
    montantAvance?: number;
  }>;
  
  total: number;
  version: number;
  is_latest: boolean;
  
  // Optionnels
  linked_facture_id?: string | null;  // ID de la facture liée
  recu_image_url?: string | null;     // Image du reçu
  deliveryAddress?: DeliveryAddress;
}
```

**Exemple de Commande** :
```json
{
  "commandeNumero": "C-2025-015",
  "dateCommande": "2025-01-14",
  "dateEmission": "2025-01-14",
  "dateLivraison": "2025-01-29",
  "statut": "En cours",
  "client": {
    "nom": "Boutique Mode & Style",
    "adresse": "78 Rue de la Mode, 13001 Marseille"
  },
  "items": [
    {
      "id": "item-1",
      "nom": "Panneau publicitaire 3m x 2m",
      "quantite": 1,
      "prixUnitaire": 450.00,
      "sous_total": 450.00,
      "image_url": "https://..."
    }
  ],
  "details": [
    {
      "note": "Installation incluse",
      "delaiLivraison": "15 jours",
      "montantAvance": 150.00
    }
  ],
  "total": 450.00,
  "version": 1,
  "is_latest": true
}
```

---

### 3.4 CAHIER DES CHARGES (CahierDesChargesData) - MULTI-ENSEIGNES

⚠️ **Structure la plus complexe** : Support multi-enseignes avec produits et matériaux par enseigne

```typescript
{
  titre: string;                // Titre du cahier des charges
  commande_id?: string;         // ID de commande liée
  statut?: "Brouillon" | "infographie" | "demande" | "Payé" | "Livré";
  
  // === STRUCTURE MULTI-ENSEIGNES ===
  enseignes: Array<{
    id: string;                 // ID unique de l'enseigne
    nom: string;                // Nom de l'enseigne
    
    // Produits (SANS PRIX - références uniquement)
    produits: Array<{
      id: string;
      nom: string;
      description?: string;
      image_url?: string;
    }>;
    
    // Détails spécifiques à l'enseigne
    details: {
      image_url?: string;       // Image de l'enseigne
      dimensions: {
        largeur: number;        // en cm
        hauteur: number;        // en cm
        profondeur?: number;    // en cm
      };
      technique: {
        type_structure: string;      // Ex: "Caisson lumineux"
        method_fabrication: string;  // Ex: "Aluminium + LED"
      };
    };
    
    // Matériaux par section (optionnel)
    materiauxSections?: {
      [sectionName: string]: Array<{
        id: string;
        name: string;
        quantity: number;
        unit: string;
        description?: string;
      }>;
    };
  }>;
  
  // Équipe commune à toutes les enseignes
  equipe: Array<{
    id: string;
    name: string;
    role: string;
    email?: string;
    phone?: string;
  }>;
  
  version: number;
  is_latest: boolean;
  deliveryAddress?: DeliveryAddress;
  
  // === DONNÉES LEGACY (rétrocompatibilité) ===
  materiauxSections?: Record<string, MaterialItem[]>;
  dimensions?: {
    largeur: number;
    hauteur: number;
    profondeur?: number;
  };
  technique?: {
    type_structure: string;
    method_fabrication: string;
  };
  image_url?: string;
}
```

**Exemple de Cahier des Charges Multi-Enseignes** :
```json
{
  "titre": "Enseignes Centre Commercial Rivoli",
  "statut": "infographie",
  "enseignes": [
    {
      "id": "enseigne-1",
      "nom": "Entrée Principale",
      "produits": [
        {
          "id": "prod-1",
          "nom": "Panneau LED personnalisé",
          "description": "Lettres découpées rétro-éclairées"
        }
      ],
      "details": {
        "image_url": "https://storage.googleapis.com/...",
        "dimensions": {
          "largeur": 400,
          "hauteur": 150,
          "profondeur": 15
        },
        "technique": {
          "type_structure": "Caisson aluminium",
          "method_fabrication": "LED + PVC"
        }
      },
      "materiauxSections": {
        "Structure": [
          {
            "id": "mat-1",
            "name": "Profilé aluminium",
            "quantity": 12,
            "unit": "m",
            "description": "40x40mm anodisé"
          }
        ],
        "Éclairage": [
          {
            "id": "mat-2",
            "name": "Bande LED blanc chaud",
            "quantity": 20,
            "unit": "m",
            "description": "12V, 120 LED/m"
          }
        ]
      }
    },
    {
      "id": "enseigne-2",
      "nom": "Parking Est",
      "produits": [
        {
          "id": "prod-2",
          "nom": "Panneau directionnel"
        }
      ],
      "details": {
        "dimensions": {
          "largeur": 200,
          "hauteur": 80
        },
        "technique": {
          "type_structure": "Dibond",
          "method_fabrication": "Impression numérique"
        }
      }
    }
  ],
  "equipe": [
    {
      "id": "team-1",
      "name": "Jean Dupont",
      "role": "Chef de projet",
      "email": "j.dupont@entreprise.fr"
    },
    {
      "id": "team-2",
      "name": "Marie Martin",
      "role": "Infographiste",
      "email": "m.martin@entreprise.fr"
    }
  ],
  "version": 1,
  "is_latest": true
}
```

---

## 🔄 4. WORKFLOW N8N RECOMMANDÉ

### Workflow Chat (Webhook 1)

```
1. Réception du webhook (POST)
   ↓
2. Validation de la requête
   - Vérifier les champs obligatoires
   - Extraire type, content, sessionId, userId
   ↓
3. Traitement selon message.type
   
   SI "text" ou "attachment" :
   ├─→ Envoyer à l'IA (GPT/Claude/Gemini)
   ├─→ Générer réponse textuelle
   └─→ Retourner ResponsePayload avec mode="text"
   
   SI "template" ou "template_with_text" :
   ├─→ Analyser le template existant
   ├─→ Traiter la demande de modification/création
   ├─→ Générer nouveau template avec l'IA
   └─→ Retourner ResponsePayload avec mode="template"
   
   SI quote présent :
   ├─→ Charger le document cité
   ├─→ Contexte enrichi pour l'IA
   └─→ Traiter selon le contexte
   ↓
4. Logging et monitoring
   - Logger succès/échec
   - Métriques de performance
   ↓
5. Retour de la réponse (JSON)
```

### Workflow PDF (Webhook 2)

```
1. Réception du webhook (POST)
   ↓
2. Validation de la requête
   - Vérifier templateType, data, generationType
   ↓
3. Sélection du moteur de génération
   
   SI generationType = "pdf" :
   └─→ Utiliser générateur PDF (Puppeteer/PDFKit)
   
   SI generationType = "image" :
   └─→ Utiliser générateur d'images (Sharp/Canvas)
   ↓
4. Génération du document selon templateType
   
   ├─ Facture → Template facture HTML → PDF/Image
   ├─ Devis → Template devis HTML → PDF/Image
   ├─ Commande → Template commande HTML → PDF/Image
   └─ Cahier des charges → Template CDC complexe → PDF/Image
   ↓
5. Upload vers stockage
   - Upload vers Google Cloud Storage
   - Générer URL publique ou signée
   ↓
6. Retour de la réponse
   - url: URL originale
   - downloadUrl: URL de téléchargement direct
   - filename: Nom du fichier
   - status: "ok"
```

---

## 🚨 5. POINTS D'ATTENTION CRITIQUES

### Gestion des Versions
- Chaque modification de template incrémente `version`
- Seul le template avec `is_latest: true` est affiché par défaut
- Le trigger `trg_messages_deflag()` déflag automatiquement les anciennes versions

### Timeouts
- **Chat standard** : 15 minutes
- **Chat projet** : 30 minutes (sessionId commence par `project_`)
- **PDF** : 15 minutes

### Sécurité
- Valider toutes les entrées
- Sanitiser les données avant génération PDF
- Vérifier les permissions utilisateur (userId/sessionId)

### Performances
- Payload > 100KB → Log avertissement
- Utiliser compression si nécessaire
- Heartbeat toutes les 15-30s pour maintenir la connexion

### Codes d'Erreur à Gérer
- `400` : Données invalides → `BAD_REQUEST`
- `403` : Accès refusé → `FORBIDDEN`
- `404` : Service non trouvé → `NOT_FOUND`
- `500+` : Erreur serveur → `SERVER_ERROR`
- `Timeout` : AbortError → `TIMEOUT`
- `Network` : Failed to fetch → `NETWORK_ERROR`

---

## 📊 6. EXEMPLES DE TESTS

### Test Webhook Chat - Message Simple
```bash
curl -X POST \
  https://n8n-imprimelle-clone-u36828.vm.elestio.app/webhook/edf43b0b-d887-4a9d-ace5-bc554c888474 \
  -H "Content-Type: application/json" \
  -H "User-Agent: Lovable-WebApp/1.0" \
  -H "X-Session-ID: test-session-123" \
  -d '{
    "userId": "user-123",
    "sessionId": "test-session-123",
    "timestamp": "2025-01-15T10:30:00Z",
    "message": {
      "type": "text",
      "content": "Crée-moi une facture pour le client SARL TechnoPlus",
      "attachments": []
    }
  }'
```

### Test Webhook PDF - Génération Facture
```bash
curl -X POST \
  https://n8n-imprimelle-clone-u36828.vm.elestio.app/webhook/90129170-109a-4494-b907-9522ffdfe84b \
  -H "Content-Type: application/json" \
  -H "User-Agent: CRM-Template-App/1.0" \
  -H "X-Request-ID: test-123-456" \
  -d '{
    "templateType": "facture",
    "generationType": "pdf",
    "userId": "user-123",
    "sessionId": "session-123",
    "timestamp": "2025-01-15T10:30:00Z",
    "requestId": "test-123-456",
    "data": {
      "factureNumero": "F-2025-001",
      "dateEmission": "2025-01-15",
      "statut": "Payé",
      "client": {
        "nom": "SARL TechnoPlus",
        "adresse": "12 Rue de la République, 75001 Paris"
      },
      "details": [
        {
          "id": "1",
          "description": "Enseigne LED",
          "quantite": 1,
          "prixUnitaire": 1000,
          "sous_total": 1000
        }
      ],
      "total": 1000,
      "version": 1,
      "is_latest": true
    }
  }'
```

---

## 📚 7. RESSOURCES ADDITIONNELLES

### Fichiers Clés du Projet
- `src/services/webhook.ts` : Logique d'envoi webhook chat
- `src/services/pdfService.ts` : Logique d'envoi webhook PDF
- `src/types/message.ts` : Types MessagePayload et ResponsePayload
- `src/types/template-data.ts` : Structures de tous les templates
- `src/types/pdf.ts` : Types PDF
- `src/utils/response-payload.ts` : Construction des payloads

### Base de Données
- Table `messages` : Stockage de tous les messages et templates
- Trigger `trg_messages_prepare()` : Prépare les templates avant insertion
- Trigger `trg_messages_deflag()` : Déflag les anciennes versions

---

**Document créé le** : 2025-01-15  
**Version** : 1.0  
**Auteur** : Documentation automatique basée sur l'analyse du code