import { motion } from "framer-motion";
import faceLeft from "@/assets/photos/face-left.jpg";
import faceRight from "@/assets/photos/face-right.jpg";
import captureVideo from "@/assets/videos/capture.mp4";
import "./deviceFrame.css";
import "./CaptureShowcase.css";

const SPARKLES = [
  { top: "22%", left: "38%", delay: 0 },
  { top: "30%", left: "62%", delay: 0.3 },
  { top: "44%", left: "28%", delay: 0.6 },
  { top: "50%", left: "58%", delay: 0.2 },
  { top: "62%", left: "42%", delay: 0.5 },
  { top: "38%", left: "50%", delay: 0.8 },
];

const SIDE_TAGS = ["Pigmentation", "Texture"];

function SideDevice({ angle, photo }: { angle: "left" | "right"; photo: string }) {
  return (
    <div className={`device device--side device--${angle}`}>
      <div className="device__notch" />
      <div className="device__screen">
        <img className="device__photo" src={photo} alt="" />
        {SPARKLES.map((s, i) => (
          <motion.span
            key={i}
            className="device__sparkle"
            style={{ top: s.top, left: s.left }}
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: s.delay, ease: "easeInOut" }}
          />
        ))}
        <div className="device__tags">
          {SIDE_TAGS.map((t) => (
            <span key={t} className="device__tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CenterDevice() {
  return (
    <div className="device device--center">
      <div className="device__notch" />
      <div className="device__screen device__screen--dark">
        <video className="device__video" src={captureVideo} autoPlay loop muted playsInline />
        <div className="device__center-overlay">
          <div className="device__ring-wrap">
            <motion.div
              className="device__ring"
              animate={{ rotate: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <p className="device__caption">Turn your head slowly to complete the scan</p>
        </div>
      </div>
    </div>
  );
}

export default function CaptureShowcase() {
  return (
    <section className="section capture-showcase">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Guided capture</span>
          <h2>Three angles, one guided scan</h2>
          <p className="lede">
            A short, guided capture — front, left, right — feeds every angle into
            the same analysis engine for a fuller picture.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="capture-showcase__fan"
        >
          <SideDevice angle="left" photo={faceLeft} />
          <CenterDevice />
          <SideDevice angle="right" photo={faceRight} />
        </motion.div>
      </div>
    </section>
  );
}
