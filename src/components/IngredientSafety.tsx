import { motion } from "framer-motion";
import { Check, ScanLine, Award, TrendingUp, Wallet } from "lucide-react";
import "./IngredientSafety.css";

const BADGES = ["Generally well tolerated", "Non-allergenic", "Non-carcinogenic"];

const PRODUCTS = [
  {
    tag: "Expert pick",
    icon: Award,
    name: "GlowLab AHA 30% + BHA 2%",
    desc: "Intensive exfoliating solution",
    fit: "96% match",
  },
  {
    tag: "Top rated",
    icon: TrendingUp,
    name: "SunShield Melt-In SPF 30",
    desc: "Melt-in sun milk",
    fit: "93% match",
  },
  {
    tag: "Best value",
    icon: Wallet,
    name: "AquaBalance Electrolytes",
    desc: "Moisturizer, from $20",
    fit: "90% match",
  },
];

export default function IngredientSafety() {
  return (
    <section className="section ingredient">
      <div className="container ingredient__inner">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55 }}
          className="ingredient__text"
        >
          <span className="eyebrow">No brand affiliation</span>
          <h2>Check your ingredients with a single scan</h2>
          <p className="lede">
            No barcode hunting. Photograph a product and get an instant
            compatibility score, with no commercial bias.
          </p>

          <div className="ingredient-card">
            <div className="ingredient-card__head">
              <span className="ingredient-card__icon">
                <ScanLine size={20} />
              </span>
              <div>
                <h4>Squalane</h4>
                <p>Plant-derived emollient and moisturizer</p>
              </div>
            </div>
            <div className="ingredient-card__badges">
              {BADGES.map((b) => (
                <span key={b} className="ingredient-card__badge">
                  <Check size={13} strokeWidth={3} /> {b}
                </span>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, delay: 0.1 }}
          className="ingredient__products"
        >
          {PRODUCTS.map((p) => (
            <div key={p.name} className="product-card">
              <span className="product-card__tag">
                <p.icon size={13} /> {p.tag}
              </span>
              <h4>{p.name}</h4>
              <p>{p.desc}</p>
              <span className="product-card__fit">{p.fit}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
