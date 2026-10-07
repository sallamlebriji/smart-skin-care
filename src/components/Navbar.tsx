import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";
import "./Navbar.css";

const LINKS = [
  { label: "Account", href: "/account" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Face scan", href: "/#face-scan" },
  { label: "Reviews", href: "/#reviews" },
  { label: "FAQ", href: "/#faq" },
];

function Logomark() {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden>
      <rect width="30" height="30" rx="9" fill="var(--ink)" />
      <circle cx="15" cy="15" r="6.5" stroke="var(--rose)" strokeWidth="1.6" />
      <circle cx="15" cy="9.2" r="1.4" fill="var(--lilac)" />
    </svg>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "nav--scrolled" : ""}`}>
      <div className="container nav__inner">
        <Link to="/" className="nav__logo">
          <Logomark />
          Smart Skin Care
        </Link>

        <nav className="nav__links">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </nav>

        <div className="nav__cta">
          <Link to="/scan" className="btn btn-primary btn-sm">
            Start my skin scan
          </Link>
        </div>

        <button className="nav__burger" onClick={() => setOpen((v) => !v)} aria-label="Menu" aria-expanded={open}>
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <div className="nav__mobile">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <Link to="/scan" className="btn btn-primary" onClick={() => setOpen(false)}>
            Start my skin scan
          </Link>
        </div>
      )}
    </header>
  );
}
