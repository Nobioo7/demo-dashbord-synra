const failures = [
  {
    number: "01",
    title: "Contextual amnesia",
    description:
      "Every AI session starts from zero. Developers re-explain architecture, API schemas, and past bug fixes into prompt windows — quietly eroding the productivity gains AI was supposed to deliver.",
  },
  {
    number: "02",
    title: "Review as bottleneck",
    description:
      "A 17-file AI-generated pull request forces a human to manually reconstruct dependency chains. Review defaults to skim-reading — which is how silent logic bugs enter production.",
  },
  {
    number: "03",
    title: "Tool fragmentation",
    description:
      "Knowledge generated in Cursor is invisible to Claude. What Codex learns, ChatGPT never knows. The company's shared engineering memory fractures across a dozen tools.",
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-32">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Chapter One</p>
          <h2 className="fade-up d1 max-w-5xl font-sans text-[clamp(2rem,6vw,5.5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Your AI is writing code faster than you can review it.
          </h2>
        </div>
        <div className="perspective-wrap grid gap-6 md:grid-cols-3">
          {failures.map((failure, index) => (
            <article
              key={failure.number}
              className={`card-3d fade-up${index ? ` d${index}` : ""} relative flex min-h-[420px] flex-col justify-between overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 p-10 md:p-12`}
            >
              <div className="card-3d-inner">
                <p className="text-[11px] tracking-[.25em] text-[#86868b] uppercase">Failure {failure.number}</p>
                <h3 className="mt-6 font-sans text-[28px] leading-[1.1] font-semibold tracking-tight text-[#f5f5f7] md:text-[34px]">
                  {failure.title}
                </h3>
              </div>
              <p className="card-3d-inner mt-12 text-[15px] leading-[1.6] tracking-tight text-[#86868b]">
                {failure.description}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-40 text-center">
          <p className="fade-up mb-10 text-[11px] tracking-[.3em] text-[#86868b] uppercase">The scale of the shift</p>
          <div className="fade-up d1 holo font-sans text-[clamp(4rem,15vw,14rem)] leading-[0.85] font-semibold tracking-tightest">
            35%
          </div>
          <p className="fade-up d2 mx-auto mt-8 max-w-xl text-[15px] tracking-tight text-[#86868b] md:text-[17px]">
            of pull requests in high-adoption engineering organizations are now AI-authored. GitHub commit volume is
            projected to grow fourteen-fold.
          </p>
        </div>
      </div>
    </section>
  );
}
