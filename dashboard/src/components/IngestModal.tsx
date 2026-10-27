"use client";

import { FormEvent, useState } from "react";

const API_BASE_URL = "/backend";

type IngestModalProps = {
  projectId?: string;
  triggerLabel?: string;
  onIngested: () => void;
};

export default function IngestModal({
  projectId = "chatgpt",
  triggerLabel = "Add memory",
  onIngested,
}: IngestModalProps) {
  const [open, setOpen] = useState(false);
  const [sourceTool, setSourceTool] = useState("dashboard");
  const [activeProjectId, setActiveProjectId] = useState(projectId);
  const [eventType, setEventType] = useState("memory");
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const targetProject = activeProjectId.trim() || projectId || "chatgpt";
    try {
      const result = await fetch(`${API_BASE_URL}/api/v1/memory/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_tool: sourceTool,
          project_id: targetProject,
          event_type: eventType,
          prompt,
          response,
        }),
      });
      if (!result.ok) {
        throw new Error(`Backend returned ${result.status}`);
      }
      setPrompt("");
      setResponse("");
      setOpen(false);
      onIngested();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to save memory");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors duration-200 hover:bg-neutral-200"
      >
        {triggerLabel}
      </button>
      {open && (
        <div className="pointer-events-auto fixed inset-0 z-10 grid place-items-center bg-black/80 p-4">
          <form
            onSubmit={submit}
            className="glass-panel w-full max-w-lg space-y-4 rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Add memory</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white" aria-label="Close">
                ×
              </button>
            </div>
            <input value={activeProjectId} onChange={(event) => setActiveProjectId(event.target.value)} placeholder="Project ID" required className="w-full rounded-md border border-neutral-800 bg-black p-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500" />
            <input value={sourceTool} onChange={(event) => setSourceTool(event.target.value)} placeholder="Source tool" required className="w-full rounded-md border border-neutral-800 bg-black p-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500" />
            <input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Event type" required className="w-full rounded-md border border-neutral-800 bg-black p-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500" />
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Prompt or memory" rows={4} className="w-full rounded-md border border-neutral-800 bg-black p-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500" />
            <textarea value={response} onChange={(event) => setResponse(event.target.value)} placeholder="Response (optional)" rows={4} className="w-full rounded-md border border-neutral-800 bg-black p-2 text-sm text-white placeholder:text-neutral-500 focus:border-neutral-500" />
            {error && <p className="text-sm text-[#f5f5f7]">{error}</p>}
            <button type="submit" disabled={saving} className="w-full rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-50">
              {saving ? "Saving…" : "Save memory"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
