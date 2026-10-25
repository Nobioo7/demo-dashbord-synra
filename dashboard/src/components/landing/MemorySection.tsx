"use client";

import { useEffect, useState } from "react";
import BrainGraph from "@/components/BrainGraph";
import GitHubSyncButton from "@/components/GitHubSyncButton";
import IngestModal from "@/components/IngestModal";

const API_BASE_URL = "/backend";

export default function MemorySection() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [projectId, setProjectId] = useState("chatgpt");
  const [availableProjects, setAvailableProjects] = useState<string[]>(["chatgpt", "demo"]);

  useEffect(() => {
    let cancelled = false;
    async function fetchProjects() {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/projects`);
        if (!response.ok) return;
        const list = (await response.json()) as string[];
        if (!cancelled && Array.isArray(list) && list.length > 0) {
          setAvailableProjects(list);
          setProjectId((current) => (list.includes(current) ? current : list[0]));
        }
      } catch {
        // Keep the defaults when the API is unavailable.
      }
    }
    void fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <section id="context-brain" className="content-layer border-t border-white/5">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-24 md:flex-row md:items-end md:justify-between lg:px-12">
        <div>
          <p className="fade-up mb-8 text-[12px] tracking-[.3em] text-[#86868b] uppercase">The Context Brain · Live product</p>
          <h2 className="fade-up d1 font-sans text-[clamp(2rem,6vw,5rem)] leading-[1.05] font-semibold tracking-tightest text-[#f5f5f7]">
            Your memory, live.
          </h2>
          <p className="fade-up d2 mt-8 max-w-2xl text-[15px] leading-[1.7] tracking-tight text-[#86868b] md:text-[17px]">
            A live view of Synra’s project context graph. Explore real memory nodes, filter by source, or add a memory to
            see the graph refresh.
          </p>
        </div>
        <div className="fade-up d3 flex shrink-0 flex-wrap items-start gap-3">
          <IngestModal projectId={projectId} onIngested={() => setRefreshKey((key) => key + 1)} />
          <GitHubSyncButton projectId={projectId} onSynced={() => setRefreshKey((key) => key + 1)} />
        </div>
      </div>
      <div className="relative h-screen min-h-[680px] w-screen overflow-hidden border-y border-white/10">
        <BrainGraph
          refreshKey={refreshKey}
          projectId={projectId}
          onProjectChange={setProjectId}
          availableProjects={availableProjects}
        />
      </div>
      <p className="mx-auto max-w-[1400px] px-6 py-5 text-xs text-[#86868b] lg:px-12">
        Select a node to inspect its source, project, timestamp, and connected memories.
      </p>
    </section>
  );
}
