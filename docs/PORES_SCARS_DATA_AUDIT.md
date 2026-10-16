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
