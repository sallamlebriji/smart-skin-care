import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ScanFace, ArrowRight } from "lucide-react";
import { SAFETY_DISCLAIMER } from "@/content/safety";
import "./CtaBanner.css";

export default function CtaBanner() {
  return (
    <section id="cta" className="section cta">
      <div className="container">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="cta__card"
        >
          <ScanFace size={30} className="cta__icon" />
          <h2>
            Ready to understand
            <br />
            your skin?
          </h2>
          <p className="lede" style={{ marginTop: 16, marginBottom: 32 }}>
            Your first scan takes about two minutes.
          </p>

          <Link to="/scan" className="btn btn-primary cta__btn">
            Start my skin scan <ArrowRight size={17} />
          </Link>

          <p className="cta__disclaimer">{SAFETY_DISCLAIMER}</p>
        </motion.div>
      </div>
    </section>
  );
}
