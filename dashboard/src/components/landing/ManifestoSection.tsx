export default function ManifestoSection() {
  return (
    <section className="content-layer px-6 py-40 md:py-56">
      <div className="mx-auto max-w-[1000px]">
        <p className="fade-up mb-12 text-[12px] tracking-[.3em] text-[#86868b] uppercase">Our thesis</p>
        <h2 className="fade-up d1 font-sans text-[clamp(1.75rem,4.5vw,4rem)] leading-[1.1] font-semibold tracking-tightest text-[#f5f5f7]">
          Software generation has accelerated faster than software understanding.
        </h2>
        <p className="fade-up d2 mt-16 max-w-3xl text-[17px] leading-[1.55] tracking-tight text-[#86868b] md:text-[21px]">
          For thirty years, engineering governance was pre-code. Requirements were written, reviewed, and approved before
          a single line was shipped. Generative AI inverted that sequence. Now, code arrives in seconds — and verification
          is the bottleneck.
        </p>
      </div>
    </section>
  );
}
