"use client";

import { useEffect, useState } from "react";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 20);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <nav id="nav" className={`fixed inset-x-0 top-0 z-50 ${scrolled ? "scrolled" : ""}`}>
      <div className="mx-auto flex h-12 max-w-[1400px] items-center justify-between px-6 lg:px-12">
        <a href="#hero" className="font-sans text-[15px] font-medium tracking-tight text-[#f5f5f7]">
          Synra
        </a>
        <ul className="hidden items-center gap-9 text-[12px] font-normal text-[#86868b] md:flex">
          <li><a className="transition-colors duration-300 hover:text-[#f5f5f7]" href="#problem">Problem</a></li>
          <li><a className="transition-colors duration-300 hover:text-[#f5f5f7]" href="#solution">Solution</a></li>
          <li><a className="transition-colors duration-300 hover:text-[#f5f5f7]" href="#versions">Versions</a></li>
          <li><a className="transition-colors duration-300 hover:text-[#f5f5f7]" href="#pricing">Pricing</a></li>
          <li><a className="transition-colors duration-300 hover:text-[#f5f5f7]" href="#faq">FAQ</a></li>
        </ul>
        <a href="#waitlist" className="text-[12px] font-normal text-[#f5f5f7] transition-colors duration-300 hover:text-[#86868b]">
          Request Access →
        </a>
      </div>
    </nav>
  );
}
