import { motion } from "framer-motion";
import { ScanFace, ScanSearch, Grid3x3, BrainCircuit, FileText } from "lucide-react";
import "./FaceScanSection.css";

const STEPS = [
  { icon: ScanFace, label: "Capture" },
  { icon: ScanSearch, label: "Face detection" },
  { icon: Grid3x3, label: "Skin mapping" },
  { icon: BrainCircuit, label: "AI analysis" },
  { icon: FileText, label: "Personalized report" },
];

export default function FaceScanSection() {
  return (
    <section id="face-scan" className="section face-scan">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">How the scan works</span>
          <h2>Your face tells a story. Let AI read the visible signs.</h2>
          <p className="lede">
            Five steps turn a few photos into a structured, personalized report —
            entirely from visible signals in the image.
          </p>
        </div>

        <div className="pipeline">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="pipeline__step"
            >
              <span className="pipeline__icon">
                <step.icon size={20} strokeWidth={1.8} />
              </span>
              <span className="pipeline__label">{step.label}</span>
              {i < STEPS.length - 1 && <span className="pipeline__connector" />}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
