import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Mic } from "lucide-react";
import userPhoto from "@/assets/photos/avatar-1.jpg";
import "./ChatDemo.css";

const QUICK_REPLIES = [
  "How can I improve my evening routine?",
  "What's the top 3 SPFs for my skin?",
  "Does this product fit my routine?",
];

const MOOD_LABELS = ["Not good", "It's fine", "Great"];

function BotAvatar() {
  return (
    <span className="bubble-avatar bubble-avatar--bot">
      <Sparkles size={14} />
    </span>
  );
}

function UserAvatar() {
  return <img className="bubble-avatar bubble-avatar--photo" src={userPhoto} alt="" />;
}

function MoodSlider() {
  const [value, setValue] = useState(50);
  const labelIndex = value < 34 ? 0 : value < 67 ? 1 : 2;

  return (
    <div className="bubble bubble--bot bubble--mood">
      <BotAvatar />
      <div className="bubble__content">
        <p>How does your skin feel today?</p>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="mood-slider"
          aria-label="How does your skin feel today?"
        />
        <div className="mood-slider__labels">
          {MOOD_LABELS.map((l, i) => (
            <span key={l} className={i === labelIndex ? "is-active" : ""}>
              {l}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ChatDemo() {
  return (
    <section className="section chat-demo">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">AI assistant, 24/7</span>
          <h2>Smart Skin AI, right in your pocket</h2>
          <p className="lede">
            A question about an ingredient, a routine, or a product? Get a
            grounded answer, any time — built on your own profile.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="chat-window"
        >
          <div className="chat-window__header">
            <span className="chat-window__avatar">
              <Sparkles size={16} />
            </span>
            <div>
              <strong>Smart Skin AI</strong>
              <p>Online · replies in seconds</p>
            </div>
          </div>

          <div className="chat-window__body">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0 }}
              className="bubble bubble--bot"
            >
              <BotAvatar />
              <div className="bubble__content">
                <p>
                  Hi! I'm your Smart Skin AI assistant, ready to help with
                  anything skincare-related.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <MoodSlider />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.4 }}
              className="bubble bubble--user"
            >
              <div className="bubble__content">
                <p>How can I improve my evening routine?</p>
              </div>
              <UserAvatar />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.6 }}
              className="bubble bubble--bot"
            >
              <BotAvatar />
              <div className="bubble__content bubble__content--rich">
                <p>
                  UV index is high today ☀️ — don't forget SPF. Also, consider
                  adding a retinol serum to slow the visible signs of aging.
                  Based on your last scan and current routine:
                </p>
                <div className="bubble__products">
                  <div className="bubble__product">
                    <span>Retinol Serum 0.5% in Squalane</span>
                    <strong>92% match</strong>
                  </div>
                  <div className="bubble__product">
                    <span>Crystal Retinal Night 6</span>
                    <strong>89% match</strong>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="chat-window__quick">
            {QUICK_REPLIES.map((q) => (
              <span key={q} className="chat-window__chip">
                {q}
              </span>
            ))}
          </div>

          <div className="chat-window__input">
            <span>Ask Smart Skin AI anything…</span>
            <Mic size={17} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
