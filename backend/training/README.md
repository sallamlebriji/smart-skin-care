# Entraîner un modèle local de niveaux de rides

## État réel

Le script de préparation a téléchargé un jeu public Kaggle d'environ 30 Mo et préparé **761 images uniques** localement. La source contient des classes binaires, pas les niveaux légères/modérées/marquées. L'inspection a montré de nombreux fragments et images filtrées ; ces données ne sont pas utilisées pour le pilote sur visages complets décrit plus bas.

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

## Pilote préannoté par IA

Un lot distinct de **238 photos** a été retenu après inspection visuelle de 330 images provenant du [miroir public AmirGenAI/my-wrinkle-seg-dataset](https://huggingface.co/datasets/AmirGenAI/my-wrinkle-seg-dataset). Les mosaïques d'augmentation, certaines images filtrées/retouchées et les cas trop ambigus ont été écartés. Le modèle de segmentation d'origine et ses masques n'ont pas fourni les labels de sévérité : les quatre niveaux ont été préannotés visuellement par l'assistant IA et sont **provisoires, sans relecture humaine ni dermatologique**.

La fiche de ce miroir ne déclare pas de licence explicite dans la version consultée. L'accès public ne garantit pas les droits de redistribution ou d'utilisation commerciale. Ce pilote et ses poids restent destinés à la recherche locale ; aucune photo n'est ajoutée au dépôt Git.

Les variantes détectées avec un hash perceptuel de l'image entière (distance <=6) sont regroupées pour la répartition. Cela ne reconnaît pas les personnes. L'indépendance entre personnes n'est pas établie et des quasi-doublons non détectés peuvent subsister. L'identifiant `image-cluster-*` dans la colonne `subject_id` représente ici un groupe de photos, pas une identité de personne vérifiée.

| Ensemble | Absentes | Légères | Modérées | Marquées | Total |
|---|---:|---:|---:|---:|---:|
| Entraînement | 42 | 39 | 42 | 20 | 143 |
| Validation | 13 | 13 | 13 | 7 | 46 |
| Test exploratoire | 13 | 14 | 15 | 7 | 49 |

Les images sources proviennent des partitions nommées `validation` et `test` du miroir de segmentation ; elles sont repartitionnées ici pour cette nouvelle tâche de classification. Il ne s'agit donc pas d'une évaluation reproduisant celle du modèle de segmentation d'origine. Les métriques évaluent l'accord avec des labels IA, pas une vérité clinique indépendante.

Le manifeste versionné `pilot_annotations.json` contient les préannotations, indices source et empreintes des images. Pour reproduire le pilote :

```powershell
.\.venv\Scripts\python.exe training/prepare_pilot.py
.\.venv\Scripts\python.exe training/train_severity.py --annotations data/wrinkle_training/annotations-ai-pilot.csv --output data/wrinkle_training/pilot-severity --epochs 30 --annotation-origin ai_visual_provisional --grouping source_image_only --dataset-source https://huggingface.co/datasets/AmirGenAI/my-wrinkle-seg-dataset
.\.venv\Scripts\python.exe training/train_transfer.py
```

Le premier modèle est un petit CNN entraîné de zéro. Le second entraîne une tête de classification à quatre niveaux sur des caractéristiques ViT gelées du checkpoint binaire existant. La tête est choisie selon la macro-F1 de validation ; l'ensemble de test n'intervient pas dans l'optimisation. Les résultats de ces deux expériences doivent être lus comme exploratoires, et ne suffisent pas à sélectionner une version prête à être utilisée par le public.

L'export ONNX inclut le réseau complet, et sa sortie est comparée numériquement à PyTorch. Les poids, rapports et images restent dans `data/wrinkle_training/`. Pour une inférence locale de recherche :

```powershell
.\.venv\Scripts\python.exe training/predict_severity.py --model-dir data/wrinkle_training/pilot-severity --photo chemin/vers/photo.jpg
```

Le script affiche la classe prédite et la distribution des classes, en précisant la provenance IA des labels. Pour le modèle transféré, utiliser `--model-dir data/wrinkle_training/pilot-severity-transfer`.

Les deux modèles ont été entraînés et testés localement. Le CNN atteint 30,6 % d'accord avec les labels IA du test (macro-F1 0,221) ; le modèle transféré atteint 61,2 % (macro-F1 0,608). Ces chiffres portent sur 49 images et ne constituent pas une validation clinique. Le [rapport du pilote](../../docs/SEVERITY_PILOT_RESULTS.md) détaille les erreurs et les limites.

Pour essayer le modèle transféré dans une page locale séparée :

```powershell
.\.venv\Scripts\python.exe -m uvicorn training.serve_pilot:app --host 127.0.0.1 --port 8767
```

Ouvrir `http://localhost:8767/`. Le serveur garde la photo uniquement en mémoire pour la prédiction. Il contrôle la taille du fichier et utilise une heuristique OpenCV pour demander un seul visage frontal ; celle-ci peut rejeter des photos valides. Il ne remplace pas le modèle de l'application principale et ne doit pas être déployé comme service public.

## Vérification technique

Les tests contrôlent le refus des labels manquants, des fuites entre personnes, des doublons et des données modifiées. Un entraînement d'une époque sur des images synthétiques ne vérifie que le fonctionnement de la chaîne ; ses poids et ses métriques ne sont pas un modèle de rides utilisable et ne sont pas publiés.
