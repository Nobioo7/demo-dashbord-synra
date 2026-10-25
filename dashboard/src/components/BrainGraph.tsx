"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { ForceGraphMethods } from "react-force-graph-3d";
import { useWorkspaceIdFromCookie } from "@/lib/memories";

const API_BASE_URL = "/backend";

type MemoryEvent = {
  source_tool: string;
  event_type: string;
  user_prompt: string;
  ai_response: string;
  timestamp: string;
};

type ContextResponse = {
  project_id: string;
  context_summary: string;
  recent_events: MemoryEvent[];
  event_count: number;
  nodes?: GraphNode[];
  links?: GraphLink[];
};

type GraphNode = {
  id: string;
  label: string;
  group: "core" | "project" | "source" | "memory";
  detail: string;
  event_type?: string;
  val?: number;
  source?: string;
  content?: string;
  timestamp?: string;
  projectId?: string;
  x?: number;
  y?: number;
  z?: number;
};

type GraphLink = { source: string | GraphNode; target: string | GraphNode; kind?: string; score?: number };
export type BrainGraphData = { nodes: GraphNode[]; links: GraphLink[] };

type ForceGraphProps = {
  graphData: BrainGraphData;
  width?: number;
  height?: number;
  backgroundColor?: string;
  linkColor?: (link: GraphLink) => string;
  linkOpacity?: number;
  linkWidth?: number;
  nodeLabel?: (node: GraphNode) => string;
  nodeVal?: (node: GraphNode) => number;
  nodeColor?: (node: GraphNode) => string;
  nodeOpacity?: (node: GraphNode) => number;
  nodeThreeObject?: (node: GraphNode) => THREE.Object3D;
  nodeThreeObjectExtend?: boolean;
  nodeRelSize?: number;
  nodeResolution?: number;
  linkDirectionalParticles?: number;
  linkDirectionalParticleSpeed?: number;
  linkDirectionalParticleWidth?: number;
  linkDirectionalParticleColor?: () => string;
  linkDirectionalParticleThreeObject?: () => THREE.Object3D;
  onNodeClick?: (node: GraphNode) => void;
  onNodeHover?: (node: GraphNode | null) => void;
  onEngineStop?: () => void;
  cooldownTime?: number;
  d3VelocityDecay?: number;
  d3AlphaDecay?: number;
  d3Force?: (forceName: string) => unknown;
  ref?: React.MutableRefObject<ForceGraphMethods | undefined>;
};

export type DataSource = "synra" | "agentmemory";

type BrainGraphProps = {
  refreshKey?: number;
  graphData?: BrainGraphData;
  projectId?: string;
  onProjectChange?: (projectId: string) => void;
  availableProjects?: string[];
  dataSource?: DataSource;
  onDataSourceChange?: (source: DataSource) => void;
};
type SourceFilter = "all" | "github" | "slack" | "gmail" | "calendar" | "ai" | "extension" | "dashboard" | "agentmemory";

const ForceGraph3D = dynamic<ForceGraphProps>(
  () => import("react-force-graph-3d").then((module) => module.default as React.ComponentType<ForceGraphProps>),
  { ssr: false, loading: () => <div className="grid h-full place-items-center text-[#86868b]">Loading 3D renderer…</div> },
);

function nodeId(node: string | GraphNode) {
  return typeof node === "string" ? node : node.id;
}

function placeNodes(data: BrainGraphData, memoryCount: number): BrainGraphData {
  const placementCount = Math.max(1, data.nodes.length - 1);
  const radius = 60 + 18 * Math.cbrt(Math.max(1, memoryCount / 10));
  return {
    nodes: data.nodes.map((node, index) => {
      if (node.group === "core") return { ...node, x: 0, y: 0, z: 0 };
      const u = Math.acos(1 - (2 * ((index % placementCount) + 0.5)) / placementCount);
      const v = index * 2.399963;
      const offset = index % 2 === 0 ? -100 : 100;
      return { ...node, x: offset + radius * Math.sin(u) * Math.cos(v), y: radius * 0.67 * Math.sin(u) * Math.sin(v), z: radius * 0.5 * Math.cos(u) };
    }),
    links: data.links,
  };
}

