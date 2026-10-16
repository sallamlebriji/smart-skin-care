import type { SkinScanResult, SkinMetrics } from "@/types/skin";

const METRIC_LABEL: Record<keyof SkinMetrics, string> = {
  acne: "Acné", redness: "Rougeurs", pigmentation: "Pigmentation", pores: "Pores",
  texture: "Texture cutanée", wrinkles: "Rides", scars: "Cicatrices", uniformity: "Uniformité cutanée",
};
const CLASS_LABEL: Record<string, string> = {
  "level -1": "Peau sans acné apparente", "level 0": "Boutons occasionnels", "level 1": "Acné légère",
  "level 2": "Acné modérée", "level 3": "Acné marquée", wrinkle: "Rides détectées", "non-wrinkle": "Rides non détectées",
};

/** Only actual predictions are shown. Old illustrative scores never reappear from saved scans. */
export default function ScanResultPanel({ result }: { result: SkinScanResult }) {
  const assessments = Object.entries(result.model_assessments ?? {}) as [keyof SkinMetrics, NonNullable<SkinScanResult["model_assessments"]>[keyof SkinMetrics]][];
  const unavailable = (result.unavailable_metrics ?? result.mock_metrics).filter(key => !result.model_assessments?.[key]);
  const configured = Object.entries(result.metrics).filter(([key, value]) => result.analysis_version === 2 && Number.isFinite(value) && !result.mock_metrics.includes(key as keyof SkinMetrics) && !result.model_assessments?.[key as keyof SkinMetrics]);
  return <section style={{ borderRadius: "var(--radius-xl)", border: "1px solid var(--line)", background: "#fff", padding: 20 }} aria-label="Sorties réelles des modèles">
    <h2 style={{ fontSize: 17, marginBottom: 12 }}>Résultats des modèles</h2>
    <p style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 16 }}>Prédictions calculées sur la photo, avec leur source. Une probabilité de classe n’est ni une mesure de surface ni une sévérité en pourcentage.</p>
    {result.analysis_version !== 2 && <p role="status">Ancien rapport : relancez l’analyse pour obtenir les classes prédites et leurs probabilités. Les anciennes notes illustratives sont masquées.</p>}
    <div style={{ display: "grid", gap: 18 }}>{assessments.map(([key, value]) => value && <div key={key}>
      <h3 style={{ fontSize: 15 }}>{METRIC_LABEL[key]}</h3>
      <p style={{ fontWeight: 600 }}>{CLASS_LABEL[value.label] ?? value.label}</p>
      <p>Probabilité de cette classe : {(value.probability * 100).toFixed(1)} %</p>
      <small>Modèle : {value.source} · révision {value.revision.slice(0, 7)} · expérimental</small>
      {key === "wrinkles" && <p><small>Détection de présence uniquement : aucune estimation légère / modérée / marquée.</small></p>}
    </div>)}</div>
    {configured.map(([key, value]) => <p key={key}>{METRIC_LABEL[key as keyof SkinMetrics]} : indice de modèle {value?.toFixed(1)}/100 (pas une mesure physique).</p>)}
    {!!unavailable.length && <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
      <h3 style={{ fontSize: 14 }}>Mesures spécialisées indisponibles</h3>
      <p>{unavailable.map(key => METRIC_LABEL[key]).join(" · ")}</p>
      <small>Aucun résultat spécialisé exploitable n’est disponible pour ces mesures. Aucun chiffre n’est inventé. Les statistiques de couleur et de contraste de la photo sont présentées séparément.</small>
    </div>}
    <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 16 }}>Ces modèles communautaires n’ont pas été validés cliniquement ici. Leurs probabilités ne sont pas une confiance clinique calibrée. Ce rapport n’est pas un diagnostic.</p>
  </section>;
}
