const questions = [
  {
    question: "What exactly is Synra?",
    answer:
      "Synra is an AI Engineering Brain operating between code repositories and AI coding tools. It maintains a persistent repository memory graph, verifies pull requests using AST-level evidence, and provides a unified context layer across AI coding assistants like Cursor, Claude, and Codex.",
  },
  {
    question: "Is context amnesia a real enterprise problem?",
    answer:
      "Yes. Autonomous coding tools generate code rapidly, but human developers spend significant time re-explaining repository architecture, conventions, and past decisions across separate chat sessions. The primary bottleneck has shifted from code generation to code verification and contextual alignment.",
  },
  {
    question: "How does Synra handle code vulnerability detection?",
    answer:
      "By orchestrating deterministic static security analysis tools (Semgrep and GitHub CodeQL) locally before querying LLM modules. We never claim code is “100% safe.” Instead, Synra delivers evidence-driven verification backed by static analysis outputs and test execution data, compiled into a SARIF-compliant Security Passport.",
  },
  {
    question: "What if OpenAI or Anthropic copies this?",
    answer:
      "Foundational LLM vendors build general reasoning models. Synra builds enterprise-specific structural memory graphs that work across heterogeneous tools. Our persistent, enterprise-specific Code Knowledge Graph deepens with every merged PR — a defensive data moat that neither OpenAI nor Anthropic has any incentive to build inside their own ecosystems.",
  },
  {
    question: "What if GitHub builds native repository memory?",
    answer:
      "GitHub owns its own platform, but engineering teams actively avoid single-vendor lock-in. A model-agnostic memory layer that bridges Cursor, Claude, and local CLIs remains valuable even if GitHub ships a native competitor. Memory lock-in compounds; it doesn't reset when a vendor ships a feature.",
  },
];

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function FAQSection() {
  return (
    <section id="faq" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-24">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Frequently asked</p>
          <h2 className="fade-up d1 font-sans text-[clamp(2rem,5vw,4rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Straight answers.
          </h2>
        </div>
        <div className="divide-y divide-white/5">
          {questions.map((item) => (
            <details key={item.question} className="group py-8">
              <summary className="flex cursor-pointer list-none items-center justify-between">
                <h3 className="pr-8 font-sans text-[18px] font-medium tracking-tight text-[#f5f5f7] md:text-[22px]">
                  {item.question}
                </h3>
                <span className="flex-shrink-0 text-[#86868b] transition-transform duration-300 group-open:rotate-45">
                  <PlusIcon />
                </span>
              </summary>
              <p className="max-w-3xl pt-6 text-[15px] leading-[1.7] tracking-tight text-[#86868b]">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
