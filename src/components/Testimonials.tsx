import { motion } from "framer-motion";
import { Star, BadgeCheck } from "lucide-react";
import avatar1 from "@/assets/photos/avatar-1.jpg";
import avatar2 from "@/assets/photos/avatar-2.jpg";
import avatar3 from "@/assets/photos/avatar-3.jpg";
import avatar4 from "@/assets/photos/avatar-4.jpg";
import avatar5 from "@/assets/photos/avatar-5.jpg";
import avatar6 from "@/assets/photos/avatar-6.jpg";
import "./Testimonials.css";

const REVIEWS = [
  {
    name: "Melissa P.",
    role: "UX Research",
    text: "The recommendations fit me perfectly, and didn't cost a fortune. Genuinely useful.",
    photo: avatar1,
  },
  {
    name: "Marion D.",
    role: "App Store",
    text: "My pores look visibly cleaner and the scan shows a lot less redness across my face.",
    verified: true,
    photo: avatar2,
  },
  {
    name: "Tracy K.",
    role: "Verified",
    text: "I didn't expect this level of tech. No more paying for an in-person consultation just to get a read on my skin.",
    verified: true,
    photo: avatar3,
  },
  {
    name: "Chelsey J.",
    role: "UX Research",
    text: "An app that nudges you toward self-care without chasing perfection. A refreshing approach.",
    photo: avatar4,
  },
  {
    name: "Kate K.",
    role: "Diary Research",
    text: "I love the guided tutorials, like the facial massage walkthrough. The scan itself was genuinely informative.",
    photo: avatar5,
  },
  {
    name: "Kate R.",
    role: "Verified",
    text: "I no longer spend hours researching what to buy, and the tracking kept me consistent during the adjustment phase.",
    verified: true,
    photo: avatar6,
  },
];

export default function Testimonials() {
  return (
    <section id="reviews" className="section testimonials">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">Trusted by our users</span>
          <h2>Loved by beginners and skincare enthusiasts alike</h2>
        </div>

        <div className="testimonials__grid">
          {REVIEWS.map((r, i) => (
            <motion.div
              key={r.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.1 }}
              className="review-card"
            >
              <div className="review-card__stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <Star key={s} size={13} fill="var(--gold)" stroke="var(--gold)" />
                ))}
              </div>
              <p>&ldquo;{r.text}&rdquo;</p>
              <div className="review-card__author">
                <img className="review-card__avatar" src={r.photo} alt="" />
                <div>
                  <strong>
                    {r.name} {r.verified && <BadgeCheck size={13} color="var(--mint)" />}
                  </strong>
                  <span>{r.role}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
