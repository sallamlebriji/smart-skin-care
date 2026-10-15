# Prototype local de sévérité des rides

Deux modèles ont réellement été entraînés et exportés en ONNX. Ils restent des prototypes de recherche, sans activation dans l’application principale. Les images et les poids restent locaux, exclus de Git.

## Données et limites

- 238 photos sélectionnées sur 330 images du miroir public AmirGenAI/my-wrinkle-seg-dataset ; 143 pour entraîner, 46 pour valider, 49 pour tester.
- Classes : absentes, légères, modérées, marquées.
- Labels : préannotations visuelles IA provisoires, sans relecture humaine/dermatologique ; aucun niveau n’a été obtenu en convertissant la probabilité du modèle binaire.
- Variantes proches regroupées par hash perceptuel de l’image entière. Indépendance entre personnes non établie ; pas de reconnaissance d’identité.
- Certaines photos peuvent être retouchées ou affectées par l’expression, l’éclairage et les poses. Les populations et appareils ne sont pas représentés de façon contrôlée.
- La licence des images de ce miroir n’est pas explicitée dans la fiche consultée. Pas de redistribution des photos ni de publication des poids.

## Résultats exploratoires

| Modèle | Meilleure macro-F1 de validation | Accord sur les labels IA du test | Macro-F1 du test |
|---|---:|---:|---:|
| Petit CNN | 0.312 | 30.6% | 0.221 |
| ViT gelé + tête entraînée | 0.716 | 61.2% | 0.608 |

Le modèle transféré est préféré sur la validation. Le test n’a pas servi au réglage des paramètres ; les deux expériences restent exploratoires sur un même petit lot. Les 61 % d’accord ne représentent pas une précision clinique et ne garantissent pas le comportement sur de nouvelles personnes.

Matrice du modèle transféré (lignes = labels IA, colonnes = prédictions) :

| Référence IA / Prédiction | Absentes | Légères | Modérées | Marquées |
|---|---:|---:|---:|---:|
| Absentes | 11 | 2 | 0 | 0 |
| Légères | 2 | 7 | 4 | 1 |
| Modérées | 1 | 1 | 6 | 7 |
| Marquées | 0 | 0 | 1 | 6 |

Les erreurs les plus visibles concernent la séparation entre modérées et marquées. Une relecture indépendante, davantage de photos et une vérification par personnes/carnations/conditions sont nécessaires avant une utilisation publique.

## Essai local

Lancer depuis `backend/` :

```powershell
.\.venv\Scripts\python.exe -m uvicorn training.serve_pilot:app --host 127.0.0.1 --port 8767
```

Ouvrir [le laboratoire local](http://localhost:8767/). Les photos choisies sont traitées sur le PC, sans enregistrement par ce service. Les résultats indiquent explicitement le statut de prototype. Le contrôle de visage est lui-même une heuristique susceptible de rejeter des photos valides.

Poids complets : `backend/data/wrinkle_training/pilot-severity-transfer/severity.onnx`.
Rapport détaillé : `backend/data/wrinkle_training/pilot-severity-transfer/evaluation.json`.
Reproduction : voir [le guide](../backend/training/README.md) et le manifeste `pilot_annotations.json`.

Source : [dataset public consulté](https://huggingface.co/datasets/AmirGenAI/my-wrinkle-seg-dataset). Le backbone est [skintelligent-wrinkles](https://huggingface.co/imfarzanansari/skintelligent-wrinkles), révision 32ddddd41a7e035bbe3abbe4510e0a0ca4b6fb12 ; sa tête binaire a été remplacée par une nouvelle tête entraînée sur les quatre classes.