function coreData(projectId = "chatgpt", detail = "Waiting for context…"): BrainGraphData {
  return { nodes: [{ id: "synra-core", label: "SYNRA", group: "core", detail, val: 12, projectId }], links: [] };
}

function colorFor(node: GraphNode, selected = false): string {
  if (selected) return "#f0c75e";
  if (node.group === "core") return "#d4af37";
  if (node.group === "project") return "#8a7431";
  return node.group === "source" ? "#86868b" : "#f5f5f7";
}

export default function BrainGraph({
  refreshKey = 0,
  graphData: providedGraphData,
  projectId = "chatgpt",
  onProjectChange,
  availableProjects,
  dataSource: dataSourceProp,
  onDataSourceChange,
}: BrainGraphProps) {
  const workspaceId = useWorkspaceIdFromCookie();
  const scopedProjectId = workspaceId ?? projectId;
  const [dataSourceState, setDataSourceState] = useState<DataSource>(dataSourceProp ?? "synra");
  const activeDataSource = dataSourceProp ?? dataSourceState;
  const setDataSource = (source: DataSource) => {
    setDataSourceState(source);
    onDataSourceChange?.(source);
  };

  const [context, setContext] = useState<ContextResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const [graphSize, setGraphSize] = useState({ width: 0, height: 0 });

  const loadContext = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    setContext(null);
    setSelectedNode(null);
    try {
      const endpoint = activeDataSource === "agentmemory"
        ? `${API_BASE_URL}/api/v1/agentmemory/graph?workspace_id=${encodeURIComponent(scopedProjectId)}`
        : `${API_BASE_URL}/api/v1/memory/context?project_id=${encodeURIComponent(scopedProjectId)}`;
      const response = await fetch(endpoint, { cache: "no-store", signal });
      if (!response.ok) throw new Error(`Backend returned ${response.status}`);
      setContext((await response.json()) as ContextResponse);
    } catch (caughtError) {
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") return;
      setError(caughtError instanceof Error ? caughtError.message : "Unable to reach the backend");
    }
  }, [activeDataSource, scopedProjectId]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadContext(controller.signal); }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadContext, refreshKey, projectId, activeDataSource]);

  useEffect(() => {
    const container = graphContainerRef.current;
    if (!container) return;
    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setGraphSize({ width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const graphData = useMemo(() => {
    if (providedGraphData) return placeNodes(providedGraphData, providedGraphData.nodes.filter((node) => node.group === "memory").length);
    if (!context?.nodes || !context.links) return coreData(context?.project_id, context?.context_summary);
    const ids = new Map<string, string>();
    const isAgentMemory = activeDataSource === "agentmemory" || context.project_id === "agentmemory";
    const coreLabel = isAgentMemory ? "AGENTMEMORY" : "SYNRA";
    const coreId = isAgentMemory ? "agentmemory-core" : "synra-core";
    const nodes = [
      ...(context.nodes.some((n) => n.id === coreId)
        ? []
        : [{ id: coreId, label: coreLabel, group: "core" as const, detail: isAgentMemory ? "AgentMemory Shared Layer" : "Synra Context Brain", val: 12, projectId: context.project_id }]),
      ...context.nodes.map((node) => {
        const id = node.id;
        ids.set(node.id, id);
        return node.group === "project"
          ? { ...node, id, projectId: context.project_id }
          : { ...node, source: node.source ?? (node.group === "source" ? node.label : undefined), content: node.content ?? node.detail, projectId: context.project_id };
      }),
    ];
    const links = [
      ...(!isAgentMemory ? [{ source: "synra-core", target: `project:${context.project_id}` }] : []),
      ...context.links.map((link) => ({ ...link, source: ids.get(nodeId(link.source)) ?? nodeId(link.source), target: ids.get(nodeId(link.target)) ?? nodeId(link.target) })),
    ];
    return placeNodes({ nodes, links }, context.event_count);
  }, [context, providedGraphData, activeDataSource]);

  const connectedIds = useMemo(() => {
    const ids = new Set<string>();
    if (!selectedNode) return ids;
    ids.add(selectedNode.id);
    graphData.links.forEach((link) => {
      const source = nodeId(link.source); const target = nodeId(link.target);
      if (source === selectedNode.id) ids.add(target);
      if (target === selectedNode.id) ids.add(source);
    });
    return ids;
  }, [graphData.links, selectedNode]);

  const memories = context?.event_count ?? graphData.nodes.filter((node) => node.group === "memory").length;
  const normalizedSearch = search.trim().toLowerCase();
  const matchingIds = useMemo(() => new Set(
    graphData.nodes
      .filter((node) => {
        const source = (node.source ?? node.label).toLowerCase();
        const matchesFilter = node.group === "core" || node.group === "project" || sourceFilter === "all" || source === sourceFilter;
        const haystack = `${node.label} ${node.source ?? ""} ${node.content ?? node.detail}`.toLowerCase();
        return matchesFilter && (!normalizedSearch || haystack.includes(normalizedSearch));
      })
      .map((node) => node.id),
  ), [graphData.nodes, normalizedSearch, sourceFilter]);
  const visibleGraphData = useMemo(() => ({
    nodes: graphData.nodes,
    links: graphData.links,
  }), [graphData]);
  const densityScale = Math.max(0.35, Math.min(1, Math.sqrt(10 / Math.max(10, memories))));
  const particleCount = memories > 500 ? 1 : memories > 100 ? 2 : 4;
  const particleSpeed = Math.max(0.0015, Math.min(0.006, 0.006 * Math.sqrt(10 / Math.max(10, memories))));
  const particle = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), new THREE.MeshBasicMaterial({ color: "#d4af37" })), []);
  const goldGlowMaterial = useMemo(() => {
    const size = 64;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const distance = Math.hypot(x - (size - 1) / 2, y - (size - 1) / 2) / (size / 2);
        const offset = (y * size + x) * 4;
        pixels[offset] = 212;
        pixels[offset + 1] = 175;
        pixels[offset + 2] = 55;
        pixels[offset + 3] = Math.round(Math.max(0, 1 - distance) * 0.35 * 255);
      }
    }
    const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    if (typeof node.x !== "number" || typeof node.y !== "number" || typeof node.z !== "number") return;
    const length = Math.hypot(node.x, node.y, node.z) || 1;
      const distance = node.group === "core" ? 90 : node.group === "project" ? 70 : 42;
    fgRef.current?.cameraPosition({ x: node.x + (node.x / length) * distance, y: node.y + (node.y / length) * distance, z: node.z + (node.z / length) * distance }, { x: node.x, y: node.y, z: node.z }, 1200);
  }, []);

  const relatedCount = selectedNode ? graphData.links.filter((link) => nodeId(link.source) === selectedNode.id || nodeId(link.target) === selectedNode.id).length : 0;
  const fitGraph = useCallback(() => {
    fgRef.current?.zoomToFit(700, 100);
  }, []);
  const sourceCount = new Set(graphData.nodes.filter((node) => node.group === "source").map((node) => node.id)).size;
  const connectionCount = graphData.links.length;

  return (
    <section className="relative h-screen min-h-screen w-screen min-w-full overflow-hidden bg-black" aria-label="Synra memory graph">
      <div ref={graphContainerRef} className="absolute inset-0 h-full w-full">
        <ForceGraph3D ref={fgRef} width={graphSize.width} height={graphSize.height} backgroundColor="#000000" graphData={visibleGraphData} linkColor={(link) => selectedNode && (nodeId(link.source) === selectedNode.id || nodeId(link.target) === selectedNode.id) ? "#8a7431" : "#86868b"} linkOpacity={0.35} linkWidth={1.1}
          nodeColor={(node) => colorFor(node, selectedNode?.id === node.id)} nodeOpacity={(node) => selectedNode && !connectedIds.has(node.id) ? 0.25 : (normalizedSearch || sourceFilter !== "all") && !matchingIds.has(node.id) ? 0.12 : 1}
          nodeThreeObject={(node) => {
            const group = new THREE.Group();
            const radius = node.group === "core" ? 8 : (node.group === "project" ? 5 : node.group === "source" ? 3.5 : 2.4) * densityScale;
            const isSelected = selectedNode?.id === node.id;
            const glow = new THREE.Sprite(goldGlowMaterial);
            glow.scale.set(node.group === "core" ? 48 : radius * 5, node.group === "core" ? 48 : radius * 5, 1);
            if (node.group === "core" || isSelected) group.add(glow);
            const nodeColor = colorFor(node, isSelected);
            const material = node.group === "core" || isSelected
              ? new THREE.MeshBasicMaterial({ color: nodeColor })
              : new THREE.MeshStandardMaterial({ color: nodeColor, emissive: nodeColor, emissiveIntensity: 1.4 });
            group.add(new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), material));
            if (node.group === "core") group.add(new THREE.Mesh(new THREE.TorusGeometry(11, 0.45, 8, 32), new THREE.MeshBasicMaterial({ color: "#d4af37", transparent: true, opacity: 0.7 })));
            return group;
          }}
          nodeThreeObjectExtend={false} nodeLabel={(node) => node.group === "core" ? "<strong>SYNRA</strong><br/>CONTEXT CORE" : node.group === "project" || hoveredNode?.id === node.id || selectedNode?.id === node.id ? `<strong>${node.label}</strong><br/>${node.source ?? node.group}` : ""} nodeVal={(node) => (node.val ?? 3) * densityScale} nodeRelSize={5} nodeResolution={12}
          linkDirectionalParticles={particleCount} linkDirectionalParticleSpeed={particleSpeed} linkDirectionalParticleWidth={1.5} linkDirectionalParticleColor={() => "#d4af37"} linkDirectionalParticleThreeObject={() => particle} onNodeClick={handleNodeClick} onNodeHover={(node) => setHoveredNode(node)} onEngineStop={fitGraph} cooldownTime={1200} d3VelocityDecay={0.35} d3AlphaDecay={0.03} />
      </div>
      <header className="pointer-events-none absolute inset-x-0 top-0 flex h-16 items-center justify-between border-b border-white/10 bg-[#0a0a0a]/90 px-6 text-[#f5f5f7]">
        <div className="flex items-center gap-3">
          <span className="text-xl text-[#86868b]" aria-hidden="true">◈</span>
          <h1 className="text-base font-semibold">Memory Graph</h1>
          <div className="pointer-events-auto ml-2 flex items-center rounded-md border border-neutral-800 bg-black p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDataSource("synra")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                activeDataSource === "synra"
                  ? "bg-white text-black shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Synra Core
            </button>
            <button
              type="button"
              onClick={() => setDataSource("agentmemory")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                activeDataSource === "agentmemory"
                  ? "bg-white text-black shadow-sm font-semibold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              AgentMemory
            </button>
          </div>
          {activeDataSource === "synra" && availableProjects && availableProjects.length > 0 && (
            <div className="pointer-events-auto ml-2 flex items-center gap-2">
              <label htmlFor="synra-project-select" className="text-xs text-[#86868b]">Project:</label>
              <select
                id="synra-project-select"
                value={projectId}
                onChange={(e) => onProjectChange?.(e.target.value)}
                className="rounded-md border border-neutral-800 bg-black px-2 py-1 text-xs text-white outline-none hover:border-neutral-600 focus:border-neutral-500"
              >
                {availableProjects.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          )}
          {activeDataSource === "agentmemory" && (
            <span className="pointer-events-auto rounded bg-white/5 px-2 py-0.5 text-[11px] text-[#86868b] border border-white/10">
              Shared Port 3111
            </span>
          )}
        </div>
        <span className="text-xl text-[#86868b]" aria-label="Close">×</span>
      </header>
      <p className="pointer-events-none absolute left-6 top-[4.5rem] text-xs text-[#86868b]">{activeDataSource === "agentmemory" ? "Viewing AgentMemory shared graph" : `Viewing Synra Core · ${projectId}`} {context ? `· ${memories} indexed memor${memories === 1 ? "y" : "ies"} · ${sourceCount} sources · ${connectionCount} connections` : "· Connecting to memory service…"}</p>
      <div className="pointer-events-auto absolute right-6 top-[4.5rem] z-[2] flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button type="button" onClick={fitGraph} className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900">Focus Brain</button>
            <button type="button" onClick={() => void loadContext()} className="rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-neutral-200 hover:bg-neutral-900">Refresh</button>
          </div>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search context" aria-label="Search loaded context" className="w-52 rounded-md border border-neutral-800 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-neutral-500" />
          <div className="flex flex-wrap justify-end gap-1">
            {(["all", "github", "slack", "gmail", "calendar", "ai", "extension", "dashboard"] as SourceFilter[]).map((filter) => (
              <button key={filter} type="button" onClick={() => setSourceFilter(filter)} className={`rounded-md px-2 py-1 text-[10px] uppercase tracking-wider ${sourceFilter === filter ? "bg-white text-black" : "bg-black text-neutral-400 hover:text-white"}`}>{filter}</button>
            ))}
          </div>
      </div>
      <aside className="absolute left-5 top-28 w-44 rounded-md border border-neutral-800 bg-black p-3 text-xs text-neutral-400">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">Categories</p>
        {[["#d4af37", "Core"], ["#8a7431", "Project"], ["#86868b", "Sources"], ["#f5f5f7", "Memories"]].map(([color, label]) => (
          <div key={label} className="mb-2 flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</div>
        ))}
        <button type="button" onClick={fitGraph} className="mt-2 w-full rounded-md bg-white/10 px-2 py-2 text-xs text-[#f5f5f7] hover:bg-white/15">Reset View</button>
      </aside>
      {context && memories === 0 && !error && <aside className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-md border border-neutral-800 bg-black px-4 py-3 text-center shadow-xl"><p className="text-sm text-neutral-300">No memories found. Ingest some data to see the graph.</p></aside>}
      {context && <p className="absolute bottom-5 left-5 rounded bg-black/80 px-2 py-1 text-xs text-[#86868b]">{memories} memor{memories === 1 ? "y" : "ies"} · {connectionCount} connections</p>}
      {(error || selectedNode) && <aside className="absolute bottom-6 left-6 max-w-md rounded-lg border border-white/10 bg-[#0a0a0a]/95 p-4 shadow-2xl"><p className="text-sm font-medium text-[#f5f5f7]">{error ? "Connection problem" : selectedNode?.label}</p>{error ? <p className="mt-2 text-sm text-[#f5f5f7]">{error}</p> : selectedNode && <div className="mt-2 space-y-2 text-sm leading-6 text-[#86868b]"><p><span className="text-[#f5f5f7]">Source:</span> {selectedNode.source ?? selectedNode.label}</p><p><span className="text-[#f5f5f7]">Project:</span> {selectedNode.projectId ?? context?.project_id ?? "chatgpt"}</p>{selectedNode.timestamp && <p><span className="text-[#f5f5f7]">Time:</span> {new Date(selectedNode.timestamp).toLocaleString()}</p>}<p className="whitespace-pre-line">{selectedNode.content ?? selectedNode.detail}</p><p><span className="text-[#f5f5f7]">Connected memories:</span> {relatedCount}</p></div>}</aside>}
    </section>
  );
}
