export default function SecuritySection() {
  return (
    <section id="security" className="content-layer border-t border-white/5 px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid items-start gap-16 lg:grid-cols-12 lg:gap-24">
          <div className="lg:sticky lg:top-32 lg:col-span-5">
            <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Chapter Four</p>
            <h2 className="fade-up d1 font-sans text-[clamp(2rem,5vw,4.5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
              Evidence, not assumptions.
            </h2>
            <p className="fade-up d2 mt-10 text-[17px] leading-[1.55] tracking-tight text-[#86868b]">
              We never claim code is safe. We show proof. Every AI-generated commit produces a machine-readable Security
              Passport that auditors can trust.
            </p>
            <div className="fade-up d3 mt-14 space-y-5">
              {[
                "Model provenance & prompt hash",
                "Call-graph blast radius mapping",
                "Static analysis results — Semgrep + CodeQL",
                "Policy compliance & test execution proof",
              ].map((item, index) => (
                <div key={item} className="flex items-baseline gap-4">
                  <span className="w-6 font-mono text-[11px] text-[#86868b]">0{index + 1}</span>
                  <span className="text-[15px] tracking-tight text-[#f5f5f7]">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="fade-up d2 lg:col-span-7">
            <div className="passport glass relative overflow-hidden rounded-lg">
              <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-sm bg-white/15" />
                <p className="ml-4 font-mono text-[11px] tracking-tight text-[#86868b]">security_passport.json</p>
              </div>
              <pre className="terminal overflow-x-auto p-8 text-[12.5px] md:p-10"><code>{`{
  `}<span className="key">{'"passport_id"'}</span>{`: `}<span className="value">{'"pass_sec_98421a_2026"'}</span>{`,
  `}<span className="key">{'"commit_sha"'}</span>{`: `}<span className="value">{'"e3b0c44298fc1c149af..."'}</span>{`,
  `}<span className="key">{'"ai_attribution"'}</span>{`: {
    `}<span className="key">{'"agent"'}</span>{`: `}<span className="value">{'"Cursor / Claude 3.5"'}</span>{`,
    `}<span className="key">{'"timestamp"'}</span>{`: `}<span className="value">{'"2026-03-31T10:14:22Z"'}</span>{`
  },
  `}<span className="key">{'"blast_radius"'}</span>{`: {
    `}<span className="key">{'"affected_files"'}</span>{`: `}<span className="value">{'4'}</span>{`,
    `}<span className="key">{'"impacted_symbols"'}</span>{`: [`}<span className="value">{'"authService.verifyToken"'}</span>{`],
    `}<span className="key">{'"graph_depth"'}</span>{`: `}<span className="value">{'3'}</span>{`
  },
  `}<span className="key">{'"verification_evidence"'}</span>{`: {
    `}<span className="key">{'"sarif_scan"'}</span>{`: { `}<span className="key">{'"high_severity"'}</span>{`: `}<span className="value">{'0'}</span>{`, `}<span className="key">{'"status"'}</span>{`: `}<span className="value">{'"PASSED"'}</span>{` },
    `}<span className="key">{'"codeql_analysis"'}</span>{`: { `}<span className="key">{'"rules_checked"'}</span>{`: `}<span className="value">{'42'}</span>{`, `}<span className="key">{'"status"'}</span>{`: `}<span className="value">{'"PASSED"'}</span>{` },
    `}<span className="key">{'"test_suite"'}</span>{`: { `}<span className="key">{'"tests_run"'}</span>{`: `}<span className="value">{'18'}</span>{`, `}<span className="key">{'"coverage_delta"'}</span>{`: `}<span className="value">{'"+0.4%"'}</span>{` }
  },
  `}<span className="key">{'"policy_compliance"'}</span>{`: { `}<span className="key">{'"owasp_top_10"'}</span>{`: `}<span className="value">{'"VERIFIED"'}</span>{` }
}`}</code></pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
