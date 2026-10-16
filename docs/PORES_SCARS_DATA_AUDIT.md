# Pores, cicatrices et sévérité : sources vérifiées

Vérification du 16 octobre 2026. **Aucun nouveau modèle de pores ou de cicatrices n'est activé à l'issue de cette recherche.** Les statistiques locales de couleur/contraste ne mesurent pas ces phénomènes.

## Sources et obstacles concrets

| Source primaire | Ce qui existe | Ce qui manque pour cette application |
|---|---|---|
| [DetectDataSkin-2, skindetect](https://universe.roboflow.com/skindetect-xueeo/detectdataskin-2) | 3 462 images annoncées ; détection d'objets, classes `Pori-Pori` et `Bekas Jerawat` ; licence déclarée CC BY 4.0 | La page indique **0 version et 0 modèle**. Aucun export d'entraînement publié constaté. Pas de grades de sévérité. Vérifier visuellement et auprès de la documentation si `Bekas Jerawat` distingue cicatrices et marques pigmentaires. |
| [AcneSCU, auteurs SA-RPN](https://github.com/pingguokiller/acnedetection) | Données de lésions, dont cicatrices ; code Apache-2.0 ; lien Baidu avec code `afia` | Les auteurs limitent explicitement **les données à un usage non commercial**. La licence du code ne remplace pas celle des images. Les catégories de lésions ne sont pas des niveaux de sévérité. |
| [SA-RPN entraîné par Kumario1](https://github.com/Kumario1/sa-rpn-acne-detection/releases/tag/v1.0) | Checkpoint `epoch_15.pth`, 357 770 711 octets ; catégories `atrophic_scar` et `hypertrophic_scar` selon le README | Dépend de l'implémentation MMDetection/MMCV ancienne avec convolutions déformables ; pas directement un classifieur ONNX compatible avec notre registre. Restrictions des données AcneSCU à respecter. Aucun grade léger/modéré/marqué. |
| [Vasić, Zenodo 8228942](https://zenodo.org/records/8228942) | 3 086 images annoncées, cinq classes d'apparence liées aux pores | **Fichiers restreints**, accès sur demande pour recherche scientifique. Les cinq classes ne doivent pas être renommées arbitrairement en trois grades. |
| [GRANDAID, auteurs](https://github.com/frankkramer-lab/GRANDAID) | Pipeline public Apache-2.0 pour plusieurs attributs dont pores | Le README indique que les images ne sont pas distribuables. Code accessible ne signifie pas données ni poids entraînés accessibles. |
| [tugbadur/skin-analysis-project](https://github.com/tugbadur/skin-analysis-project) | ResNet-50, 18 régressions dont pores et marques post-acné, poids annoncés | Pas de licence déclarée ; origine des annotations et droits des images à établir ; seulement 150 originaux d'entraînement et 50 de validation appariés selon le README. Une régression sur marques post-acné n'établit pas une sévérité de cicatrices. |

La page DetectDataSkin-2 propose également un exemple d'API de détection générale. Ce n'est pas un modèle entraîné sur ce dataset : elle ne constitue pas une solution vérifiée pour compter les pores ou les cicatrices. Ne pas envoyer de photos utilisateur à ce service dans le cadre de cette recherche.

## Prochaine étape réalisable

1. Obtenir un export annoté autorisé de DetectDataSkin-2, en conservant attribution, version, licence, coordonnées des boîtes et classes originales. L'accès à un compte ne garantit pas qu'un export puisse être créé ; il faut vérifier les possibilités offertes par le propriétaire.
2. Inspecter les images et annotations : visage versus fragment, résolution suffisante, doublons, catégories de marques/cicatrices, droits déclarés et diversité des captures. Ne pas confondre comédons et pores.
3. Séparer les personnes avant augmentation, en train/validation/test ; évaluer séparément chaque classe avec précision, rappel et mAP. Les images sans identité vérifiable ne permettent pas de garantir l'indépendance des personnes.
4. Entraîner un détecteur sur ces annotations, puis exposer **localisations et nombre de détections** avec probabilités et provenance. Une absence de détection n'établit pas une absence de cicatrices. Les boîtes ne mesurent pas leur surface exacte, leur profondeur ni une taille en millimètres.
5. Pour les grades **absent / léger / modéré / marqué**, obtenir des annotations distinctes par indicateur, une grille documentée et une relecture compétente. Réserver un test indépendant et publier matrice de confusion, macro-F1 et accord ordinal. Les boîtes, la confiance du détecteur et les classes binaires ne suffisent pas à fabriquer ces grades.

Le modèle d'acné existant fournit déjà des classes d'acné. Ces classes ne renseignent pas la sévérité des pores, des cicatrices ou des rides. Le pilote local de rides préannoté par IA reste un pilote, pas une validation indépendante.

## État de livraison

Recherche et obstacles documentés ; pas de téléchargement des bases restreintes, pas d'entraînement pores/cicatrices effectué, pas de nouvelle précision annoncée et pas de résultat artificiel dans le rapport. L'export annoté exploitable et les annotations de sévérité restent nécessaires.

## Nouvelle recherche : téléchargements effectivement obtenus

La recherche complémentaire a trouvé des sources supplémentaires. Les résultats ci-dessous remplacent le constat initial d'absence de données directement téléchargeables pour les pores.

### Pores : images classées et segmentation

- [Facial Skin, Shijo John, Kaggle, version 1](https://www.kaggle.com/datasets/shijo96john/facial-skin-acne-pigmentation-pores-wrinkles) : archive de **261 014 006 octets**, téléchargée et intégrité ZIP vérifiée. **4 233 images**, dont **600 dans `pores`**. Licence déclarée par le déposant : Apache 2.0. La description ne documente pas les consentements individuels, la qualification des annotateurs ou une échelle de sévérité.
- Audit initial des pixels RGB avant correction EXIF : 4 099 images uniques dans l'ensemble de l'archive, 115 groupes de doublons exacts. L'inspection d'une planche de 12 images de pores montre également des variantes très proches. Ne pas faire de séparation aléatoire image par image sans regrouper les variantes et, si possible, les personnes.
- Une catégorie `pores` est une annotation de préoccupation cutanée, **pas un masque de pores, un nombre, ni un grade de sévérité**. Les autres catégories ne sont pas nécessairement des négatifs fiables pour les pores.
- Préparation terminée : **592 images de pores uniques en pixels** après orientation EXIF, exportées localement avec manifeste et CSV de relecture. Les variantes visuellement proches ne sont pas éliminées par ce contrôle des doublons exacts.
- [Pore-Net, dépôt des auteurs](https://github.com/ZombaSY/Pore-Net-release), révision `6f851e0d911bd73f41dd905c685129b13d52e1bc` : checkpoint **27 390 octets**, architecture et un triplet image/annotation/masque de région téléchargés. Licence du dépôt Apache-2.0 ; le README ne décrit pas les conditions de collecte des images. Un exemple n'est pas une base d'entraînement complète.
- Test local CPU réussi : chargement strict du checkpoint avec `weights_only=True`, entrée RGB normalisée selon le code des auteurs à 1280 × 1024, sortie de segmentation finie aux dimensions attendues. Seuil 0,25 repris de leur configuration. Ce test **ne mesure pas une précision indépendante**, l'exemple pouvant appartenir aux données d'entraînement. Aucune classe de sévérité n'est produite.

### Fausse piste écartée après téléchargement

[Acne Computer Vision, IMT Kaggle Team, version 1](https://www.kaggle.com/datasets/imtkaggleteam/acne-computer-vision) : archive de **89 110 099 octets**, intégrité ZIP vérifiée ; **2 047 images** et trois CSV de boîtes englobantes. La description prévoit une future classe `Scar`, mais les CSV présents contiennent seulement **4 169 `acne`, 643 `pimple`, 5 060 `spot`**. Aucune annotation `scar` : les taches ne sont pas renommées cicatrices. Licence déclarée CC BY 4.0.

### Cicatrices : archive réellement accessible

[isaigm/scarnet](https://github.com/isaigm/scarnet), révision `4d515756feff2cf8b735f36fa362770fb3536268` : archive **69 950 531 octets**, téléchargée et intégrité ZIP vérifiée. Le README annonce 250 images ; l'archive contient effectivement **251 fichiers image** : Boxcar 50, Hypertrophic 50, Ice Pick 50, Keloid 51, Rolling 50. Ce sont des **types de cicatrices, pas des degrés de sévérité**. L'audit local doit éliminer les doublons et contrôler le contenu avant entraînement.

L'audit local a identifié **249 images uniques en pixels après orientation EXIF**, deux groupes de doublons exacts et aucun fichier image illisible. Les quasi-doublons, identités et incohérences entre types restent à contrôler.

Le README déclare le projet sous licence MIT, mais aucun fichier LICENSE séparé n'a été trouvé et les permissions individuelles des images ne sont pas documentées. Archive conservée pour étude locale, sans redistribution des photos ni activation dans le produit. Le checkpoint inclus est un classifieur de types, sans classe « peau sans cicatrice » : il ne convient pas à une détection universelle de présence. L'auteur rapporte une moyenne de validation croisée de 64,4 %, très inférieure au résultat d'un découpage favorable ; ces résultats externes n'ont pas été reproduits ici et ne prouvent pas une indépendance entre personnes.

### Emplacement et reproduction du contrôle

Les archives, métadonnées et empreintes SHA-256 sont conservées localement dans `backend/data/skin_dataset_search/`, les fichiers Pore-Net dans `backend/data/pore_net_research/`. Aucun visage ni poids n'est ajouté à Git.

Le manifeste versionné `backend/training/skin_sources.json` fixe les sources, versions, révision Pore-Net et empreintes des fichiers récupérés. Depuis la racine du dépôt :

```powershell
backend/.venv/Scripts/python.exe backend/training/audit_skin_datasets.py
```

Ce contrôle vérifie les empreintes et les archives, décode les photos, inventorie les annotations, exporte les images de pores et de cicatrices sous noms dérivés des pixels dans `prepared_pores/images/` et `prepared_scars/images/`, et crée des manifestes avec `severity`, `subject_id` et `split` laissés explicitement vides. Il ne fabrique ni grades ni indépendance entre personnes. Le rapport est `verified_audit.json` dans le même dossier local.

Chaque dossier préparé reçoit aussi un `severity-to-review.csv` compatible avec le format de contrôle de l'entraînement existant. Les colonnes `label`, `annotator`, `subject_id` et `split` restent vides tant qu'une relecture ne les a pas remplies. `original_type` conserve la catégorie d'origine sans la transformer en grade. Un CSV existant n'est jamais écrasé par l'audit. En l'état, ces CSV ne peuvent pas entraîner de modèle de sévérité : les validations exigent les annotations manquantes.

Le résumé reproductible des résultats contrôlés est versionné dans `backend/training/skin_data_audit.json`. Vérifications effectuées : intégrité des trois ZIP, empreintes des sources, décodage des images, présence des 592 + 249 fichiers préparés, absence de grades/splits fabriqués, test de segmentation Pore-Net et contrôles du script sur une petite archive d'essai (doublons, rejet d'une empreinte incorrecte, conservation d'un CSV relu). Aucun entraînement ou test clinique n'a été effectué sur ces nouvelles données.
