# Recherche de modèles pour les sept indicateurs

Vérification : 15 octobre 2026. Les dépôts, configurations et listes de fichiers ont été consultés directement sur Hugging Face et GitHub. Cette recherche ne constitue pas une évaluation de précision. Le modèle binaire de rides est désormais intégré dans une analyse expérimentale séparée, sans score de sévérité. Les six autres pistes restent à évaluer.

## Résultat par indicateur

| Indicateur | Candidat vérifié | Ce qui est disponible | Décision pour Smart Skin Care |
|---|---|---|---|
| Rides | [skintelligent-wrinkles](https://huggingface.co/imfarzanansari/skintelligent-wrinkles) | Poids safetensors, configuration ViT et prétraitement ; licence MIT déclarée. Deux classes : `non-wrinkle`, `wrinkle`. | Candidat prioritaire pour une expérimentation binaire. Ne mesure pas la sévérité ; ne pas transformer sa probabilité en score de qualité cutanée /100. Données d'entraînement et validation indépendante non documentées dans la fiche consultée. |
| Rougeurs | [redness-detection-model](https://huggingface.co/carsten12/redness-detection-model/tree/main) | Fichier `skin_redness.pth` présent. Pas de fiche, de configuration, de prétraitement ou de licence déclarée dans les fichiers/métadonnées consultés. | Attendre l'architecture, le contrat de sortie, la provenance et les conditions d'utilisation. Le nom du fichier ne suffit pas pour établir son fonctionnement. |
| Pigmentation | [skin-pigmentation](https://huggingface.co/Charan2714/skin-pigmentation/tree/main) | Fichier `severity_swin_multimodal_best.pth` présent. Pas de configuration ni de fiche/licence dans le dépôt consulté. | Attendre les mêmes informations ; déterminer aussi les entrées requises par ce modèle dit multimodal. |
| Pores | [skin-scan](https://github.com/DurtyDhiana/skin-scan) | Le README décrit une détection de blobs sur image filtrée ; aucun poids de modèle cutané trouvé dans l'arborescence inspectée. | C'est une piste de traitement d'image, pas un remplacement entraîné du modèle de pores. Aucun checkpoint adapté et documenté n'a été confirmé dans cette recherche. |
| Texture | [texture_model](https://github.com/mo-tunn/texture_model) | Poids Keras v3/v5 présents. Le README décrit un mélange de modèles et des labels issus notamment de caractéristiques mathématiques, d'une calibration manuelle et de pseudo-labels. Aucune licence identifiée par l'API GitHub. | Candidat de recherche, pas prêt à être embarqué. Clarifier les droits et mesurer ses performances sur des annotations indépendantes. La régression Keras n'est pas compatible directement avec notre registre ONNX de classification. |
| Cicatrices | [Scar-Severity-prediction-pytorch](https://github.com/dbssk6904/Scar-Severity-prediction-pytorch) | Code d'entraînement et de validation image/clinique ; aucun poids publié dans l'arborescence inspectée et aucune licence identifiée par l'API GitHub. | Pas de modèle prêt à charger confirmé. Vérifier aussi l'adéquation aux cicatrices faciales/acnéiques plutôt qu'à d'autres types de cicatrices. |
| Uniformité du teint | [SkinAge](https://github.com/Ennsss/SkinAge) | Pipeline multi-tâche à entraîner, utilisant notamment des pseudo-labels couleur/texture. Aucun checkpoint trouvé dans l'arborescence inspectée. | Ne fournit pas un modèle validé et prêt à charger pour cet indicateur. La segmentation de peau seule ne mesure pas l'uniformité. |

« Non confirmé » décrit les limites de cette recherche, pas l'absence universelle de modèle. La présence de poids n'établit ni la qualité des données ni l'exactitude des prédictions.

## Autres pistes rides

- [FFHQ-Wrinkle, dépôt des auteurs ICPR 2024](https://github.com/labhai/ffhq-wrinkle-dataset) : annotations et liens vers des poids de segmentation publiés. Le dataset est annoncé sous CC BY-NC-SA 4.0 ; les auteurs demandent de les contacter pour un usage commercial. Les conditions du dataset et des poids doivent être vérifiées séparément avant intégration. Une segmentation ne fournit pas directement notre score de classification.
- [rmsandu/ffhq-wrinkle-unet](https://huggingface.co/rmsandu/ffhq-wrinkle-unet) : poids safetensors de segmentation et licence CC BY-NC-SA 4.0 déclarée ; piste de recherche à distinguer d'un produit commercial.
- [AmirGenAI/segformer-b0-finetuned-wrinkle](https://huggingface.co/AmirGenAI/segformer-b0-finetuned-wrinkle) : poids et configuration présents, licence `other`, fiche incomplète et métriques d'évaluation annoncées limitées. Ne pas le choisir sur la seule présence d'un checkpoint.

## Première étape concrète recommandée

Évaluer le classifieur binaire rides avant de modifier les résultats utilisateurs :

1. Version candidate : `imfarzanansari/skintelligent-wrinkles`, révision `32ddddd41a7e035bbe3abbe4510e0a0ca4b6fb12`.
2. Charger uniquement les poids safetensors et le prétraitement de cette révision, avec exécution de code distant désactivée.
3. Conserver une sortie séparée « rides / sans rides » avec probabilité de classe. Cette probabilité n'est ni une mesure de sévérité ni une confiance clinique calibrée.
4. Évaluer sur des photos annotées indépendamment, couvrant différentes carnations, lumières et appareils ; vérifier les erreurs et la calibration. Une inférence sur image synthétique ne remplace pas cette évaluation.
5. Adapter le contrat API/web/iOS et les recommandations avant toute activation. Le registre actuel attend des classes associées à des scores d'apparence /100 ; aucun tel mapping validé n'a été trouvé pour ce checkpoint.

Pour les six autres indicateurs, obtenir les éléments manquants des auteurs ou constituer des données annotées adaptées demeure nécessaire. Aucun modèle génératif de texture, classifieur de cancer cutané ou simple modèle de segmentation du visage n'a été retenu comme substitut à ces mesures.
