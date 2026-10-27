import BrainGraph from "@/components/BrainGraph";

export default function GraphPage() {
  return (
    <section aria-label="Synra memory graph page" className="graph-page -m-4 h-[calc(100vh-4rem)] min-h-[32rem] sm:-m-6 lg:-m-8">
      <BrainGraph />
    </section>
  );
}
