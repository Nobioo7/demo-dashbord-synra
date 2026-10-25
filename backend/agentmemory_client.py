import logging
import os
from pathlib import Path
from typing import Any, Optional
import httpx

logger = logging.getLogger("SynraAgentMemoryClient")

def _configured_agentmemory_url() -> str:
    configured_url = (
        os.getenv("AGENTMEMORY_URL", "").strip()
        or os.getenv("AGENTMEMORY_API_URL", "").strip()
    )
    if configured_url:
        return configured_url.rstrip("/")
    if os.getenv("APP_ENV", "development").strip().lower() == "production":
        return ""
    return "http://localhost:3111"


AGENTMEMORY_API_URL = _configured_agentmemory_url()

REQUEST_TIMEOUT_SECONDS = float(os.getenv("AGENTMEMORY_TIMEOUT_SECONDS", "3.0"))


def _authorization_headers() -> dict[str, str]:
    token = os.getenv("AGENTMEMORY_TOKEN", "").strip()
    if not token:
        secret_path = Path.home() / ".agentmemory" / "secret"
        try:
            token = secret_path.read_text(encoding="utf-8").strip()
        except FileNotFoundError:
            return {}
        except OSError as exc:
            logger.warning("Unable to read AgentMemory token from %s: %s", secret_path, exc)
            return {}

    return {"Authorization": f"Bearer {token}"} if token else {}


def check_agentmemory_online() -> bool:
    """Probes the authenticated AgentMemory health endpoint."""
    if not AGENTMEMORY_API_URL:
        return False
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = client.get(
                f"{AGENTMEMORY_API_URL}/agentmemory/health",
                headers=_authorization_headers(),
            )
            return response.status_code == 200
    except httpx.HTTPError as exc:
        logger.debug("AgentMemory livez probe failed: %s", exc)
        return False


def fetch_agentmemory_export() -> Optional[dict[str, Any]]:
    """Fetches authenticated export data from the local AgentMemory service."""
    if not AGENTMEMORY_API_URL:
        logger.info("AgentMemory URL is not configured.")
        return None
    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS) as client:
            response = client.get(
                f"{AGENTMEMORY_API_URL}/agentmemory/export",
                headers=_authorization_headers(),
            )
            response.raise_for_status()
            data = response.json()
            if isinstance(data, dict):
                return data
            logger.warning("AgentMemory export returned an unexpected JSON shape.")
            return None
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("AgentMemory export request failed: %s", exc)
        return None


