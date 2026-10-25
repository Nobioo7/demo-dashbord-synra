"use client";

import { useEffect, useState } from "react";

const links = [
  { label: "Benefits", href: "#problem" },
  { label: "How it works", href: "#solution" },
  { label: "FAQs", href: "#faq" },
  { label: "Pricing", href: "#pricing" },
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      document.body.classList.remove("menu-open");
      return;
    }

    document.body.classList.add("menu-open");
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMenuOpen(false);
    };
    const desktopQuery = window.matchMedia("(min-width: 901px)");
    document.addEventListener("keydown", closeOnEscape);
    desktopQuery.addEventListener("change", closeOnDesktop);
    return () => {
      document.body.classList.remove("menu-open");
      document.removeEventListener("keydown", closeOnEscape);
      desktopQuery.removeEventListener("change", closeOnDesktop);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="menu-backdrop"
        aria-label="Close navigation"
        tabIndex={menuOpen ? 0 : -1}
        onClick={closeMenu}
      />
      <header id="nav" className={`landing-header${scrolled ? " scrolled" : ""}`}>
        <a href="#hero" className="landing-brand" aria-label="Synra home" onClick={closeMenu}>
          <svg className="landing-brand-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <g transform="rotate(-30 12 12)">
              <circle cx="7.3" cy="3.2" r="1.45" />
              <rect x="5.5" y="4.7" width="3.6" height="14.6" rx="1.8" />
              <rect x="14.9" y="4.7" width="3.6" height="14.6" rx="1.8" />
              <circle cx="16.7" cy="20.8" r="1.45" />
            </g>
          </svg>
          <span>Synra<span className="landing-brand-suffix">.ai</span></span>
        </a>
        <nav id="site-nav" className="landing-nav" aria-label="Primary">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>
          ))}
        </nav>
        <a href="#waitlist" className="landing-header-cta liquid-button" onClick={closeMenu}>
          Request access
        </a>
        <button
          type="button"
          className="landing-menu-toggle"
          aria-controls="site-nav"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="landing-menu-bars" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </header>
    </>
  );
}
