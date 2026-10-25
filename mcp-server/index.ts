import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import axios from "axios";
import { z } from "zod";

const API_BASE = (
  process.env.SYNRA_API_BASE_URL?.trim() || "http://127.0.0.1:8000/api/v1"
).replace(/\/+$/, "");
const SYNRA_API_KEY = process.env.SYNRA_API_KEY?.trim();

if (!SYNRA_API_KEY) {
  throw new Error("SYNRA_API_KEY must be configured before starting the MCP server.");
}

const api = axios.create({
  baseURL: API_BASE,
  timeout: 10_000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-API-Key": SYNRA_API_KEY,
  },
  validateStatus: (status) => status >= 200 && status < 300,
});

const server = new McpServer({
  name: "synra-mcp",
  version: "1.0.0",
});

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError,
  };
}

function formatApiError(error: unknown, action: string): string {
  if (axios.isAxiosError(error)) {
    if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
      return `${action} failed: backend request timed out.`;
    }
    if (!error.response) {
      return `${action} failed: Synra backend is unavailable at ${API_BASE}.`;
    }
    if (error.response.status === 400 || error.response.status === 422) {
      return `${action} failed: invalid request or project_id.`;
    }
    return `${action} failed: Synra backend returned HTTP ${error.response.status}.`;
  }
  return `${action} failed: unexpected MCP/backend error.`;
}

server.tool(
  "get_context",
  "Fetch indexed memory context for a project from the Synra backend.",
  {
    project_id: z
      .string()
      .min(1)
      .describe("Project identifier used when memories were ingested"),
  },
  async ({ project_id }) => {
    try {
      const { data } = await api.get(`/context/${encodeURIComponent(project_id)}`);
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "get_context"), true);
    }
  },
);

server.tool(
  "add_memory",
  "Save a prompt/response memory event to the Synra backend.",
  {
    source_tool: z
      .string()
      .min(1)
      .describe("Origin tool, e.g. chatgpt, claude, cursor"),
    project_id: z.string().min(1).describe("Project identifier to attach this memory to"),
    prompt: z.string().default("").describe("Prompt or captured input"),
    response: z.string().default("").describe("Response or captured output"),
  },
  async ({ source_tool, project_id, prompt, response }) => {
    try {
      const { data } = await api.post("/memory/add", {
        source_tool,
        project_id,
        prompt,
        response,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "add_memory"), true);
    }
  },
);

