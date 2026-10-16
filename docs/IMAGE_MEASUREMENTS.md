# Image measurements and actual model outputs

The web scan report no longer shows fabricated per-indicator numbers. The previous fallback used a SHA-256-derived illustrative number; that generator has been removed. Unavailable models produce no numeric entry in new API results. Old saved placeholder values are hidden. Re-run an old scan to obtain current model provenance; photos are not altered.

## Trained inference

The acne checkpoint returns a class and its probability. The prior “96/100” was a manually assigned appearance index for `level -1`, **not 96% of healthy skin and not a calibrated medical measurement**. Legacy numerical indices remain for API compatibility and existing routines; the updated web report shows the actual predicted class instead.

The wrinkle checkpoint predicts `wrinkle` versus `non-wrinkle`. Its predicted-class probability is reported separately, without converting it to a mild/moderate/marked severity score. Both models are community checkpoints without independent clinical validation established here. A high probability does not establish correctness for a particular person.

Sources: [acne model](https://huggingface.co/imfarzanansari/skintelligent-acne), [wrinkle model](https://huggingface.co/imfarzanansari/skintelligent-wrinkles). Source revisions are pinned in the backend and returned with predictions. No uploaded image is sent to Hugging Face; checkpoints run locally on the backend.

## Quantities calculated from the photo

The browser detects the face and intersects forehead, cheek, nose and chin polygons with MediaPipe's `face-skin` class. Explicit eye, eyebrow and lip landmark contours are removed, along with a small boundary margin. Hair and background classes are excluded. The image is resized to at most 512 pixels on its longest dimension, without upscaling. The model runs locally using the repository's MediaPipe/WASM assets; these calculations do not upload another copy to a third party.

Source: [Google MediaPipe image segmenter documentation](https://developers.google.com/edge/mediapipe/solutions/vision/image_segmenter), which defines the six-class mask and face-skin category 3. Segmentation is approximate and may make mistakes, particularly with occlusions, facial hair or unusual lighting.

The canvas is treated as sRGB and converted to CIE 1976 L*a*b* using the D65 reference white (not CSS `lab()`'s D50 white). See the [W3C color conversion reference](https://www.w3.org/TR/css-color-4/#color-conversion-code) for the sRGB/XYZ/Lab conversion concepts.

| Displayed quantity | Definition | Interpretation limits |
| --- | --- | --- |
| Mean lightness | Mean L* | Brightness of sampled image pixels, not a skin-health score. |
| Mean red–green component | Mean a* | Image color coordinate, not diagnosed redness or inflammation. |
| Mean yellow–blue component | Mean b* | Image color coordinate, not a melanin measurement. |
| Lightness variation | Population standard deviation of L* | Image nonuniformity; includes shadows and illumination. |
| Color dispersion | Root mean squared ΔE*ab from the mean Lab color | Spread of pixel colors, not pigmentation severity. |
| Fine image contrast | Population standard deviation of the four-neighbor Laplacian of L* | Image contrast at the processed resolution, not physical roughness, pore size or scar depth. |

Only opaque pixels with every digital RGB channel between 3 and 252 are accepted. Fewer than 256 accepted pixels or more than 25% rejected pixels yields an explicit unavailable result, not zero. These are engineering sampling/clipping checks, not clinically validated quality thresholds. Texture requires at least 64 pixels whose four neighbors also belong to accepted skin; otherwise only that quantity is unavailable. The panel reports counts, excluded fraction and processing resolution.

There are no invented 0–100 grades, good/bad cutoffs or mild/moderate/marked labels for these image statistics. Lighting, white balance, camera processing, makeup, pose, zoom, filters and JPEG compression can change them without any biological change. Use consistent capture conditions; physically calibrated skin measurements require an appropriate measurement protocol and equipment.

## Storage and compatibility

Pixel measurements are recalculated locally when opening the web report. They are not written into scan metadata or used to generate treatment recommendations. Existing photos remain account-protected. The image loader includes account cookies to retrieve private stored captures.

`analysis_version: 2` results add `model_assessments` and `unavailable_metrics`. `metrics` contains only available numerical model indices. Native clients already consume this dictionary sparsely; the previously built APK retains its older display wording. The new pixel-measurement panel is currently a web feature.

## Verification

Run `npm test` with Node 22, `npm run build`, and the backend test suite. Numerical tests use known sRGB/Lab reference colors and verify zero variation for a uniform image, sensitivity to pixel changes, background/edge isolation, and explicit failures for missing/clipped samples. Backend tests verify absent models never generate numbers, class probabilities/provenance are preserved and an optional wrinkle-model failure cannot fabricate a result.
