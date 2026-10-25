"""Optional local demo seed. Run only against an explicitly running dev backend."""

import json
import os
from datetime import datetime, timedelta, timezone
from urllib.request import Request, urlopen

BASE_URL = os.getenv("SYNRA_BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
WORKSPACE_ID = os.getenv("SYNRA_WORKSPACE_ID", "").strip()
API_KEY = os.getenv("SYNRA_API_KEY", "").strip()
SEED_EVENTS = [
    ("github", "commit", "Refactor authentication middleware", "Reduced token refresh failures."),
    ("github", "pull_request", "Fix authentication flow", "Updated OAuth callback handling."),
    ("slack", "discussion", "Agree on context retention policy", "Keep project context available for 90 days."),
    ("gmail", "decision", "Approve production rollout checklist", "Security review is complete."),
    ("calendar", "meeting", "Synra weekly architecture review", "Review ingestion and graph performance."),
    ("ai", "conversation", "Explain the Synra memory flow", "Memory records are stored and transformed into graph nodes."),
    ("dashboard", "decision", "Use Synra Core as the graph center", "Keep the core separate from memory counts."),
    ("dashboard", "task", "Add empty-state guidance", "Show the Add memory action when no events exist."),
    ("github", "bug", "Resolve stale webhook payloads", "Ignore duplicate delivery IDs."),
    ("slack", "technical_note", "Use stable metadata for integrations", "Persist source and external identifiers."),
    ("gmail", "decision", "Choose local development defaults", "Use the configured Supabase workspace."),
    ("calendar", "task", "Schedule load testing", "Measure graph usability at 100 nodes."),
]


def main() -> None:
    if not WORKSPACE_ID or not API_KEY:
        raise RuntimeError(
            "Set SYNRA_WORKSPACE_ID and a workspace-scoped SYNRA_API_KEY before running the dev seeder."
        )

    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for index, (source, event_type, prompt, response) in enumerate(SEED_EVENTS):
        payload = {
            "source_tool": source,
            "project_id": WORKSPACE_ID,
            "user_prompt": prompt,
            "ai_response": response,
            "event_type": event_type,
            "timestamp": (start + timedelta(hours=index)).isoformat(),
            "metadata": {"seed_id": f"demo-memory-{index + 1:02d}"},
        }
        request = Request(
            f"{BASE_URL}/api/v1/ingest",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "X-API-Key": API_KEY},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            print(response.read().decode("utf-8"))


if __name__ == "__main__":
    main()
