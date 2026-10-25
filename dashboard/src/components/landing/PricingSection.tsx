const plans = [
  {
    name: "Community",
    price: "$0",
    note: "Forever free",
    features: ["V1 PR Verification", "AST Diff Parsing", "Basic Evidence Cards", "Community Support"],
    action: "Join Waitlist",
    popular: false,
  },
  {
    name: "Pro",
    price: "$24",
    note: "Per active author / month",
    features: ["Full Evidence Cards", "V2 Repository Memory", "V3 Multi-AI Router (MCP)", "90%+ Token Reduction", "Standard Retention"],
    action: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "$45–65",
    note: "Per active author / month",
    features: ["V4 Security Passports", "On-Prem / Private Cloud", "SOC 2 Ready Audit Trail", "SSO & Granular Permissions", "Dedicated Support SLA"],
    action: "Contact Sales",
    popular: false,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1400px]">
        <div className="mx-auto mb-32 max-w-4xl text-center">
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Chapter Five</p>
          <h2 className="fade-up d1 font-sans text-[clamp(2rem,6vw,5.5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Simple. Transparent.<br /><span className="text-[#86868b]">Priced per author.</span>
          </h2>
        </div>
        <div className="perspective-wrap mx-auto grid max-w-[1200px] gap-6 md:grid-cols-3">
          {plans.map((plan, index) => (
            <article
              key={plan.name}
              className={`card-3d fade-up${index ? ` d${index}` : ""} relative flex flex-col overflow-hidden rounded-lg border p-10 md:p-12 ${
                plan.popular
                  ? "bg-white/[.03] border-white/[.15] shadow-[0_0_60px_-15px_rgba(245,245,247,.2)] md:-my-4"
                  : "border-white/[.06] bg-white/[.02]"
              }`}
            >
              <div className="card-3d-inner">
                {plan.popular && (
                  <div className="absolute top-0 left-10 -translate-y-1/2 rounded-md bg-white px-3 py-1 text-[10px] font-semibold tracking-[.2em] text-black uppercase">
                    Most Popular
                  </div>
                )}
                <p className={`text-[11px] tracking-[.25em] uppercase ${plan.popular ? "text-[#f5f5f7]" : "text-[#86868b]"}`}>
                  {plan.name}
                </p>
                <p className="mt-8 font-sans text-[56px] leading-none font-semibold tracking-tightest text-[#f5f5f7]">{plan.price}</p>
                <p className="mt-3 text-[13px] text-[#86868b]">{plan.note}</p>
                <div className="hr my-10" />
                <ul className={`space-y-4 text-[14px] tracking-tight ${plan.popular ? "text-[#f5f5f7]" : "text-[#86868b]"}`}>
                  {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
              <a
                href="#waitlist"
                className={`btn mt-10 justify-center rounded-md px-6 py-3 text-[13px] font-medium ${
                  plan.popular ? "btn-white" : "btn-ghost"
                }`}
              >
                {plan.action}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
