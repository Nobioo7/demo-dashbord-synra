const pillars = [
  {
    number: "01 · Parsing",
    title: "AST-first, not text-first.",
    description:
      "Tree-sitter parses your codebase into Concrete Syntax Trees. We resolve cross-file types and symbol hierarchies deterministically — never through fragile vector embeddings.",
  },
  {
    number: "02 · Memory",
    title: "Persistent property graph.",
    description:
      "Architecture, APIs, past PRs, team decisions, incident history — all stored in a queryable graph that deepens with every merged commit. Memory that compounds.",
  },
  {
    number: "03 · Evidence",
    title: "SARIF Security Passports.",
    description:
      "We never claim code is safe. We prove it. Every AI-generated commit produces a machine-readable audit artifact formatted for SOC 2 compliance conversations.",
  },
];

export default function SolutionSection() {
  return (
    <section id="solution" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-32 text-center">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Chapter Two</p>
          <h2 className="fade-up d1 mx-auto max-w-5xl font-sans text-[clamp(2rem,6vw,5.5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            One memory graph.<br /><span className="text-[#86868b]">Every AI tool.</span>
          </h2>
        </div>
        <div className="fade-up d2 perspective-wrap mx-auto max-w-[900px]">
          <div className="card-3d glass relative overflow-hidden rounded-lg">
            <div className="card-3d-inner">
              <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <p className="ml-4 font-mono text-[11px] tracking-tight text-[#86868b]">synra — evidence card</p>
              </div>
              <div className="terminal p-8 md:p-12">
                <p className="comment mb-6">{"// Pull Request #482 · refactor(auth)"}</p>
                <p className="mb-5"><span className="key">› AST diff parsed</span><span className="value"> — 17 files, 4 modules affected</span></p>
                <p className="mb-5"><span className="key">› Relevant tests identified</span><span className="value"> — 3/3 passing · test_auth.py</span></p>
                <p className="mb-5"><span className="key">› Semgrep + CodeQL scan</span><span className="value"> — 0 critical · 1 medium</span></p>
                <p className="mb-5"><span className="key">› Architecture impact</span><span className="value"> — no breaking API change</span></p>
                <p className="mb-8"><span className="key">› Memory graph queried</span><span className="value"> — 6 historical decisions surfaced</span></p>
                <div className="border-t border-white/5 pt-6">
                  <span className="key">✓ Security Passport generated</span>
                  <span className="value"> — SARIF artifact attached</span>
                  <span className="cursor text-[#f5f5f7]">▍</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-40 grid max-w-[1200px] gap-16 md:grid-cols-3 md:gap-12">
          {pillars.map((pillar, index) => (
            <div key={pillar.number} className={`fade-up${index ? ` d${index}` : ""} perspective-wrap`}>
              <div className="card-3d">
                <p className="mb-5 text-[11px] tracking-[.25em] text-[#86868b] uppercase">{pillar.number}</p>
                <h3 className="font-sans text-[24px] leading-tight font-semibold tracking-tight text-[#f5f5f7] md:text-[28px]">
                  {pillar.title}
                </h3>
                <p className="mt-5 text-[15px] leading-[1.65] tracking-tight text-[#86868b]">{pillar.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
