const API_BASE_URL = (
  process.env.PLASMO_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:8000"
).replace(/\/+$/, "")
const ADD_MEMORY_URL = `${API_BASE_URL}/api/v1/memory/add`
const REQUEST_TIMEOUT_MS = 10_000

type AddMemoryMessage = {
  type: "SYNRA_ADD_MEMORY"
  payload: {
    project_id: string
    source_tool: "chrome-extension"
    event_type: "capture"
    prompt: string
    response: string
    metadata: Record<string, string>
  }
}

type AddMemoryResponse =
  | { ok: true; data: { message?: string } }
  | { ok: false; error: string }

chrome.runtime.onMessage.addListener(
  (
    message: AddMemoryMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: AddMemoryResponse) => void,
  ) => {
    if (!message || message.type !== "SYNRA_ADD_MEMORY") {
      return false
    }

    void addMemory(message.payload)
      .then(sendResponse)
      .catch(() => sendResponse({ ok: false, error: "Unable to reach Synra backend." }))
    return true
  },
)

async function addMemory(payload: AddMemoryMessage["payload"]): Promise<AddMemoryResponse> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const stored = await chrome.storage.local.get("synraApiKey")
    const apiKey = typeof stored.synraApiKey === "string" ? stored.synraApiKey.trim() : ""
    if (!apiKey) {
      return { ok: false, error: "Set your Synra API key in the extension popup before saving." }
    }

    const result = await fetch(ADD_MEMORY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!result.ok) {
      if (result.status === 401) {
        return { ok: false, error: "Synra API key was rejected. Check it in the extension popup." }
      }
      if (result.status === 400 || result.status === 422) {
        return { ok: false, error: "The project ID or captured text is invalid." }
      }
      return { ok: false, error: `Synra backend returned HTTP ${result.status}.` }
    }

    const data = (await result.json()) as { message?: string }
    return { ok: true, data }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return { ok: false, error: "Synra backend request timed out." }
    }
    return { ok: false, error: "Unable to reach Synra backend." }
  } finally {
    clearTimeout(timeout)
  }
}
