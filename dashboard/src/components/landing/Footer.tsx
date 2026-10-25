const groups = [
  {
    title: "Product",
    links: [["Problem", "#problem"], ["Solution", "#solution"], ["Versions", "#versions"], ["Pricing", "#pricing"]],
  },
  {
    title: "Company",
    links: [["About", "#"], ["Blog", "#"], ["Careers", "#"], ["Contact", "#"]],
  },
  {
    title: "Legal",
    links: [["Privacy", "#"], ["Terms", "#"], ["Security", "#security"], ["SOC 2", "#security"]],
  },
];

export default function Footer() {
  return (
    <footer className="content-layer border-t border-white/5">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-12">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <div className="md:col-span-6">
            <p className="font-sans text-[17px] font-semibold tracking-tight text-[#f5f5f7]">Synra</p>
            <p className="mt-4 max-w-xs text-[13px] leading-[1.7] tracking-tight text-[#86868b]">
              The AI Engineering Brain. Formerly PR Guardian.
            </p>
          </div>
          {groups.map((group) => (
            <div key={group.title} className="md:col-span-2">
              <p className="mb-5 text-[11px] tracking-[.2em] text-[#86868b] uppercase">{group.title}</p>
              <ul className="space-y-3 text-[13px] tracking-tight text-[#86868b]">
                {group.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="transition-colors duration-300 hover:text-[#f5f5f7]">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="hr my-12" />
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-[12px] tracking-tight text-[#86868b]">© 2026 Synra. All rights reserved.</p>
          <p className="text-[12px] tracking-tight text-[#86868b] italic">Model changes. Memory doesn&apos;t.</p>
        </div>
      </div>
    </footer>
  );
}
