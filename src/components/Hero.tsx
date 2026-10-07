import { Fragment, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Sparkle, Star, ArrowRight, Mic } from "lucide-react";
import heroVideo from "@/assets/videos/hero.mp4";
import "./Hero.css";

interface Connector {
  id: string;
  title: string;
  tag: string;
  value?: number;
  point: { x: number; y: number };
  end: { x: number; y: number };
  align: "left" | "right";
  range: [number, number];
}

const CONNECTORS: Connector[] = [
  {
    id: "type",
    title: "Combination",
    tag: "Skin type estimate",
    point: { x: 34, y: 27 },
    end: { x: -2, y: 12 },
    align: "left",
    range: [0.08, 0.28],
  },
  {
    id: "texture",
    title: "Texture",
    tag: "Estimated score",
    value: 68,
    point: { x: 68, y: 47 },
    end: { x: 102, y: 44 },
    align: "right",
    range: [0.2, 0.4],
  },
  {
    id: "pigmentation",
    title: "Pigmentation",
    tag: "Your focus area",
    value: 42,
    point: { x: 38, y: 66 },
    end: { x: -2, y: 84 },
    align: "left",
    range: [0.32, 0.52],
  },
];

const ramp = (p: number, [a, b]: [number, number]) =>
  Math.min(1, Math.max(0, (p - a) / (b - a)));

export default function Hero() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const [p, setP] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setP(Math.round(v * 100) / 100));

  return (
    <section id="top" ref={sectionRef} className="hero">
      <div className="hero__glow" />
      <div className="container hero__inner">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="hero__eyebrow"
        >
          <Sparkle size={14} /> AI Skin Analysis
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          Understand your skin.
          <br />
          <span className="hero__accent">Build a routine around it.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="lede hero__lede"
        >
          AI-powered visual skin analysis designed to help you understand visible
          skin characteristics and build a personalized skincare routine.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="hero__actions"
        >
          <Link to="/scan" className="btn btn-primary">
            Start my skin scan <ArrowRight size={16} />
          </Link>
          <a href="#face-scan" className="btn btn-ghost">
            Explore how it works
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="hero__trust"
        >
          <div className="hero__stars">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={15} fill="var(--gold)" stroke="var(--gold)" />
            ))}
          </div>
          <span>Built with dermatologists and cosmetic chemists</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.35 }}
          className="hero__visual"
        >
          <div className="orb-stage">
            <div className="orb-stage__phone">
              <video src={heroVideo} autoPlay loop muted playsInline />
              <div className="faceid" aria-hidden>
                <svg viewBox="0 0 100 100" className="faceid__ticks">
                  <circle cx="50" cy="50" r="48" />
                </svg>
                <div className="faceid__sweep">
                  <svg viewBox="0 0 100 100" className="faceid__ticks faceid__ticks--lit">
                    <circle cx="50" cy="50" r="48" />
                  </svg>
                </div>
              </div>
              <span className="orb-stage__phone-notch" />
              <span className="orb-stage__phone-status">Face scan in progress…</span>
            </div>

            <svg className="orb-stage__lines" viewBox="0 0 100 100" preserveAspectRatio="none">
              {CONNECTORS.map((c) => (
                <line
                  key={c.id}
                  x1={c.point.x}
                  y1={c.point.y}
                  x2={c.end.x}
                  y2={c.end.y}
                  stroke="var(--rose-deep)"
                  strokeWidth={0.3}
                  strokeDasharray="1.4 1.4"
                  style={{ opacity: ramp(p, c.range) }}
                />
              ))}
            </svg>

            {CONNECTORS.map((c) => {
              const o = ramp(p, c.range);
              return (
                <Fragment key={`n-${c.id}`}>
                  <span
                    className="orb-stage__node"
                    style={{ top: `${c.point.y}%`, left: `${c.point.x}%`, opacity: o }}
                  />
                  <div
                    className={`orb-stage__card orb-stage__card--${c.align}`}
                    style={{
                      top: `${c.end.y}%`,
                      left: `${c.end.x}%`,
                      opacity: ramp(p, [c.range[0] + 0.04, c.range[1] + 0.04]),
                      transform: `translate(${c.align === "left" ? "-100%" : "0"}, calc(-50% + ${(1 - o) * 10}px))`,
                    }}
                  >
                    <strong>{c.title}</strong>
                    <span>{c.tag}</span>
                    {c.value !== undefined && (
                      <span className="orb-stage__meter">
                        <span style={{ width: `${c.value}%` }} />
                      </span>
                    )}
                  </div>
                </Fragment>
              );
            })}

            <div className="orb-stage__readout" style={{ opacity: ramp(p, [0.02, 0.12]) }}>
              <span className="orb-stage__readout-title">Analyzing visible indicators</span>
              <span className="orb-stage__readout-bar">
                <span className="orb-stage__readout-fill" />
              </span>
            </div>

            <div className="orb-stage__ask" style={{ opacity: ramp(p, [0.55, 0.7]) }}>
              <span>Ask Smart Skin AI anything…</span>
              <Mic size={16} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
