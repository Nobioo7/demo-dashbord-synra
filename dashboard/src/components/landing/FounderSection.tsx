function ContactIcon({ type }: { type: "mail" | "phone" }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  if (type === "mail") {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  }

  if (type === "phone") {
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.58 2.8.7A2 2 0 0 1 22 16.92Z" />
      </svg>
    );
  }
}

const facts = [
  {
    label: "01 / Synra OS",
    value: "Founded 2025",
    caption: "Bootstrapped, memory-first architecture",
  },
  {
    label: "02 / 7 patents",
    value: "Provisional Indian claims",
    caption: "SAINAARA AI — attorney review",
  },
];

export default function FounderSection() {
  return (
    <section id="founder" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-16">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">The founder</p>
          <h2 className="fade-up d1 font-sans text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Built by an operator who ships.
          </h2>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-16 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="fade-up d2 font-sans text-[clamp(1.75rem,4vw,2.75rem)] leading-[1.1] font-semibold tracking-tightest text-[#f5f5f7]">
              NABEEL KHAN
            </p>
            <p className="mt-3 text-[15px] tracking-tight text-white">
              Founder &amp; Chief Technologist — Synra OS / Orbits Mind AI
            </p>
            <p className="mt-4 text-[13px] tracking-tight text-[#86868b]">Age 21</p>
            <div className="mt-10 flex flex-col gap-4 text-[13px]">
              <a
                className="flex items-center gap-3 text-[#86868b] transition-colors duration-300 hover:text-white"
                href="mailto:orbitmind595@gmail.com"
              >
                <ContactIcon type="mail" />
                <span>orbitmind595@gmail.com</span>
              </a>
              <a
                className="flex items-center gap-3 text-[#86868b] transition-colors duration-300 hover:text-white"
                href="tel:+919838336162"
              >
                <ContactIcon type="phone" />
                <span>+91 98383 36162</span>
              </a>
            </div>
          </div>

          <div className="space-y-6 text-[15px] leading-[1.75] tracking-tight text-[#86868b] md:col-span-7">
            <p className="fade-up d2">
              Self-taught AI systems builder combining field engineering discipline with software architecture.
              Architected Synra OS from first principles — a persistent organizational memory layer built around a
              multi-entity knowledge graph and intent-aware context compaction.
            </p>
            <p className="fade-up d3">
              Filed 7 provisional Indian patent claims for SAINAARA AI covering temporal decision mapping, redaction
              conflict resolution, and permission freshness defense. Shipping production systems on a bootstrapped
              budget — from architecture to demo to enterprise conversation, end to end.
            </p>
            <p className="fade-up d4">
              Previously shipped multiple production MVPs across agent orchestration, retrieval, and workflow
              automation — from prototype to shipped service.
            </p>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {facts.map((fact, index) => (
            <div
              key={fact.label}
              className={`fade-up d${index + 1} rounded-md border border-neutral-800 bg-neutral-950 p-5 transition-colors duration-300 hover:border-neutral-600`}
            >
              <p className="text-[11px] tracking-[.25em] text-neutral-400 uppercase">{fact.label}</p>
              <p className="mt-3 text-[15px] font-medium text-[#f5f5f7]">{fact.value}</p>
              <p className="mt-1 text-[12px] text-[#86868b]">{fact.caption}</p>
            </div>
          ))}
        </div>
        <div className="fade-up d5 mx-auto mt-24 max-w-3xl border-t border-neutral-800 pt-16 text-center">
          <p className="font-sans text-[clamp(1.25rem,2.6vw,1.85rem)] leading-[1.4] font-medium tracking-tight text-[#f5f5f7]">
            &ldquo;Truth is one; the wise call it by many names.&rdquo;
          </p>
          <p className="mt-6 text-[11px] tracking-[.3em] text-neutral-400 uppercase">
            Rig Veda 1.164.46 &middot; Advaita Vedanta
          </p>
        </div>
      </div>
    </section>
  );
}
