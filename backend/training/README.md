# Entraîner un modèle local de niveaux de rides

## État réel

Le script de préparation a téléchargé un jeu public Kaggle d'environ 30 Mo et préparé **761 images uniques** localement. La source contient des classes binaires, pas les niveaux légères/modérées/marquées. Aucun niveau de sévérité n'a été inventé et aucun modèle de sévérité n'est donc encore entraîné ou activé.

Source : [Skin Wrinkles vs Non-Wrinkles, Rixant Rokaha](https://www.kaggle.com/datasets/rishantrokaha/skin-wrinkles-vs-nonwrinkles). L'auteur permet l'utilisation avec attribution ; il indique avoir collecté les images sur plusieurs sites. Cela ne garantit pas les droits sur chaque image pour une redistribution ou un produit commercial. Les images et archives restent dans `backend/data/`, exclu de Git. La provenance et le SHA-256 de l'archive sont enregistrés dans `source.json`.

Les autres sources examinées ne fournissent pas immédiatement les annotations nécessaires :

- [SkinAnalysis, article de recherche](https://pmc.ncbi.nlm.nih.gov/articles/PMC11938992/) : 3662 images annotées par un dermatologue, mais la déclaration des auteurs indique que les données ne sont pas publiques et sont disponibles sur demande.
- [FFHQ-Wrinkle](https://github.com/labhai/ffhq-wrinkle-dataset) : masques de segmentation, pas classes de sévérité ; conditions non commerciales annoncées.
- Les recherches publiques Kaggle `wrinkle severity` et `glogau` n'ont pas renvoyé de dataset correspondant lors de la vérification du 15 octobre 2026.

## Préparer et annoter les données

Depuis `backend/` :

```powershell
.\.venv\Scripts\python.exe training/prepare_data.py
```

Ouvrir `training/annotate.html` dans un navigateur, sélectionner `data/wrinkle_training/images`, puis importer/exporter les annotations CSV. L'outil fonctionne sans envoyer les images à un serveur. Exportez régulièrement le CSV pour conserver votre travail ; il peut être réimporté pour reprendre.

Grille provisoire, à définir précisément et faire relire par une personne compétente :

| Classe | Sens visuel provisoire |
|---|---|
| `none` | Pas de rides visibles dans une photo exploitable |
| `mild` | Fines lignes discrètes |
| `moderate` | Lignes nettement visibles |
| `marked` | Plis visuellement prononcés |

Cette grille n'est pas une échelle clinique validée et ne mesure pas la profondeur physique. Elle doit être appliquée de manière cohérente, indépendamment de l'âge. Exclure les images ambiguës ou de qualité insuffisante du CSV final. Faire contrôler les annotations et les désaccords avant entraînement. Les classes binaires originales et les probabilités du modèle actuel ne doivent pas servir de labels de sévérité.

Chaque ligne requiert `file,sha256,subject_id,label,split,annotator`. Donner le même identifiant anonymisé aux images d'une même personne ; une personne reste exclusivement en `train`, `val` ou `test`. Prévoir environ 60/20/20 et une couverture des carnations, appareils et éclairages dans chaque ensemble. Inspecter les quasi-doublons manuellement ; le contrôle automatique couvre les pixels identiques, pas toute similarité visuelle. Réserver le test jusqu'au choix final du modèle.

## Entraîner et évaluer

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-training.txt
.\.venv\Scripts\python.exe training/train_severity.py --annotations data/wrinkle_training/annotations-reviewed.csv --epochs 30
```

Le script refuse les annotations vides, empreintes modifiées, images dupliquées et personnes réparties entre plusieurs ensembles. Le minimum technique est de 20 images par classe en entraînement et 5 par classe en validation/test (120 au total) ; ce minimum permet d'exécuter un prototype, pas d'établir sa fiabilité. Davantage de données et de personnes sont nécessaires pour juger sa généralisation.

Le modèle initial est un petit CNN à quatre classes (RGB 128×128), entraîné sur CPU avec pondération des classes. Il constitue une base expérimentale, sans promesse de précision. Le meilleur état est choisi sur la macro-F1 de validation ; le test est évalué ensuite une seule fois. Les sorties sont `severity.safetensors`, `severity.onnx` et `evaluation.json` avec matrice de confusion, macro-F1, accuracy, paramètres de prétraitement et empreinte du CSV. L'équivalence ONNX/PyTorch est vérifiée numériquement lors de l'export.

Les poids ne sont jamais activés automatiquement dans l'application. Il faut d'abord examiner les erreurs, l'accord entre annotateurs et les performances par population et conditions de capture. Ensuite, une intégration distincte pourra exposer les quatre classes, sans convertir une probabilité en sévérité ni en score d'apparence arbitraire. Le modèle binaire existant reste utilisable en attendant.

## Vérification technique

Les tests contrôlent le refus des labels manquants, des fuites entre personnes, des doublons et des données modifiées. Un entraînement d'une époque sur des images synthétiques ne vérifie que le fonctionnement de la chaîne ; ses poids et ses métriques ne sont pas un modèle de rides utilisable et ne sont pas publiés.