def transform_agentmemory_to_graph(
    data: Optional[dict[str, Any]],
    workspace_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Transforms AgentMemory export data into nodes & links required by BrainGraph.
    If data is None (offline), returns a friendly informational graph.
    Only records explicitly associated with the requested workspace are included.
    """
    effective_workspace_id = workspace_id.strip() if workspace_id and workspace_id.strip() else None

    if data is None:
        return {
            "status": "offline",
            "message": "AgentMemory service is unavailable.",
            "project_id": "agentmemory",
            "workspace_id": effective_workspace_id,
            "context_summary": "AgentMemory service is unavailable.",
            "nodes": [
                {
                    "id": "agentmemory-core",
                    "label": "AgentMemory",
                    "group": "core",
                    "detail": "AgentMemory service is offline.",
                    "val": 12,
                },
            ],
            "event_count": 0,
        }

    core_detail = "AgentMemory Workspace Memory Engine"
    if effective_workspace_id:
        core_detail += f" · Workspace: {effective_workspace_id}"

    nodes: list[dict[str, Any]] = [
        {
            "id": "agentmemory-core",
            "label": "AgentMemory",
            "group": "core",
            "detail": core_detail,
            "val": 14,
        }
    ]
    links: list[dict[str, Any]] = []

    sessions = [item for item in data.get("sessions", []) if isinstance(item, dict)] if isinstance(data.get("sessions"), list) else []
    observations = [item for item in data.get("observations", []) if isinstance(item, dict)] if isinstance(data.get("observations"), list) else []
    memories = [item for item in data.get("memories", []) if isinstance(item, dict)] if isinstance(data.get("memories"), list) else []

    def belongs_to_workspace(record: dict[str, Any]) -> bool:
        if not effective_workspace_id:
            return False
        metadata = record.get("metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        values = (
            record.get("workspace_id"),
            record.get("workspaceId"),
            record.get("project_id"),
            record.get("project"),
            metadata.get("workspace_id"),
            metadata.get("workspaceId"),
            metadata.get("project_id"),
            metadata.get("project"),
        )
        return any(str(value).strip() == effective_workspace_id for value in values if value is not None)

    sessions = [session for session in sessions if belongs_to_workspace(session)]
    scoped_session_ids = {
        str(session.get("id", "")).strip()
        for session in sessions
        if str(session.get("id", "")).strip()
    }
    memories = [
        memory for memory in memories
        if belongs_to_workspace(memory)
        or str(memory.get("sessionId", "")).strip() in scoped_session_ids
    ]
    observations = [
        observation for observation in observations
        if belongs_to_workspace(observation)
        or str(observation.get("sessionId", "")).strip() in scoped_session_ids
    ]
    scoped_session_ids.update(
        str(record.get("sessionId", "")).strip()
        for record in [*memories, *observations]
        if str(record.get("sessionId", "")).strip()
    )
    sessions = [
        session for session in sessions
        if str(session.get("id", "")).strip() in scoped_session_ids
    ]

    concept_map: dict[str, list[str]] = {}
    known_session_ids: set[str] = set()

    # Ingest Sessions
    for session in sessions:
        if not isinstance(session, dict):
            continue
        session_id = str(session.get("id", "")).strip()
        if not session_id:
            continue
        node_id = f"session:{session_id}"
        known_session_ids.add(session_id)
        title = session.get("title") or f"Session {session_id[:8]}"
        nodes.append({
            "id": node_id,
            "label": title,
            "group": "source",
            "source": "agentmemory",
            "detail": session.get("description") or f"AgentMemory session {session_id}",
            "val": 8,
            "timestamp": session.get("createdAt"),
        })
        links.append({
            "source": "agentmemory-core",
            "target": node_id,
            "kind": "session",
        })

    # Ingest Long-Term Memories
    for mem in memories:
        if not isinstance(mem, dict):
            continue
        mem_id = str(mem.get("id", "")).strip()
        content = str(mem.get("content", "")).strip()
        if not content:
            continue
        node_id = f"mem:{mem_id or hash(content)}"
        label = (content[:36] + "…") if len(content) > 36 else content
        mem_type = str(mem.get("type", "fact"))

        nodes.append({
            "id": node_id,
            "label": label,
            "group": "memory",
            "event_type": mem_type,
            "source": "agentmemory",
            "detail": content,
            "content": content,
            "val": 6,
            "timestamp": mem.get("createdAt") or mem.get("updatedAt"),
        })

        session_id = str(mem.get("sessionId", "")).strip()
        if session_id and session_id in known_session_ids:
            links.append({
                "source": f"session:{session_id}",
                "target": node_id,
                "kind": "contains",
            })
        else:
            links.append({
                "source": "agentmemory-core",
                "target": node_id,
                "kind": "memory",
            })

        for concept in mem.get("concepts", []):
            if isinstance(concept, str) and concept.strip():
                clean_concept = concept.strip().lower()
                concept_map.setdefault(clean_concept, []).append(node_id)

    # Ingest Compressed Observations
    for obs in observations:
        if not isinstance(obs, dict):
            continue
        obs_id = str(obs.get("id", "")).strip()
        title = str(obs.get("title") or "").strip()
        narrative = str(obs.get("narrative") or "").strip()
        facts = obs.get("facts") if isinstance(obs.get("facts"), list) else []
        detail = narrative or (" ".join(str(f) for f in facts)) or title or "Observation"
        label = title or (detail[:36] + "…")
        node_id = f"obs:{obs_id or hash(detail)}"

        nodes.append({
            "id": node_id,
            "label": label,
            "group": "memory",
            "event_type": str(obs.get("type", "observation")),
            "source": "agentmemory",
            "detail": detail,
            "content": detail,
            "val": 5,
            "timestamp": obs.get("timestamp"),
        })

        session_id = str(obs.get("sessionId", "")).strip()
        if session_id and session_id in known_session_ids:
            links.append({
                "source": f"session:{session_id}",
                "target": node_id,
                "kind": "observed",
            })
        else:
            links.append({
                "source": "agentmemory-core",
                "target": node_id,
                "kind": "observation",
            })

        for concept in obs.get("concepts", []):
            if isinstance(concept, str) and concept.strip():
                clean_concept = concept.strip().lower()
                concept_map.setdefault(clean_concept, []).append(node_id)

    # Concept links between related nodes (limit to 60 edges)
    added_concept_links = 0
    for concept, linked_ids in concept_map.items():
        if len(linked_ids) > 1 and added_concept_links < 60:
            for i in range(min(3, len(linked_ids) - 1)):
                links.append({
                    "source": linked_ids[i],
                    "target": linked_ids[i + 1],
                    "kind": f"concept:{concept}",
                    "score": 0.85,
                })
                added_concept_links += 1

    total_events = len(memories) + len(observations)
    summary = (
        f"AgentMemory active: {len(sessions)} session(s), "
        f"{len(memories)} memory record(s), and {len(observations)} observation(s)."
    )

    return {
        "status": "online",
        "project_id": "agentmemory",
        "context_summary": summary,
        "nodes": nodes,
        "links": links,
        "event_count": total_events,
    }


def get_agentmemory_graph_data(workspace_id: Optional[str] = None) -> dict[str, Any]:
    """Coordinates fetching and transforming AgentMemory data into BrainGraph format."""
    export_data = fetch_agentmemory_export()
    return transform_agentmemory_to_graph(export_data, workspace_id=workspace_id)
