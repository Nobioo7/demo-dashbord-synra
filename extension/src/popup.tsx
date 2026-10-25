import { useEffect, useState, type FormEvent } from "react"

export default function Popup() {
  const [apiKey, setApiKey] = useState("")
  const [configured, setConfigured] = useState(false)
  const [status, setStatus] = useState("")

  useEffect(() => {
    void chrome.storage.local.get("synraApiKey").then((stored) => {
      setConfigured(typeof stored.synraApiKey === "string" && stored.synraApiKey.length > 0)
    })
  }, [])

  async function saveKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = apiKey.trim()
    if (!value) {
      setStatus("Paste your Synra API key first.")
      return
    }
    await chrome.storage.local.set({ synraApiKey: value })
    setApiKey("")
    setConfigured(true)
    setStatus("API key saved on this device.")
  }

  async function clearKey() {
    await chrome.storage.local.remove("synraApiKey")
    setApiKey("")
    setConfigured(false)
    setStatus("API key removed.")
  }

  return (
    <main style={{ width: 300, padding: 16, color: "#e2e8f0", background: "#0f172a", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ margin: "0 0 12px", fontSize: 16 }}>Synra settings</h1>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#94a3b8" }}>
        {configured ? "An API key is saved on this device." : "Save your API key to enable memory capture."}
      </p>
      <form onSubmit={saveKey}>
        <label htmlFor="synra-api-key" style={{ display: "block", marginBottom: 6, fontSize: 12 }}>
          Synra API key
        </label>
        <input
          id="synra-api-key"
          type="password"
          autoComplete="off"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          style={{ boxSizing: "border-box", width: "100%", padding: 8, color: "#f8fafc", background: "#020617", border: "1px solid #334155", borderRadius: 4 }}
        />
        <button type="submit" style={{ marginTop: 10, padding: "7px 10px", color: "#cffafe", background: "#083344", border: "1px solid #0891b2", borderRadius: 4 }}>
          Save key
        </button>
        {configured && (
          <button type="button" onClick={() => void clearKey()} style={{ marginTop: 10, marginLeft: 8, padding: "7px 10px", color: "#e2e8f0", background: "#1e293b", border: "1px solid #475569", borderRadius: 4 }}>
            Clear key
          </button>
        )}
      </form>
      <p role="status" style={{ minHeight: 16, margin: "10px 0 0", fontSize: 12, color: "#86efac" }}>{status}</p>
    </main>
  )
}
