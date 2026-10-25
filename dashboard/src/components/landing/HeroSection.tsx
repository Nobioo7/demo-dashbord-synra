export default function HeroSection() {
  return (
    <section id="hero" className="content-layer relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="w-full max-w-[1200px] text-center">
        <p className="fade-in d1 mb-12 text-[12px] tracking-[.3em] text-[#86868b] uppercase">
          Introducing the AI Engineering Brain
        </p>
        <h1 className="font-sans text-[clamp(2.5rem,9vw,9rem)] leading-[0.95] font-semibold tracking-tightest text-[#f5f5f7]">
          <span className="mask-line d2"><span>AI writes code.</span></span>
          <span className="mask-line d3"><span className="text-[#86868b]">Synra remembers.</span></span>
        </h1>
        <p className="fade-up d4 mx-auto mt-16 max-w-2xl text-[17px] leading-[1.5] font-normal tracking-tight text-[#86868b] md:text-[21px]">
          The persistent, evidence-backed memory layer that gives every AI coding tool a shared understanding of how your
          company builds software.
        </p>
        <div className="fade-up d5 mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          <a href="#waitlist" className="btn btn-white rounded-md px-7 py-3 text-[14px] font-medium">
            Request Early Access
          </a>
          <a href="#solution" className="flex items-center gap-1.5 text-[14px] font-normal text-[#f5f5f7] transition-colors duration-300 hover:text-[#86868b]">
            Learn more
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </a>
        </div>
      </div>
      <div className="fade-in d5 absolute bottom-10 left-1/2 -translate-x-1/2" aria-hidden="true">
        <div className="h-12 w-px bg-gradient-to-b from-transparent via-white/30 to-transparent" />
      </div>
    </section>
  );
}
