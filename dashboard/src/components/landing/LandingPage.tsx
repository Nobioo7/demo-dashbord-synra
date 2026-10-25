"use client";

import { useCallback, useEffect, useState } from "react";
import ChapterDots from "./ChapterDots";
import FAQSection from "./FAQSection";
import Footer from "./Footer";
import FounderSection from "./FounderSection";
import HeroSection from "./HeroSection";
import ManifestoSection from "./ManifestoSection";
import MemorySection from "./MemorySection";
import Nav from "./Nav";
import OneMoreThingSection from "./OneMoreThingSection";
import PricingSection from "./PricingSection";
import ProblemSection from "./ProblemSection";
import SecuritySection from "./SecuritySection";
import SolutionSection from "./SolutionSection";
import Toast from "./Toast";
import VersionsSection from "./VersionsSection";
import WaitlistSection from "./WaitlistSection";

export default function LandingPage() {
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
  }, []);
  const dismissToast = useCallback(() => setToastVisible(false), []);

  useEffect(() => {
    const revealElements = document.querySelectorAll<HTMLElement>(".fade-up, .fade-in, .scale-in, .mask-line");
    const revealObserver = typeof IntersectionObserver === "undefined"
      ? null
      : new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("in");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.15, rootMargin: "0px 0px -80px 0px" },
      );
    if (revealObserver) {
      revealElements.forEach((element) => revealObserver.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add("in"));
    }

    const tiltCards = Array.from(document.querySelectorAll<HTMLElement>(".card-3d"));
    const cardFrames = new Map<HTMLElement, number>();
    const mouseMoves = new Map<HTMLElement, (event: MouseEvent) => void>();
    const mouseLeaves = new Map<HTMLElement, () => void>();
    tiltCards.forEach((card) => {
      const onMouseMove = (event: MouseEvent) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        const rotateY = (x - 0.5) * 14;
        const rotateX = (0.5 - y) * 14;
        card.style.setProperty("--mx", `${x * 100}%`);
        card.style.setProperty("--my", `${y * 100}%`);
        const frame = cardFrames.get(card);
        if (frame) window.cancelAnimationFrame(frame);
        cardFrames.set(
          card,
          window.requestAnimationFrame(() => {
            card.style.transform = `perspective(1400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
          }),
        );
      };
      const onMouseLeave = () => {
        const frame = cardFrames.get(card);
        if (frame) window.cancelAnimationFrame(frame);
        card.style.transform = "perspective(1400px) rotateX(0) rotateY(0) translateZ(0)";
      };
      mouseMoves.set(card, onMouseMove);
      mouseLeaves.set(card, onMouseLeave);
      card.addEventListener("mousemove", onMouseMove);
      card.addEventListener("mouseleave", onMouseLeave);
    });

    const depthPanels = Array.from(document.querySelectorAll<HTMLElement>(".depth-panel"));
    let depthFrame = 0;
    const updateDepth = () => {
      const viewportHeight = window.innerHeight;
      depthPanels.forEach((panel) => {
        const rect = panel.getBoundingClientRect();
        const offset = (rect.top + rect.height / 2 - viewportHeight / 2) / viewportHeight;
        const depth = Number.parseFloat(panel.dataset.depth ?? "0");
        panel.style.transform = `perspective(1400px) translate3d(0, ${offset * depth * 0.15}px, ${offset * depth}px)`;
      });
      depthFrame = 0;
    };
    const scheduleDepth = () => {
      if (!depthFrame) depthFrame = window.requestAnimationFrame(updateDepth);
    };
    if (depthPanels.length) {
      window.addEventListener("scroll", scheduleDepth, { passive: true });
      window.addEventListener("resize", scheduleDepth);
      updateDepth();
    }

    let gResetTimer = 0;
    let gPressed = false;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        gPressed = false;
        window.clearTimeout(gResetTimer);
        return;
      }
      if (event.key.toLowerCase() === "g") {
        gPressed = true;
        window.clearTimeout(gResetTimer);
        gResetTimer = window.setTimeout(() => {
          gPressed = false;
        }, 800);
      } else if (gPressed && event.key.toLowerCase() === "h") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        gPressed = false;
        window.clearTimeout(gResetTimer);
      } else {
        gPressed = false;
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      revealObserver?.disconnect();
      tiltCards.forEach((card) => {
        const onMouseMove = mouseMoves.get(card);
        const onMouseLeave = mouseLeaves.get(card);
        if (onMouseMove) card.removeEventListener("mousemove", onMouseMove);
        if (onMouseLeave) card.removeEventListener("mouseleave", onMouseLeave);
        const frame = cardFrames.get(card);
        if (frame) window.cancelAnimationFrame(frame);
      });
      if (depthFrame) window.cancelAnimationFrame(depthFrame);
      window.removeEventListener("scroll", scheduleDepth);
      window.removeEventListener("resize", scheduleDepth);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(gResetTimer);
    };
  }, []);

  return (
    <main className="site-shell">
      <Nav />
      <ChapterDots />
      <HeroSection />
      <ManifestoSection />
      <ProblemSection />
      <SolutionSection />
      <MemorySection />
      <VersionsSection />
      <SecuritySection />
      <PricingSection />
      <FAQSection />
      <FounderSection />
      <OneMoreThingSection />
      <WaitlistSection showToast={showToast} />
      <Footer />
      <Toast message={toastMessage} visible={toastVisible} onDismiss={dismissToast} />
    </main>
  );
}
