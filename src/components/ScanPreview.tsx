import { motion } from "framer-motion";
import { Mic } from "lucide-react";
import heroPortrait from "@/assets/photos/hero-portrait.jpg";
import "./ScanPreview.css";

const POINTS = [
  { top: "18%", left: "42%", delay: 0 },
  { top: "24%", left: "58%", delay: 0.4 },
  { top: "34%", left: "36%", delay: 0.8 },
  { top: "30%", left: "63%", delay: 1.2 },
  { top: "44%", left: "48%", delay: 1.6 },
];

export default function ScanPreview() {
  return (
    <section className="section scan-preview">
      <div className="container scan-preview__inner">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="scan-preview__stage"
        >
          <img
            src={heroPortrait}
            alt=""
            className="scan-preview__photo"
          />

          {POINTS.map((p, i) => (
            <motion.span
              key={i}
              className="scan-preview__point"
              style={{ top: p.top, left: p.left }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.1, 0.7] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
            />
          ))}

          <div className="scan-preview__frame">
            <div className="scan-preview__notch" />
            <motion.span
              className="scan-preview__sweep"
              animate={{ top: ["10%", "88%", "10%"] }}
              transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            />
            <p className="scan-preview__status">
              Face scan
              <br />
              in progress…
            </p>
            <div className="scan-preview__ask">
              <span>Ask Smart Skin AI anything…</span>
              <Mic size={16} />
            </div>
          </div>
        </motion.div>

        <div className="section-head scan-preview__copy">
          <span className="eyebrow">Live preview</span>
          <h2>Your scan, visualized in real time</h2>
          <p className="lede">
            As the guided capture runs, Smart Skin Care maps visible landmarks
            live — so you always know what's being analyzed, and why.
          </p>
        </div>
      </div>
    </section>
  );
}
