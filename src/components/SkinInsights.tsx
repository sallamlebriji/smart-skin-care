import { motion } from "framer-motion";
import snapshotA from "@/assets/photos/avatar-2.jpg";
import snapshotB from "@/assets/photos/avatar-5.jpg";
import "./SkinInsights.css";

const SNAPSHOT_PHOTOS: Record<string, string> = { Apr: snapshotA, Jul: snapshotB };

const ISSUES: { label: string; color: string }[] = [
  { label: "Redness", color: "#e8635f" },
  { label: "Post-acne marks", color: "#9a9299" },
  { label: "Wrinkles", color: "#3fb6c9" },
  { label: "Inflammatory acne", color: "#e0524f" },
  { label: "Visible pores", color: "#3fb98a" },
  { label: "Whiteheads", color: "#e0b93f" },
  { label: "Moles", color: "#8c7fe0" },
  { label: "Freckles", color: "#c97fd6" },
  { label: "Pigmentation", color: "#e07fb0" },
  { label: "Scars", color: "#e0973f" },
  { label: "Texture", color: "#6f9fe0" },
];

const TIMELINE = [
  { month: "Jan", pin: false, snapshot: false },
  { month: "Feb", pin: true, snapshot: false },
  { month: "Mar", pin: false, snapshot: false },
  { month: "Apr", pin: true, snapshot: true },
  { month: "May", pin: false, snapshot: false },
  { month: "Jun", pin: false, snapshot: false },
  { month: "Jul", pin: true, snapshot: true },
  { month: "Aug", pin: false, snapshot: false },
  { month: "Sep", pin: true, snapshot: false },
];

function IssuesCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="insight-card"
    >
      <h3>See the condition of 11+ skin indicators</h3>
      <div className="issue-grid">
        {ISSUES.map((issue, i) => (
          <motion.div
            key={issue.label}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className="issue-tile"
          >
            <motion.span
              className="issue-tile__dot"
              style={{ background: issue.color }}
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            />
            {issue.label}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function TimelineCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="insight-card"
    >
      <h3>Track how your skin changes over time</h3>
      <div className="timeline">
        <motion.span
          className="timeline__axis"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
        {TIMELINE.map((t, i) => (
          <div key={t.month} className="timeline__stop">
            {t.snapshot && (
              <motion.span
                className="timeline__snapshot"
                initial={{ opacity: 0, scale: 0.6, y: 8 }}
                whileInView={{ opacity: 1, scale: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: 0.4 + i * 0.08, type: "spring", stiffness: 220, damping: 16 }}
              >
                <img src={SNAPSHOT_PHOTOS[t.month]} alt="" />
              </motion.span>
            )}
            {t.pin && !t.snapshot && (
              <motion.span
                className="timeline__pin"
                initial={{ opacity: 0, y: -6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
              />
            )}
            <span className={`timeline__tick ${t.snapshot ? "is-marked" : ""}`} />
            <span className="timeline__label">{t.month}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function SkinInsights() {
  return (
    <section className="section skin-insights">
      <div className="container skin-insights__grid">
        <IssuesCard />
        <TimelineCard />
      </div>
    </section>
  );
}
