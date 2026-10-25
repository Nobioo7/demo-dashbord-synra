export default function HeroSection() {
  return (
    <div className="content-layer landing-stage">
      <section id="hero" className="content-layer landing-hero">
        <div className="landing-hero-content">
          <p className="landing-badge fade-in d1">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.6c.55 0 .88.55 1.08 2.1.62 4.7 1.52 5.6 6.22 6.22 1.55.2 2.1.53 2.1 1.08s-.55.88-2.1 1.08c-4.7.62-5.6 1.52-6.22 6.22-.2 1.55-.53 2.1-1.08 2.1s-.88-.55-1.08-2.1c-.62-4.7-1.52-5.6-6.22-6.22C3.15 12.88 2.6 12.55 2.6 12s.55-.88 2.1-1.08c4.7-.62 5.6-1.52 6.22-6.22.2-1.55.53-2.1 1.08-2.1Z" />
            </svg>
            The AI engineering brain
          </p>
          <h1>
            <span className="mask-line d2"><span>AI writes code.</span></span>
            <span className="mask-line d3"><span>Synra <em>remembers.</em></span></span>
          </h1>
          <p className="landing-hero-copy fade-up d4">
            A persistent, evidence-backed memory layer that gives every AI coding tool a shared understanding of how
            your company builds software.
          </p>
          <div className="landing-hero-actions fade-up d5">
            <a href="#waitlist" className="liquid-button">Request early access</a>
            <a href="#solution" className="liquid-button liquid-button-ghost">See how it works</a>
          </div>
        </div>
      </section>
      <footer className="landing-stats content-layer" aria-label="Synra capabilities">
        <span className="landing-stat">
          <span className="landing-stat-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M5 5h5v5H5zM14 14h5v5h-5zM10 7.5h4a2 2 0 0 1 2 2V14" />
            </svg>
          </span>
          Persistent memory across tools
        </span>
        <span className="landing-stat">
          <span className="landing-stat-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3 5 6v5c0 4.5 2.8 7.8 7 10 4.2-2.2 7-5.5 7-10V6l-7-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          Evidence-backed context
        </span>
        <span className="landing-stat">
          <span className="landing-stat-mark" aria-hidden="true">↗</span>
          Built for engineering teams
        </span>
      </footer>
    </div>
  );
}
