export default function OneMoreThingSection() {
  return (
    <section className="content-layer border-t border-white/5 px-6 py-56 md:py-72">
      <div className="mx-auto max-w-[1100px] text-center">
        <p className="fade-up mb-12 text-[12px] tracking-[.3em] text-[#86868b] uppercase">One more thing</p>
        <h2 className="fade-up d1 font-sans text-[clamp(2rem,7vw,6.5rem)] leading-[1] font-semibold tracking-tightest text-[#f5f5f7]">
          Memory is the product.<br />
          <span className="text-[#86868b]">Everything else feeds it.</span>
        </h2>
        <p className="fade-up d2 mx-auto mt-16 max-w-2xl text-[17px] leading-[1.55] tracking-tight text-[#86868b] md:text-[21px]">
          Twenty years ago, every company needed a website. Today, every company needs AI. Tomorrow, every company will
          need memory.
        </p>
      </div>
    </section>
  );
}
