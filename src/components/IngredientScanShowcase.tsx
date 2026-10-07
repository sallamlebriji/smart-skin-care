import { motion } from "framer-motion";
import { Image, ScanLine } from "lucide-react";
import productPhoto from "@/assets/photos/product.jpg";
import "./deviceFrame.css";
import "./IngredientScanShowcase.css";

const BADGES = [
  "INCI verified",
  "EU regulation check",
  "Cruelty-free lookup",
  "Dermatologist reviewed",
  "Fragrance-free flag",
  "Allergen screening",
  "Ingredient science",
  "No sponsored results",
];

export default function IngredientScanShowcase() {
  const track = [...BADGES, ...BADGES];

  return (
    <section className="section ingredient-scan">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="ingredient-scan__stage"
        >
          <div className="ingredient-scan__marquee">
            <div className="ingredient-scan__track">
              {track.map((b, i) => (
                <span key={i} className="ingredient-scan__badge">
                  {b}
                </span>
              ))}
            </div>
          </div>

          <div className="device device--scan">
            <div className="device__notch" />
            <div className="device__screen device__screen--dark">
              <span className="device__scan-wordmark">Smart Skin Care</span>
              <div className="device__scan-frame">
                <motion.span
                  className="device__scan-line"
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
                />
                <img className="device__product-photo" src={productPhoto} alt="" />
              </div>
              <div className="device__scan-controls">
                <span className="device__scan-icon">
                  <Image size={15} />
                </span>
                <span className="device__shutter" />
                <span className="device__scan-icon device__scan-icon--ghost">
                  <ScanLine size={15} />
                </span>
              </div>
            </div>
          </div>

          <p className="ingredient-scan__caption">
            Check any product's fit
            <br />
            with zero brand bias
          </p>
        </motion.div>
      </div>
    </section>
  );
}