server.tool(
  "search_memory",
  "Search indexed memories for a project using a text query.",
  {
    project_id: z
      .string()
      .min(1)
      .describe("Project identifier to search within"),
    query: z
      .string()
      .min(1)
      .describe("Search query text"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .default(5)
      .describe("Maximum number of results to return (1-20)"),
  },
  async ({ project_id, query, limit }) => {
    try {
      const { data } = await api.post("/memory/search", {
        project_id,
        query,
        limit,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "search_memory"), true);
    }
  },
);

server.tool(
  "github_sync",
  "Sync GitHub repository data (commits, issues, PRs) into Synra memories.",
  {
    project_id: z
      .string()
      .min(1)
      .default("chatgpt")
      .describe("Project identifier to attach synced memories to"),
  },
  async ({ project_id }) => {
    try {
      const { data } = await api.post("/integrations/github/sync", {
        project_id,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "github_sync"), true);
    }
  },
);

server.tool(
  "gmail_sync",
  "Sync recent Gmail messages into Synra memories.",
  {
    project_id: z
      .string()
      .min(1)
      .default("chatgpt")
      .describe("Project identifier to attach synced memories to"),
  },
  async ({ project_id }) => {
    try {
      const { data } = await api.post("/integrations/gmail/sync", {
        project_id,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "gmail_sync"), true);
    }
  },
);

server.tool(
  "memory_recall",
  "AgentMemory-compatible recall: Search stored memories and observations for relevant context.",
  {
    query: z.string().min(1).describe("Search query (keywords, concepts, code symbols)"),
    project: z.string().default("demo").describe("Target project identifier"),
    limit: z.number().int().min(1).max(50).default(10).describe("Max results (default 10)"),
    format: z.enum(["full", "compact", "narrative"]).default("full").describe("Output format"),
    targetLayer: z.string().default("all").describe("Search layer: all, memory, or observation"),
    agentId: z.string().optional().describe("Filter by owning agent identity"),
  },
  async ({ query, project, limit, format, targetLayer, agentId }) => {
    try {
      const { data } = await api.post("/memory/recall", {
        query,
        project,
        limit,
        format,
        targetLayer,
        agentId,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "memory_recall"), true);
    }
  },
);

server.tool(
  "memory_save",
  "AgentMemory-compatible save: Persist an insight, decision, pattern, or bug to long-term memory.",
  {
    content: z.string().min(1).describe("The insight or decision to remember"),
    type: z
      .string()
      .default("pattern")
      .describe("Memory type: pattern, preference, architecture, bug, workflow, fact"),
    concepts: z.string().default("").describe("Comma-separated key concepts"),
    files: z.string().default("").describe("Comma-separated relevant file paths"),
    project: z.string().default("demo").describe("Target project identifier"),
    agentId: z.string().optional().describe("Agent identity to scope memory to"),
  },
  async ({ content, type, concepts, files, project, agentId }) => {
    try {
      const { data } = await api.post("/memory/save", {
        content,
        type,
        concepts,
        files,
        project,
        agentId,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "memory_save"), true);
    }
  },
);

server.tool(
  "memory_smart_search",
  "AgentMemory-compatible hybrid semantic+keyword search across indexed memory nodes.",
  {
    query: z.string().min(1).describe("Search query"),
    project: z.string().default("demo").describe("Target project identifier"),
    limit: z.number().int().min(1).max(50).default(10).describe("Max results"),
    targetLayer: z.string().default("all").describe("Search layer: all, memory, or observation"),
    agentId: z.string().optional().describe("Filter by agent identity"),
  },
  async ({ query, project, limit, targetLayer, agentId }) => {
    try {
      const { data } = await api.post("/memory/smart_search", {
        query,
        project,
        limit,
        targetLayer,
        agentId,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "memory_smart_search"), true);
    }
  },
);

server.tool(
  "memory_file_history",
  "AgentMemory-compatible history: Retrieve past observations and changes for specific files.",
  {
    files: z.string().min(1).describe("Comma-separated file paths to search for"),
    project: z.string().default("demo").describe("Target project identifier"),
  },
  async ({ files, project }) => {
    try {
      const { data } = await api.post("/memory/file_history", {
        files,
        project,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "memory_file_history"), true);
    }
  },
);

server.tool(
  "memory_sessions",
  "AgentMemory-compatible sessions: List recent memory events and ingest sessions.",
  {
    project: z.string().default("demo").describe("Target project identifier"),
    limit: z.number().int().min(1).max(100).default(20).describe("Max sessions to return"),
  },
  async ({ project, limit }) => {
    try {
      const { data } = await api.get(`/memory/sessions?project=${encodeURIComponent(project)}&limit=${limit}`);
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "memory_sessions"), true);
    }
  },
);

server.tool(
  "agentmemory_bridge",
  "Bridge memory events between AgentMemory and Synra OS Gateway.",
  {
    action: z.enum(["sync", "export"]).default("sync").describe("Sync memories in or export memories out"),
    project_id: z.string().default("demo").describe("Target project identifier"),
    memories: z.array(z.record(z.string(), z.any())).default([]).describe("Memories to import when action is sync"),
  },
  async ({ action, project_id, memories }) => {
    try {
      const { data } = await api.post("/agentmemory/bridge", {
        action,
        project_id,
        memories,
      });
      return textResult(JSON.stringify(data, null, 2));
    } catch (error) {
      return textResult(formatApiError(error, "agentmemory_bridge"), true);
    }
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`Synra MCP server connected (stdio) -> ${API_BASE}`);
}

main().catch((error) => {
  console.error("Synra MCP server failed to start:", error);
  process.exit(1);
});
