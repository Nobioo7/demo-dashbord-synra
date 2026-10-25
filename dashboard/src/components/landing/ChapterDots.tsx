"use client";

import { useEffect, useState } from "react";

const chapters = ["hero", "problem", "solution", "versions", "security", "pricing", "faq", "founder", "waitlist"];

export default function ChapterDots() {
  const [active, setActive] = useState("hero");

  useEffect(() => {
    const chapterIds = new Set(chapters);
    const sections = Array.from(document.querySelectorAll<HTMLElement>("section[id]"))
      .filter((section) => chapterIds.has(section.id));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="chapter" aria-label="Page chapters">
      {chapters.map((id) => (
        <a
          key={id}
          href={`#${id}`}
          className={`chapter-dot${active === id ? " active" : ""}`}
          aria-label={`Scroll to ${id}`}
          aria-current={active === id ? "location" : undefined}
        />
      ))}
    </div>
  );
}
