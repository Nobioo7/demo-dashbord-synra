const versions = [
  {
    number: "01",
    title: "GitHub Wedge",
    period: "Months 1 — 3",
    depth: "30",
    description:
      "Zero-retention GitHub App. Parses PR diffs with Tree-sitter, runs Semgrep scans, and posts AST-anchored evidence comments — inside the workflow developers already use.",
  },
  {
    number: "02",
    title: "Repository Memory",
    period: "Months 4 — 6",
    depth: "20",
    description:
      "Persistent property graph stores architecture, APIs, past PRs, and team decisions. Exposed through an open Model Context Protocol (MCP) server — the AI stops forgetting.",
  },
  {
    number: "03",
    title: "Multi-AI Brain",
    period: "Months 7 — 12",
    depth: "10",
    description:
      "Model-agnostic routing between Claude, GPT-4o, and Gemini. AST symbol isolation reduces token consumption by 90%+ on large-repo changes. Model changes. Memory doesn't.",
  },
  {
    number: "04",
    title: "Security Passport",
    period: "Months 13 — 18",
    depth: "0",
    description:
      "SARIF-compliant audit artifacts. Policy validation. Human Trust Layer for enterprise governance. Turning code review from a subjective opinion into an audit trail.",
  },
];

export default function VersionsSection() {
  return (
    <section id="versions" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-32 max-w-5xl">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Chapter Three</p>
          <h2 className="fade-up d1 font-sans text-[clamp(2rem,6vw,5.5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Four versions. One continuous memory.
          </h2>
          <p className="fade-up d2 mt-10 max-w-3xl text-[17px] leading-[1.55] tracking-tight text-[#86868b] md:text-[21px]">
            Nothing built in V1 is thrown away. Each version deepens the same underlying graph.
          </p>
        </div>
        <div className="space-y-4">
          {versions.map((version, index) => (
            <article
              key={version.number}
              data-depth={version.depth}
              className={`depth-panel fade-up${index ? ` d${index}` : ""} grid items-baseline gap-8 rounded-lg border border-neutral-800 bg-neutral-950 p-8 hover:border-neutral-600 md:grid-cols-12 md:p-12`}
            >
              <div className="md:col-span-2">
                <p className={`font-sans text-[48px] leading-none font-semibold tracking-tightest md:text-[64px] ${index === 0 ? "text-[#f5f5f7]" : "text-[#86868b]"}`}>
                  {version.number}
                </p>
              </div>
              <div className="md:col-span-4">
                <h3 className="font-sans text-[24px] leading-tight font-semibold tracking-tight text-[#f5f5f7] md:text-[32px]">
                  {version.title}
                </h3>
                <p className="mt-3 text-[12px] tracking-[.2em] text-[#86868b] uppercase">{version.period}</p>
              </div>
              <div className="md:col-span-6">
                <p className="text-[15px] leading-[1.65] tracking-tight text-[#86868b]">{version.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
