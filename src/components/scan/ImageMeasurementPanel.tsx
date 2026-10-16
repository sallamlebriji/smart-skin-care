import type { ImageMeasurements } from "@/lib/imageMeasurements";

export default function ImageMeasurementPanel({ value }: { value: ImageMeasurements }) {
  const rows = [
    ["Luminosité moyenne", value.meanL.toFixed(2), "L*"],
    ["Composante rouge–verte moyenne", value.meanA.toFixed(2), "a*"],
    ["Composante jaune–bleue moyenne", value.meanB.toFixed(2), "b*"],
    ["Variation de luminosité", value.lightnessStd.toFixed(2), "écart-type L*"],
    ["Dispersion des couleurs", value.colorSpread.toFixed(2), "ΔE*ab RMS"],
    ["Contraste fin de l’image", value.laplacianStd?.toFixed(2) ?? "Indisponible", "écart-type du Laplacien de L*"],
  ];
  return <section className="workspace-card" aria-label="Mesures calculées sur la photo">
    <h2>Mesures calculées sur la photo</h2>
    <p>Calculs sur {value.sampleCount.toLocaleString("fr-FR")} pixels classés « peau du visage » dans le front, les joues, le nez et le menton. Les yeux, les lèvres, les cheveux et le fond sont exclus par les modèles de repérage et de segmentation.</p>
    <dl style={{ margin: "16px 0", display: "grid", gap: 12 }}>{rows.map(([label, value, unit]) => <div key={label} style={{ borderBottom: "1px solid var(--line)", paddingBottom: 10 }}>
      <dt style={{ fontWeight: 600 }}>{label}</dt><dd style={{ margin: "4px 0 0", color: "var(--ink-soft)" }}><strong>{value}</strong> <small>{unit}</small></dd>
    </div>)}</dl>
    <p><strong>Ces valeurs décrivent les pixels de l’image.</strong> a* n’est pas une mesure d’inflammation ; ΔE n’est pas une mesure de mélanine ; le contraste fin n’est pas une mesure des pores ou des cicatrices. Aucune classe « légère / modérée / marquée » n’est déduite de ces calculs.</p>
    <small>Repérage : MediaPipe Face Landmarker · segmentation : Selfie Multiclass (peau du visage). Hypothèse sRGB, espace CIE L*a*b* D65 · image de calcul {value.width} × {value.height} px · pixels écartés : {(value.clippedFraction * 100).toFixed(1)} %. L’éclairage, la balance des blancs, le zoom, les filtres et la compression influencent les valeurs. Gardez les mêmes conditions pour comparer. Recalcul local à l’ouverture du rapport, sans envoi à un service tiers.</small>
  </section>;
}
