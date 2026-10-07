import { motion } from "framer-motion";
import { ScanFace, ShieldCheck, MessageCircleHeart } from "lucide-react";
import "./Pillars.css";

const PILLARS = [
  {
    icon: ScanFace,
    step: "01",
    title: "Scan & track",
    text: "A guided photo capture maps your visible skin indicators and tracks how they change scan after scan.",
    accent: "rose",
  },
  {
    icon: ShieldCheck,
    step: "02",
    title: "Get personalized recommendations",
    text: "Rule-based recommendations, built from your scan — ingredients and habits explained in plain language.",
    accent: "lilac",
  },
  {
    icon: MessageCircleHeart,
    step: "03",
    title: "Ask Smart Skin AI",
    text: "A chat assistant grounded in your own profile and scan history — never inventing results.",
    accent: "mint",
  },
];

export default function Pillars() {
  return (
    <section id="how-it-works" className="section pillars">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>A complete approach to your skin's visible health</h2>
          <p className="lede">
            Set your goals, follow a routine built around your own data, and let
            the AI handle the rest.
          </p>
        </div>

        <div className="pillars__grid">
          {PILLARS.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`pillar-card pillar-card--${p.accent}`}
            >
              <span className="pillar-card__step">{p.step}</span>
              <span className="pillar-card__icon">
                <p.icon size={26} strokeWidth={1.8} />
              </span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
