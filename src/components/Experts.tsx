import { motion } from "framer-motion";
import expert1 from "@/assets/photos/expert-1.jpg";
import expert2 from "@/assets/photos/expert-2.jpg";
import expert3 from "@/assets/photos/expert-3.jpg";
import expert4 from "@/assets/photos/expert-4.jpg";
import "./Experts.css";

const EXPERTS = [
  { name: "Dr. Nadia K.", role: "Medical director, cosmetic chemist", photo: expert1 },
  { name: "Dr. Aisha S.", role: "Aesthetic dermatologist, medical board", photo: expert2 },
  { name: "Dr. Sofia P.", role: "Anti-aging & longevity medicine", photo: expert3 },
  { name: "Elina N.", role: "Dermatology diagnostics consultant", photo: expert4 },
];

export default function Experts() {
  return (
    <section className="section experts">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Scientifically grounded</span>
          <h2>Built with healthcare professionals</h2>
          <p className="lede">
            Every recommendation is designed around scientific evidence and
            reviewed by a board of dermatologists, cosmetic chemists and
            estheticians.
          </p>
        </div>

        <div className="experts__grid">
          {EXPERTS.map((e, i) => (
            <motion.div
              key={e.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="expert-card"
            >
              <img className="expert-card__avatar" src={e.photo} alt={e.name} />
              <strong>{e.name}</strong>
              <p>{e.role}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
