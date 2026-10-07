import { Link } from "react-router-dom";
import "./Footer.css";

const IconInstagram = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
  </svg>
);

const IconLinkedin = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <line x1="7.5" y1="10.5" x2="7.5" y2="16.5" />
    <circle cx="7.5" cy="7.2" r="0.9" fill="currentColor" stroke="none" />
    <path d="M11.5 16.5v-3.6c0-1.5 1-2.4 2.3-2.4 1.3 0 2.2.9 2.2 2.4v3.6" />
  </svg>
);

const IconTikTok = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
    <path d="M14 4v10.2a3 3 0 1 1-2.6-3v-2a5 5 0 1 0 4.6 5V9.4a6 6 0 0 0 3.5 1.1V8.3a3.6 3.6 0 0 1-2.6-1.1A3.7 3.7 0 0 1 16 4h-2Z" />
  </svg>
);

function Logomark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="9" fill="var(--ink)" />
      <circle cx="15" cy="15" r="6.5" stroke="var(--rose)" strokeWidth="1.6" />
      <circle cx="15" cy="9.2" r="1.4" fill="var(--lilac)" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__brand">
          <Link to="/" className="nav__logo footer__logo">
            <Logomark />
            Smart Skin Care
          </Link>
          <p>
            AI-powered visual skin analysis, designed to feel like self-care.
            Follow along on{" "}
            <a href="#" aria-label="Instagram">
              Instagram
            </a>
            ,{" "}
            <a href="#" aria-label="LinkedIn">
              LinkedIn
            </a>{" "}
            and{" "}
            <a href="#" aria-label="TikTok">
              TikTok
            </a>
            .
          </p>
          <div className="footer__socials">
            <a href="#" aria-label="Instagram">
              <IconInstagram />
            </a>
            <a href="#" aria-label="LinkedIn">
              <IconLinkedin />
            </a>
            <a href="#" aria-label="TikTok">
              <IconTikTok />
            </a>
          </div>
        </div>

        <div className="footer__cols">
          <div className="footer__col">
            <h5>Product</h5>
            <a href="/#how-it-works">How it works</a>
            <a href="/#face-scan">Face scan</a>
            <Link to="/scan">Start a scan</Link>
            <a href="/#faq">FAQ</a>
          </div>
          <div className="footer__col">
            <h5>Company</h5>
            <a href="#">Careers</a>
            <a href="#">Privacy policy</a>
            <a href="#">Refund policy</a>
            <a href="#">Terms of use</a>
          </div>
        </div>
      </div>

      <div className="container footer__bottom">
        <span>© 2026 Smart Skin Care</span>
        <span>This analysis is a visual skincare assessment, not a medical diagnosis.</span>
      </div>
    </footer>
  );
}
