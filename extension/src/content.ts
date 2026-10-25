import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
  ],
  run_at: "document_idle",
}

const MAX_TEXT_LENGTH = 100_000

type AddMemoryPayload = {
  project_id: string
  source_tool: "chrome-extension"
  event_type: "capture"
  prompt: string
  response: ""
  metadata: { capture_method: "manual" }
}

type AddMemoryWorkerResponse =
  | { ok: true; data: { message?: string } }
  | { ok: false; error: string }

type SynraWindow = Window & { __synraManualCaptureUiInstalled?: boolean }

function sendMemoryToServiceWorker(payload: AddMemoryPayload): Promise<AddMemoryWorkerResponse> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "SYNRA_ADD_MEMORY", payload },
      (response: AddMemoryWorkerResponse | undefined) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ ok: false, error: "Unable to reach Synra backend." })
          return
        }
        resolve(response)
      },
    )
  })
}

function installManualCaptureUi(): void {
  const pageWindow = window as SynraWindow
  if (pageWindow.__synraManualCaptureUiInstalled || !document.documentElement) {
    return
  }
  pageWindow.__synraManualCaptureUiInstalled = true

  const host = document.createElement("div")
  host.style.position = "fixed"
  host.style.zIndex = "2147483647"
  host.style.right = "20px"
  host.style.bottom = "20px"
  document.documentElement.appendChild(host)

  const root = host.attachShadow({ mode: "closed" })
  const style = document.createElement("style")
  style.textContent = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: Arial, sans-serif; }
    button, input, textarea { font: inherit; }
    .shell { color: #e2e8f0; }
    .trigger, .save { border: 1px solid #0891b2; border-radius: 8px; background: #083344; color: #cffafe; cursor: pointer; padding: 9px 12px; }
    .trigger:hover, .save:hover { background: #0e7490; }
    .panel { display: none; width: 320px; margin-bottom: 8px; padding: 14px; border: 1px solid #334155; border-radius: 10px; background: #0f172a; box-shadow: 0 12px 30px rgba(0,0,0,.35); }
    .panel.open { display: block; }
    .title { margin: 0 0 10px; font-size: 14px; font-weight: 600; }
    label { display: block; margin: 8px 0 4px; color: #94a3b8; font-size: 11px; }
    input, textarea { width: 100%; border: 1px solid #334155; border-radius: 6px; background: #020617; color: #f8fafc; padding: 8px; font-size: 12px; }
    textarea { min-height: 92px; resize: vertical; }
    .status { min-height: 16px; margin: 8px 0 0; color: #94a3b8; font-size: 11px; }
    .status.error { color: #fda4af; }
    .status.success { color: #86efac; }
  `
  root.appendChild(style)

  const shell = document.createElement("div")
  shell.className = "shell"

  const panel = document.createElement("div")
  panel.className = "panel"

  const title = document.createElement("div")
  title.className = "title"
  title.textContent = "Save context to Synra"

  const projectLabel = document.createElement("label")
  projectLabel.textContent = "Project ID"
  const projectInput = document.createElement("input")
  projectInput.value = "chatgpt"
  projectInput.required = true
  projectLabel.appendChild(projectInput)

  const textLabel = document.createElement("label")
  textLabel.textContent = "Memory text"
  const textInput = document.createElement("textarea")
  textInput.maxLength = MAX_TEXT_LENGTH
  textInput.placeholder = "Enter or paste text you want to save"
  textInput.required = true
  textLabel.appendChild(textInput)

  const save = document.createElement("button")
  save.className = "save"
  save.type = "button"
  save.textContent = "Save memory"

  const status = document.createElement("div")
  status.className = "status"
  panel.append(title, projectLabel, textLabel, save, status)

  const trigger = document.createElement("button")
  trigger.className = "trigger"
  trigger.type = "button"
  trigger.textContent = "Add memory"
  trigger.addEventListener("click", () => {
    panel.classList.add("open")
    textInput.focus()
  })
  shell.append(panel, trigger)
  root.appendChild(shell)

  function setStatus(message: string, kind = ""): void {
    status.textContent = message
    status.className = `status ${kind}`.trim()
  }

  save.addEventListener("click", async () => {
    const projectId = projectInput.value.trim()
    const memoryText = textInput.value.trim()
    if (!projectId) {
      setStatus("Enter a project ID.", "error")
      return
    }
    if (!memoryText) {
      setStatus("Enter text before saving.", "error")
      return
    }

    save.disabled = true
    setStatus("Saving…")
    try {
      const response = await sendMemoryToServiceWorker({
        project_id: projectId,
        source_tool: "chrome-extension",
        event_type: "capture",
        prompt: memoryText,
        response: "",
        metadata: { capture_method: "manual" },
      })
      if (!response.ok) {
        throw new Error(response.error)
      }
      textInput.value = ""
      setStatus(response.data.message || "Memory saved.", "success")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to reach Synra backend.", "error")
    } finally {
      save.disabled = false
    }
  })
}

installManualCaptureUi()
