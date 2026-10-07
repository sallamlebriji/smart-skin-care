import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";
import "./Faq.css";

const QUESTIONS = [
  {
    q: "What is Smart Skin Care?",
    a: "Smart Skin Care is an AI-powered visual skin analysis platform. It combines a cosmetics scanner, a guided face scan reviewed by a medical board, and an AI chat assistant to guide you day to day, with personalized routines and recommendations.",
  },
  {
    q: "Is this a medical diagnosis?",
    a: "No. Smart Skin Care produces a visual skincare assessment based on camera images — it is not a medical diagnosis and cannot detect diseases or conditions. See a healthcare professional for anything that concerns you.",
  },
  {
    q: "Are you affiliated with any brands?",
    a: "No. Smart Skin Care is fully independent. We prioritize ingredient science over brand reputation, basing recommendations on actual product composition.",
  },
  {
    q: "How does your scoring methodology work?",
    a: "Our evaluation cross-references international standards with input from dermatologists, chemists and estheticians, to produce a clear, transparent score adapted to your visible skin profile.",
  },
  {
    q: "What happens to my photos?",
    a: "Your scan images are private by default, deletable at any time, and are never used to train models without your explicit consent. See our privacy policy for full detail.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="section faq">
      <div className="container faq__inner">
        <div className="section-head left">
          <span className="eyebrow">FAQ</span>
          <h2>Questions? We've got answers.</h2>
        </div>

        <div className="faq__list">
          {QUESTIONS.map((item, i) => (
            <div key={item.q} className={`faq-item ${open === i ? "is-open" : ""}`}>
              <button className="faq-item__head" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{item.q}</span>
                <motion.span
                  animate={{ rotate: open === i ? 45 : 0 }}
                  transition={{ duration: 0.25 }}
                  className="faq-item__icon"
                >
                  <Plus size={18} />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="faq-item__body"
                  >
                    <p>{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
