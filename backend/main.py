from datetime import datetime, timezone
import asyncio
import base64
import binascii
import hashlib
import hmac
import json
import os
from pathlib import Path
from typing import Any, Optional
import logging
import re
import secrets
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from dotenv import load_dotenv
import uvicorn
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import AliasChoices, BaseModel, EmailStr, Field, field_validator
from supabase import Client

if __package__:
    from .database import get_supabase_client
else:
    from database import get_supabase_client

if __package__:
    from .agentmemory_bridge import router as agentmemory_router
else:
    from agentmemory_bridge import router as agentmemory_router


load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("SynraBackend")

MAX_PAYLOAD_BYTES = 10 * 1024 * 1024
MAX_DATABASE_PAGE_SIZE = 1000
MAX_GRAPH_EVENTS = 200
CONTEXT_EVENT_LIMIT = 20
WAITLIST_RATE_LIMIT_WINDOW_SECONDS = 60
WAITLIST_RATE_LIMIT_MAX_REQUESTS = 5
WAITLIST_REQUESTS_BY_IP: dict[str, list[datetime]] = {}
WAITLIST_RATE_LIMIT_LOCK = threading.Lock()
BACKEND_DIR = Path(__file__).resolve().parent
GITHUB_API_URL = "https://api.github.com"
GITHUB_REQUEST_TIMEOUT_SECONDS = 10
GITHUB_ACTIVITY_LIMIT = 5
GITHUB_CODE_PATH_LIMIT = 8
GITHUB_CODE_FILE_MAX_CHARS = 12_000
DEFAULT_GITHUB_CODE_PATHS = (
    "README.md",
    "backend/main.py",
    "dashboard/src/app/page.tsx",
)
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()
GITHUB_OWNER = os.getenv("GITHUB_OWNER", "").strip()
GITHUB_REPO = os.getenv("GITHUB_REPO", "").strip()
GITHUB_SYNC_MODE = os.getenv("GITHUB_SYNC_MODE", "auto").strip().lower()
if GITHUB_SYNC_MODE not in {"auto", "live", "mock"}:
    raise RuntimeError("GITHUB_SYNC_MODE must be one of: auto, live, mock.")
GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1/users/me"
GMAIL_REQUEST_TIMEOUT_SECONDS = 10
GMAIL_SYNC_LIMIT = 5
GMAIL_CLIENT_ID = os.getenv("GMAIL_CLIENT_ID", "").strip()
GMAIL_CLIENT_SECRET = os.getenv("GMAIL_CLIENT_SECRET", "").strip()
GMAIL_REFRESH_TOKEN = os.getenv("GMAIL_REFRESH_TOKEN", "").strip()
GMAIL_TOKEN = os.getenv("GMAIL_TOKEN", "").strip()

PASSWORD_VALUE_PATTERN = re.compile(
    r"(?i)((?:password|passwd|pwd|passphrase|secret)\s*[:=]\s*)([^\s,;\"']+)",
)
JSON_PASSWORD_PATTERN = re.compile(
    r'(?i)(["\'](?:password|passwd|pwd|passphrase|secret)["\']\s*:\s*["\'])([^"\']+)(["\'])',
)

app = FastAPI(title="Synra OS Gateway V1", version="1.0.0")
app.include_router(agentmemory_router, prefix="")
SYNRA_SESSION_SECRET = os.getenv("SYNRA_SESSION_SECRET", "").strip()
AUTH_EXEMPT_PATHS = {
    "/health",
    "/openapi.json",
    "/docs",
    "/docs/oauth2-redirect",
    "/redoc",
    "/api/v1/waitlist",
}


def unauthorized_response() -> JSONResponse:
    return JSONResponse(status_code=401, content={"detail": "Unauthorized"})


def database_unavailable() -> HTTPException:
    return HTTPException(status_code=503, detail="Supabase database is not configured.")


def require_supabase() -> Client:
    if supabase is None:
        raise database_unavailable()
    return supabase


def valid_session_identity(request: Request) -> Optional[str]:
    user_id = request.headers.get("x-synra-user-id", "").strip()
    timestamp = request.headers.get("x-synra-auth-timestamp", "").strip()
    signature = request.headers.get("x-synra-auth-signature", "").strip()
    if not any((user_id, timestamp, signature)):
        return None
    if not user_id or not timestamp or not signature or not SYNRA_SESSION_SECRET:
        return None
    try:
        signed_at = int(timestamp)
    except ValueError:
        return None
    if abs(int(time.time()) - signed_at) > 60:
        return None
    message = f"{user_id}\n{timestamp}".encode("utf-8")
    expected = hmac.new(
        SYNRA_SESSION_SECRET.encode("utf-8"),
        message,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, signature):
        return None
    return user_id


def resolve_api_key(api_key: str) -> dict[str, str]:
    client = require_supabase()
    key_hash = hashlib.sha256(api_key.encode("utf-8")).hexdigest()
    try:
        result = (
            client.table("api_keys")
            .update({"last_used_at": datetime.now(timezone.utc).isoformat()})
            .eq("key_hash", key_hash)
            .is_("revoked_at", "null")
            .select("owner_id,workspace_id")
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.error("API key validation failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail="Unable to validate API key.") from exc
    if not result.data:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")
    return {
        "user_id": str(result.data[0]["owner_id"]),
        "workspace_id": str(result.data[0]["workspace_id"]),
    }


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if request.url.path in AUTH_EXEMPT_PATHS:
        return await call_next(request)

    api_key = request.headers.get("x-api-key")
    user_id = valid_session_identity(request)
    has_session_headers = any(
        request.headers.get(header)
        for header in (
            "x-synra-user-id",
            "x-synra-auth-timestamp",
            "x-synra-auth-signature",
        )
    )
    if user_id is not None:
        request.state.auth_type = "web"
        request.state.user_id = user_id
        request.state.workspace_id = None
    elif has_session_headers:
        return unauthorized_response()
    elif api_key:
        try:
            identity = resolve_api_key(api_key.strip())
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        request.state.auth_type = "api_key"
        request.state.user_id = identity["user_id"]
        request.state.workspace_id = identity["workspace_id"]
    else:
        authorization = request.headers.get("authorization")
        if authorization:
            return unauthorized_response()
        return unauthorized_response()

    request.app.state.supabase = supabase
    return await call_next(request)

configured_origins = [
    origin.strip().rstrip("/")
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
if os.getenv("APP_ENV", "development").strip().lower() == "development":
    configured_origins.extend(
        [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "http://127.0.0.1:3001",
        ]
    )
frontend_url = os.getenv("FRONTEND_URL", "").strip().rstrip("/")
if frontend_url:
    configured_origins.append(frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(set(configured_origins)),
    allow_origin_regex=r"^chrome-extension://[a-p]{32}$",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynraEvent(BaseModel):
    source_tool: str = Field(..., min_length=1, max_length=128)
    project_id: str = Field(..., min_length=1, max_length=256)
    user_prompt: str = Field(default="", max_length=100_000)
    ai_response: str = Field(default="", max_length=100_000)
    event_type: str = Field(default="memory", max_length=64)
    timestamp: Optional[datetime] = None
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("source_tool", "project_id", "event_type", mode="before")
    @classmethod
    def strip_required_strings(cls, value: Any) -> Any:
        if isinstance(value, str):
            return value.strip()
        return value


class MemoryAddRequest(BaseModel):
    project_id: str = Field(
        default="demo",
        min_length=1,
        max_length=256,
        validation_alias=AliasChoices("project_id", "project"),
    )
    source_tool: str = Field(
        default="dashboard",
        min_length=1,
        max_length=128,
        validation_alias=AliasChoices("source_tool", "source"),
    )
    event_type: str = Field(default="memory", max_length=64)
    prompt: str = Field(default="", max_length=100_000)
    response: str = Field(default="", max_length=100_000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("project_id", "source_tool", "event_type", mode="before")
    @classmethod
    def strip_strings(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class WaitlistRequest(BaseModel):
    email: EmailStr
    source: str = "landing"


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=64)

    @field_validator("name", mode="before")
    @classmethod
    def strip_workspace_name(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class WorkspaceKeyRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1, max_length=64)
    name: str = Field(default="MCP / Chrome Extension", min_length=1, max_length=80)

    @field_validator("workspace_id", "name", mode="before")
    @classmethod
    def strip_api_key_fields(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class MemoryRecord(BaseModel):
    source_tool: str
    event_type: str
    user_prompt: str
    ai_response: str
    timestamp: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestResponse(BaseModel):
    status: str
    message: str
    project_id: str
    event_id: int
    nodes_created: int
    redacted: bool


class ContextResponse(BaseModel):
    project_id: str
    context_summary: str
    active_decisions: list[str]
    recent_events: list[MemoryRecord]
    event_count: int
    nodes: list[dict[str, Any]]
    links: list[dict[str, Any]]


class MemorySearchRequest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=256)
    query: str = Field(default="", max_length=100_000)
    limit: int = Field(default=5, ge=1, le=20)

    @field_validator("project_id", "query", mode="before")
    @classmethod
    def strip_search_strings(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class MemorySearchResult(BaseModel):
    event_id: str
    score: float
    source_tool: str
    prompt: str
    response: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class MemorySearchResponse(BaseModel):
    project_id: str
    query: str
    results: list[MemorySearchResult]


class GitHubSyncResponse(BaseModel):
    status: str
    synced_count: int
    project_id: str
    source_tool: str
    repositories: int
    commits: int
    issues: int
    pull_requests: int
    code_files: int
    memories_created: int
    last_run_at: str
    items_ingested: int


class GitHubSyncRequest(BaseModel):
    project_id: str = Field(default="chatgpt", min_length=1, max_length=256)
    include_code: bool = False
    code_paths: list[str] = Field(default_factory=list, max_length=GITHUB_CODE_PATH_LIMIT)

    @field_validator("project_id", mode="before")
    @classmethod
    def strip_project_id(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value

    @field_validator("code_paths")
    @classmethod
    def validate_code_paths(cls, value: list[str]) -> list[str]:
        validated: list[str] = []
        for path in value:
            normalized = path.strip().replace("\\", "/")
            if not normalized or normalized.startswith("/") or ".." in normalized.split("/"):
                raise ValueError("code_paths must contain relative repository file paths.")
            if normalized not in validated:
                validated.append(normalized)
        return validated


class GmailSyncResponse(BaseModel):
    status: str
    project_id: str
    source_tool: str
    messages_synced: int
    threads_synced: int
    memories_created: int
    last_run_at: str
    items_ingested: int


class GitHubAPIError(RuntimeError):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


class GmailSyncRequest(BaseModel):
    project_id: str = Field(default="chatgpt", min_length=1, max_length=256)

    @field_validator("project_id", mode="before")
    @classmethod
    def strip_project_id(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class AgentMemorySaveRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=100_000)
    type: str = Field(default="pattern", max_length=64)
    concepts: str = Field(default="", max_length=10_000)
    files: str = Field(default="", max_length=10_000)
    project: str = Field(default="demo", min_length=1, max_length=256)
    agentId: Optional[str] = Field(default=None, max_length=128)

    @field_validator("project", "type", mode="before")
    @classmethod
    def strip_agentmemory_strings(cls, value: Any) -> Any:
        return value.strip() if isinstance(value, str) else value


class AgentMemoryRecallRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=100_000)
    project: str = Field(default="demo", min_length=1, max_length=256)
    limit: int = Field(default=10, ge=1, le=50)
    format: str = Field(default="full", max_length=32)
    token_budget: Optional[int] = None
    targetLayer: str = Field(default="all", max_length=32)
    agentId: Optional[str] = None


class AgentMemoryFileHistoryRequest(BaseModel):
    files: str = Field(..., min_length=1)
    project: str = Field(default="demo", min_length=1, max_length=256)
    sessionId: Optional[str] = None


class AgentMemoryBridgeRequest(BaseModel):
    action: str = Field(default="sync", max_length=32)
    project_id: str = Field(default="demo", min_length=1, max_length=256)
    memories: list[dict[str, Any]] = Field(default_factory=list)



supabase: Client | None = get_supabase_client()


def redact_passwords(text: str) -> tuple[str, bool]:
    if not text:
        return text, False
    redacted, json_count = JSON_PASSWORD_PATTERN.subn(r"\1[REDACTED_SECRET]\3", text)
    redacted, kv_count = PASSWORD_VALUE_PATTERN.subn(r"\1[REDACTED_SECRET]", redacted)
    return redacted, (json_count + kv_count) > 0


def isolate_error(status_code: int, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"success": False, "message": message},
    )


def create_memory_record(
    source_tool: str,
    event_type: str,
    prompt: str,
    response: str,
    metadata: dict[str, Any],
    occurred_at: Optional[datetime] = None,
) -> tuple[MemoryRecord, bool]:
    cleaned_prompt, prompt_redacted = redact_passwords(prompt)
    cleaned_response, response_redacted = redact_passwords(response)
    return (
        MemoryRecord(
            source_tool=source_tool,
            event_type=event_type,
            user_prompt=cleaned_prompt,
            ai_response=cleaned_response,
            timestamp=(occurred_at or datetime.now(timezone.utc)).isoformat(),
            metadata=metadata,
        ),
        prompt_redacted or response_redacted,
    )


def execute_database_query(query: Any) -> Any:
    try:
        return query.execute()
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Supabase query failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail="Supabase database operation failed.") from exc


def resolve_workspace_id(request: Request, requested_id: str) -> str:
    normalized_id = requested_id.strip()
    if not normalized_id:
        raise HTTPException(status_code=400, detail="workspace_id is required.")

    auth_type = getattr(request.state, "auth_type", None)
    if auth_type == "api_key":
        bound_workspace_id = str(request.state.workspace_id)
        if normalized_id != bound_workspace_id:
            raise HTTPException(status_code=403, detail="API key is not authorized for this workspace.")
        return bound_workspace_id

    if auth_type != "web":
        raise HTTPException(status_code=401, detail="Unauthorized.")
    try:
        normalized_id = str(UUID(normalized_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Workspace not found.") from exc
    result = execute_database_query(
        require_supabase()
        .table("workspaces")
        .select("id")
        .eq("id", normalized_id)
        .eq("owner_id", request.state.user_id)
        .limit(1)
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return str(result.data[0]["id"])


def resolve_project_workspace(request: Request, project_id: str) -> str:
    normalized_project_id = project_id.strip()
    if not normalized_project_id:
        raise HTTPException(status_code=400, detail="project_id is required.")
    if getattr(request.state, "auth_type", None) == "api_key":
        return str(request.state.workspace_id)
    return resolve_workspace_id(request, normalized_project_id)


def read_workspace_rows(
    workspace_id: str,
    project_id: Optional[str] = None,
    include_deleted: bool = False,
) -> list[dict[str, Any]]:
    client = require_supabase()
    rows: list[dict[str, Any]] = []
    start = 0
    while True:
        query = (
            client.table("memories")
            .select("*")
            .eq("workspace_id", workspace_id)
        )
        if project_id is not None:
            query = query.eq("project_id", project_id)
        if not include_deleted:
            query = query.eq("is_deleted", False)
        result = execute_database_query(
            query.order("created_at", desc=True)
            .range(start, start + MAX_DATABASE_PAGE_SIZE - 1)
        )
        page = result.data or []
        rows.extend(page)
        if len(page) < MAX_DATABASE_PAGE_SIZE:
            return rows
        start += MAX_DATABASE_PAGE_SIZE


def memory_browser_item(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "content": row.get("content") or "\n\n".join(
            part for part in (
                str(row.get("prompt", "")).strip(),
                str(row.get("response", "")).strip(),
            ) if part
        ),
        "prompt": row.get("prompt", ""),
        "response": row.get("response", ""),
        "source": row.get("source", "unknown"),
        "event_type": row.get("event_type", "memory"),
        "created_at": row.get("created_at", ""),
        "workspace_id": str(row.get("workspace_id", "")),
        "project_id": row.get("project_id", ""),
        "metadata": row.get("metadata") or {},
    }


def memory_record_from_row(row: dict[str, Any]) -> MemoryRecord:
    return MemoryRecord(
        source_tool=str(row.get("source", "unknown")),
        event_type=str(row.get("event_type", "memory")),
        user_prompt=str(row.get("prompt", "")),
        ai_response=str(row.get("response", "")),
        timestamp=str(row.get("created_at", "")),
        metadata=row.get("metadata") or {},
    )


def build_graph(
    project_id: str,
    rows: list[dict[str, Any]],
    summary: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    project_id_key = f"project:{project_id}"
    nodes: list[dict[str, Any]] = [
        {"id": project_id_key, "label": project_id, "group": "project", "detail": summary, "val": 8}
    ]
    links: list[dict[str, Any]] = []
    source_ids: set[str] = set()

    graph_rows = list(reversed(rows[:MAX_GRAPH_EVENTS]))
    events = [memory_record_from_row(row) for row in graph_rows]
    memory_ids = [f"memory:{row['id']}" for row in graph_rows]
    for index, event in enumerate(events):
        source_id = f"source:{event.source_tool}"
        if source_id not in source_ids:
            source_ids.add(source_id)
            nodes.append({
                "id": source_id,
                "label": event.source_tool,
                "group": "source",
                "detail": f"Memory source: {event.source_tool}",
                "val": 5,
            })
            links.append({"source": project_id_key, "target": source_id})

        memory_id = memory_ids[index]
        nodes.append({
            "id": memory_id,
            "label": (event.user_prompt or event.ai_response or event.event_type)[:42],
            "group": "memory",
            "source": event.source_tool,
            "timestamp": event.timestamp,
            "projectId": project_id,
            "event_type": event.event_type,
            "detail": f"{event.event_type} · {event.timestamp}\n\nPrompt: {event.user_prompt}\n\nResponse: {event.ai_response}",
            "val": 3,
        })
        links.append({"source": source_id, "target": memory_id})

    token_sets = [
        set(re.findall(r"\w+", f"{event.user_prompt} {event.ai_response}".casefold()))
        for event in events
    ]
    for index, source_tokens in enumerate(token_sets):
        for target_index in range(index + 1, len(token_sets)):
            if events[index].source_tool == events[target_index].source_tool:
                continue
            target_tokens = token_sets[target_index]
            union = source_tokens | target_tokens
            score = len(source_tokens & target_tokens) / len(union) if union else 0
            if score >= 0.25:
                links.append({
                    "source": memory_ids[index],
                    "target": memory_ids[target_index],
                    "kind": "similarity",
                    "score": round(score, 3),
                })

    return nodes, links


def read_project_events(workspace_id: str, project_id: str) -> list[MemoryRecord]:
    return [
        memory_record_from_row(row)
        for row in read_workspace_rows(workspace_id, project_id)
    ]


def search_project_memories(
    workspace_id: str,
    project_id: str,
    query: str,
    limit: int,
) -> list[MemorySearchResult]:
    normalized_query = query.casefold().strip()
    if not normalized_query:
        return []

    query_tokens = set(re.findall(r"\w+", normalized_query))
    if not query_tokens:
        return []

    rows = read_workspace_rows(workspace_id, project_id)
    ranked: list[tuple[float, dict[str, Any]]] = []
    for row in rows:
        searchable = " ".join(
            str(row.get(field, ""))
            for field in ("prompt", "response", "event_type", "source", "content")
        ).casefold()
        searchable += " " + json.dumps(row.get("metadata") or {}, sort_keys=True, default=str).casefold()
        memory_tokens = set(re.findall(r"\w+", searchable))
        overlap = query_tokens & memory_tokens
        if not overlap:
            continue
        score = len(overlap) / len(query_tokens)
        ranked.append((score, row))

    ranked.sort(key=lambda item: (item[0], str(item[1].get("created_at", ""))), reverse=True)
    return [
        MemorySearchResult(
            event_id=str(row["id"]),
            score=round(score, 3),
            source_tool=str(row.get("source", "")),
            prompt=str(row.get("prompt", "")),
            response=str(row.get("response", "")),
            metadata=row.get("metadata") or {},
        )
        for score, row in ranked[:limit]
    ]


def memory_id_for_record(workspace_id: str, project_id: str, record: MemoryRecord) -> str:
    seed_id = record.metadata.get("seed_id")
    return (
        str(uuid5(NAMESPACE_URL, f"synra:{workspace_id}:{project_id}:{seed_id}"))
        if isinstance(seed_id, str)
        else str(uuid4())
    )


def record_sync_run(
    workspace_id: str,
    project_id: str,
    source_tool: str,
    items_ingested: int,
) -> str:
    last_run_at = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid5(NAMESPACE_URL, f"synra-sync:{workspace_id}:{project_id}:{source_tool}"))
    execute_database_query(
        require_supabase()
        .table("sync_runs")
        .upsert(
            {
                "id": run_id,
                "workspace_id": workspace_id,
                "project_id": project_id,
                "source_tool": source_tool,
                "last_run_at": last_run_at,
                "items_ingested": items_ingested,
            },
            on_conflict="workspace_id,project_id,source_tool",
        )
    )
    return last_run_at


def memory_exists(workspace_id: str, project_id: str, record: MemoryRecord) -> bool:
    result = execute_database_query(
        require_supabase()
        .table("memories")
        .select("id")
        .eq("id", memory_id_for_record(workspace_id, project_id, record))
        .eq("workspace_id", workspace_id)
        .limit(1)
    )
    return bool(result.data)


def store_memory(workspace_id: str, project_id: str, record: MemoryRecord) -> int:
    memory_id = memory_id_for_record(workspace_id, project_id, record)
    execute_database_query(
        require_supabase()
        .table("memories")
        .upsert(
            {
                "id": memory_id,
                "workspace_id": workspace_id,
                "project_id": project_id,
                "source": record.source_tool,
                "event_type": record.event_type,
                "content": "\n\n".join(
                    part for part in (record.user_prompt.strip(), record.ai_response.strip()) if part
                ),
                "prompt": record.user_prompt,
                "response": record.ai_response,
                "created_at": record.timestamp,
                "metadata": record.metadata,
                "is_deleted": False,
            },
            on_conflict="id",
        )
    )
    return len(read_workspace_rows(workspace_id, project_id))


def fetch_github_json(path: str) -> Any:
    if not GITHUB_TOKEN or not GITHUB_OWNER or not GITHUB_REPO:
        raise RuntimeError("GitHub integration is not configured.")

    request = UrlRequest(
        f"{GITHUB_API_URL}{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Synra-V1",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=GITHUB_REQUEST_TIMEOUT_SECONDS) as response:
            return json.loads(response.read())
    except HTTPError as exc:
        logger.warning("GitHub read failed for %s: HTTP %s", path, exc.code)
        error_body = exc.read().decode("utf-8", errors="replace")
        try:
            error_data = json.loads(error_body)
        except json.JSONDecodeError:
            error_data = {}
        api_message = (
            error_data.get("message")
            if isinstance(error_data, dict) and isinstance(error_data.get("message"), str)
            else error_body.strip()
        )
        if exc.code == 401:
            raise GitHubAPIError(401, api_message or "Bad credentials") from exc
        if exc.code == 404:
            raise GitHubAPIError(404, api_message or f"GitHub repository not found: {path}") from exc
        if exc.code == 403:
            raise GitHubAPIError(403, api_message or "GitHub API rate limit exceeded or access forbidden.") from exc
        raise GitHubAPIError(exc.code, api_message or f"GitHub API returned HTTP {exc.code}.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("GitHub read failed for %s: %s", path, type(exc).__name__)
        raise RuntimeError("Unable to reach GitHub API.") from exc


def github_memory_events(
    include_code: bool = False,
    code_paths: Optional[list[str]] = None,
) -> list[tuple[str, str, str, dict[str, Any], Optional[datetime]]]:
    owner = quote(GITHUB_OWNER, safe="")
    repository = quote(GITHUB_REPO, safe="")
    repository_name = f"{GITHUB_OWNER}/{GITHUB_REPO}"
    base_path = f"/repos/{owner}/{repository}"
    repository_data = fetch_github_json(base_path)
    commits = fetch_github_json(f"{base_path}/commits?per_page={GITHUB_ACTIVITY_LIMIT}")
    issues = fetch_github_json(f"{base_path}/issues?state=all&sort=updated&per_page={GITHUB_ACTIVITY_LIMIT}")
    pull_requests = fetch_github_json(
        f"{base_path}/pulls?state=all&sort=updated&direction=desc&per_page={GITHUB_ACTIVITY_LIMIT}"
    )

    events: list[tuple[str, str, str, dict[str, Any], Optional[datetime]]] = []
    events.append(
        (
            "repository",
            f"GitHub repository {repository_name}",
            (
                f"{repository_data.get('description') or 'No description.'} "
                f"Stars: {repository_data.get('stargazers_count', 0)}. "
                f"Open issues: {repository_data.get('open_issues_count', 0)}. "
                f"Default branch: {repository_data.get('default_branch', '')}."
            ),
            {"github_id": str(repository_data.get("id", "")), "seed_id": f"github:repository:{repository_name}"},
            None,
        )
    )

    for commit in commits if isinstance(commits, list) else []:
        sha = str(commit.get("sha", ""))
        if not sha:
            continue
        commit_data = commit.get("commit", {})
        if not isinstance(commit_data, dict):
            continue
        author = commit_data.get("author", {})
        if not isinstance(author, dict):
            author = {}
        events.append(
            (
                "commit",
                str(commit_data.get("message", "")).splitlines()[0][:1000],
                f"Commit {sha[:12]} by {author.get('name', 'unknown')}.",
                {"github_id": sha, "seed_id": f"github:commit:{repository_name}:{sha}"},
                parse_github_timestamp(commit_data.get("author", {}).get("date") if isinstance(commit_data, dict) else None),
            )
        )

    for issue in issues if isinstance(issues, list) else []:
        number = issue.get("number")
        if number is None:
            continue
        is_pull_request = isinstance(issue.get("pull_request"), dict)
        if is_pull_request:
            continue
        events.append(
            (
                "issue",
                str(issue.get("title", ""))[:1000],
                f"Issue #{number} is {issue.get('state', 'unknown')}.",
                {"github_id": str(number), "seed_id": f"github:issue:{repository_name}:{number}"},
                parse_github_timestamp(issue.get("updated_at")),
            )
        )

    for pull_request in pull_requests if isinstance(pull_requests, list) else []:
        number = pull_request.get("number")
        if number is None:
            continue
        events.append(
            (
                "pull_request",
                str(pull_request.get("title", ""))[:1000],
                f"Pull request #{number} is {pull_request.get('state', 'unknown')}.",
                {"github_id": str(number), "seed_id": f"github:pull_request:{repository_name}:{number}"},
                parse_github_timestamp(pull_request.get("updated_at")),
            )
        )

    if include_code:
        requested_paths = code_paths or list(DEFAULT_GITHUB_CODE_PATHS)
        for path in requested_paths[:GITHUB_CODE_PATH_LIMIT]:
            content_data = fetch_github_json(f"{base_path}/contents/{quote(path, safe='/')}")
            if not isinstance(content_data, dict) or content_data.get("type") != "file":
                continue
            encoded_content = content_data.get("content")
            if not isinstance(encoded_content, str) or content_data.get("encoding") != "base64":
                continue
            try:
                content = base64.b64decode(encoded_content, validate=False).decode("utf-8")
            except (binascii.Error, UnicodeDecodeError):
                logger.warning("Skipping non-text GitHub file: %s", path)
                continue
            is_truncated = len(content) > GITHUB_CODE_FILE_MAX_CHARS
            if is_truncated:
                content = content[:GITHUB_CODE_FILE_MAX_CHARS]
            sha = str(content_data.get("sha", ""))
            events.append(
                (
                    "code_file",
                    f"Source file: {repository_name}/{path}",
                    content,
                    {
                        "github_id": sha,
                        "path": path,
                        "truncated": is_truncated,
                        "seed_id": f"github:file:{repository_name}:{sha or path}",
                    },
                    None,
                )
            )
    return events


def parse_github_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def is_gmail_configured() -> bool:
    token = os.getenv("GMAIL_TOKEN", "").strip() or GMAIL_TOKEN
    if token:
        return True
    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip() or GMAIL_CLIENT_ID
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip() or GMAIL_CLIENT_SECRET
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN", "").strip() or GMAIL_REFRESH_TOKEN
    return bool(client_id and client_secret and refresh_token)


def get_gmail_access_token() -> str:
    token = os.getenv("GMAIL_TOKEN", "").strip() or GMAIL_TOKEN
    if token:
        return token
    client_id = os.getenv("GMAIL_CLIENT_ID", "").strip() or GMAIL_CLIENT_ID
    client_secret = os.getenv("GMAIL_CLIENT_SECRET", "").strip() or GMAIL_CLIENT_SECRET
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN", "").strip() or GMAIL_REFRESH_TOKEN
    if not client_id or not client_secret or not refresh_token:
        raise RuntimeError("Gmail integration is not configured.")

    token_url = "https://oauth2.googleapis.com/token"
    data = urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token",
    }).encode("utf-8")
    req = UrlRequest(token_url, data=data, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urlopen(req, timeout=GMAIL_REQUEST_TIMEOUT_SECONDS) as resp:
            token_data = json.loads(resp.read())
            return token_data.get("access_token", "")
    except HTTPError as exc:
        logger.warning("Gmail token refresh failed with HTTP %s", exc.code)
        if exc.code in (400, 401):
            raise RuntimeError("Invalid or expired Gmail OAuth credentials.") from exc
        raise RuntimeError("Unable to refresh Gmail OAuth token.") from exc
    except (URLError, TimeoutError) as exc:
        logger.warning("Gmail token refresh connection failed: %s", type(exc).__name__)
        raise RuntimeError("Unable to reach Gmail API.") from exc


def fetch_gmail_json(path: str) -> Any:
    access_token = get_gmail_access_token()
    if not access_token:
        raise RuntimeError("Gmail integration is not configured.")
    url = f"{GMAIL_API_URL}{path}"
    req = UrlRequest(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": "Synra-V1",
        },
        method="GET",
    )
    try:
        with urlopen(req, timeout=GMAIL_REQUEST_TIMEOUT_SECONDS) as resp:
            return json.loads(resp.read())
    except HTTPError as exc:
        logger.warning("Gmail API read failed: HTTP %s", exc.code)
        if exc.code == 401:
            raise RuntimeError("Invalid or expired Gmail OAuth credentials.") from exc
        if exc.code in (403, 429):
            raise RuntimeError("Gmail API rate limit reached.") from exc
        raise RuntimeError("Unable to read Gmail data.") from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        logger.warning("Gmail read failed: %s", type(exc).__name__)
        raise RuntimeError("Unable to reach Gmail API.") from exc


def gmail_memory_events() -> list[tuple[str, str, str, dict[str, Any], Optional[datetime]]]:
    list_data = fetch_gmail_json(f"/messages?maxResults={GMAIL_SYNC_LIMIT}")
    messages = list_data.get("messages", []) if isinstance(list_data, dict) else []
    events: list[tuple[str, str, str, dict[str, Any], Optional[datetime]]] = []
    for item in messages:
        msg_id = item.get("id")
        if not msg_id:
            continue
        msg_data = fetch_gmail_json(f"/messages/{msg_id}?format=full")
        if not isinstance(msg_data, dict):
            continue
        headers = {
            h.get("name", "").lower(): h.get("value", "")
            for h in msg_data.get("payload", {}).get("headers", [])
            if isinstance(h, dict)
        }
        subject = headers.get("subject", "No Subject")
        sender = headers.get("from", "Unknown Sender")
        snippet = msg_data.get("snippet", "")
        thread_id = msg_data.get("threadId", msg_id)
        internal_date = msg_data.get("internalDate")
        timestamp = None
        if internal_date and str(internal_date).isdigit():
            timestamp = datetime.fromtimestamp(int(internal_date) / 1000, tz=timezone.utc)
        prompt = f"Email: {subject} (From: {sender})"
        response = snippet or f"Email from {sender} regarding {subject}."
        events.append((
            "email",
            prompt[:1000],
            response[:2000],
            {
                "gmail_id": msg_id,
                "thread_id": thread_id,
                "seed_id": f"gmail:message:{msg_id}",
            },
            timestamp,
        ))
    return events


@app.middleware("http")
async def crash_prevention_middleware(request: Request, call_next):
    try:
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                size = int(content_length)
            except ValueError:
                return isolate_error(400, "Invalid Content-Length header.")
            if size > MAX_PAYLOAD_BYTES:
                return isolate_error(413, "Payload too large")
        return await call_next(request)
    except HTTPException as exc:
        return isolate_error(exc.status_code, str(exc.detail))
    except Exception as exc:
        logger.error("Prevented server crash: %s", exc, exc_info=True)
        return isolate_error(500, "Internal error isolated safely.")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    logger.warning("Rejected invalid payload: %s", exc.errors())
    return isolate_error(422, "Invalid SynraEvent payload.")


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.error("Unhandled error isolated: %s", exc, exc_info=True)
    return isolate_error(500, "Internal error isolated safely.")


@app.get("/")
def home() -> dict[str, str]:
    return {"status": "online", "message": "Synra OS Backend is live on Windows!"}


@app.get("/health")
def health_check() -> dict[str, Any]:
    client = require_supabase()
    execute_database_query(client.table("workspaces").select("id").limit(1))

    return {
        "status": "ok",
        "storage": {"provider": "supabase", "mode": "postgresql"},
        "session_signing_configured": bool(SYNRA_SESSION_SECRET),
    }


def require_web_user(request: Request) -> str:
    if getattr(request.state, "auth_type", None) != "web":
        raise HTTPException(status_code=403, detail="This operation requires a dashboard session.")
    return str(request.state.user_id)


@app.get("/api/v1/workspaces")
async def list_workspaces(request: Request) -> list[dict[str, Any]]:
    owner_id = require_web_user(request)
    result = execute_database_query(
        require_supabase()
        .table("workspaces")
        .select("id,name,created_at")
        .eq("owner_id", owner_id)
        .order("created_at", desc=True)
    )
    return result.data or []


@app.post("/api/v1/workspaces", status_code=201)
async def create_workspace(payload: WorkspaceCreateRequest, request: Request) -> dict[str, Any]:
    owner_id = require_web_user(request)
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Workspace name cannot be empty.")
    result = execute_database_query(
        require_supabase()
        .table("workspaces")
        .insert({"name": name, "owner_id": owner_id})
        .select("id,name,created_at")
    )
    if not result.data:
        raise HTTPException(status_code=503, detail="Workspace was not created.")
    return result.data[0]


@app.get("/api/v1/api-keys")
async def list_api_keys(workspace_id: str, request: Request) -> list[dict[str, Any]]:
    owner_id = require_web_user(request)
    owned_workspace_id = resolve_workspace_id(request, workspace_id)
    result = execute_database_query(
        require_supabase()
        .table("api_keys")
        .select("id,name,created_at,last_used_at")
        .eq("workspace_id", owned_workspace_id)
        .eq("owner_id", owner_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
    )
    return result.data or []


@app.post("/api/v1/api-keys", status_code=201)
async def create_api_key(payload: WorkspaceKeyRequest, request: Request) -> dict[str, Any]:
    owner_id = require_web_user(request)
    workspace_id = resolve_workspace_id(request, payload.workspace_id)
    key = f"synra_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(key.encode("utf-8")).hexdigest()
    result = execute_database_query(
        require_supabase()
        .table("api_keys")
        .insert(
            {
                "owner_id": owner_id,
                "workspace_id": workspace_id,
                "name": payload.name,
                "key_hash": key_hash,
            }
        )
        .select("id,name,created_at")
    )
    if not result.data:
        raise HTTPException(status_code=503, detail="API key was not created.")
    return {**result.data[0], "key": key}


@app.delete("/api/v1/api-keys/{key_id}")
async def revoke_api_key(key_id: str, workspace_id: str, request: Request) -> dict[str, str]:
    owner_id = require_web_user(request)
    owned_workspace_id = resolve_workspace_id(request, workspace_id)
    try:
        normalized_key_id = str(UUID(key_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="API key not found.") from exc
    result = execute_database_query(
        require_supabase()
        .table("api_keys")
        .update({"revoked_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", normalized_key_id)
        .eq("owner_id", owner_id)
        .eq("workspace_id", owned_workspace_id)
        .is_("revoked_at", "null")
        .select("id")
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="API key not found.")
    return {"status": "revoked", "id": normalized_key_id}


@app.post("/api/v1/waitlist")
async def waitlist_signup(payload: WaitlistRequest, request: Request) -> dict[str, str]:
    client_ip = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    cutoff = now.timestamp() - WAITLIST_RATE_LIMIT_WINDOW_SECONDS
    # The dashboard proxy forwards from 127.0.0.1, so this limit is effectively global for dashboard traffic.
    with WAITLIST_RATE_LIMIT_LOCK:
        recent_requests = [
            timestamp
            for timestamp in WAITLIST_REQUESTS_BY_IP.get(client_ip, [])
            if timestamp.timestamp() > cutoff
        ]
        WAITLIST_REQUESTS_BY_IP[client_ip] = recent_requests
        if len(recent_requests) >= WAITLIST_RATE_LIMIT_MAX_REQUESTS:
            raise HTTPException(
                status_code=429,
                detail="Too many requests. Try again shortly.",
            )
        recent_requests.append(now)

    result = execute_database_query(
        require_supabase()
        .table("waitlist_signups")
        .upsert(
            {"email": str(payload.email), "source": payload.source},
            on_conflict="email",
            ignore_duplicates=True,
        )
        .select("id")
    )
    if not result.data:
        return {"status": "already_registered"}
    return {"status": "registered"}


@app.post("/api/v1/ingest", response_model=IngestResponse)
async def ingest_memory(event: SynraEvent, request: Request) -> IngestResponse:
    try:
        workspace_id = resolve_project_workspace(request, event.project_id)
        record, redacted = create_memory_record(
            event.source_tool,
            event.event_type,
            event.user_prompt,
            event.ai_response,
            event.metadata,
            event.timestamp,
        )
        event_count = store_memory(workspace_id, event.project_id, record)

        logger.info(
            "Ingested %s event for project %s from %s",
            event.event_type,
            event.project_id,
            event.source_tool,
        )
        return IngestResponse(
            status="success",
            message="Memory indexed successfully",
            project_id=event.project_id,
            event_id=event_count,
            nodes_created=2,
            redacted=redacted,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Ingest isolated: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error isolated safely.") from exc


@app.post("/api/v1/memory/add", response_model=IngestResponse)
async def add_memory(payload: MemoryAddRequest, request: Request) -> IngestResponse:
    return await ingest_memory(
        SynraEvent(
            source_tool=payload.source_tool,
            project_id=payload.project_id,
            user_prompt=payload.prompt,
            ai_response=payload.response,
            event_type=payload.event_type,
            metadata=payload.metadata,
        ),
        request,
    )


@app.get("/api/v1/ingest/jobs")
async def get_ingest_jobs(
    request: Request,
    project_id: str = Query(default="demo", min_length=1, max_length=256),
) -> dict[str, Any]:
    normalized_project_id = project_id.strip()
    if not normalized_project_id:
        raise HTTPException(status_code=400, detail="project_id is required.")
    workspace_id = resolve_project_workspace(request, normalized_project_id)
    run_result = execute_database_query(
        require_supabase()
        .table("sync_runs")
        .select("id,last_run_at")
        .eq("workspace_id", workspace_id)
        .eq("project_id", normalized_project_id)
        .eq("source_tool", "github")
        .limit(1)
    )
    run = run_result.data[0] if run_result.data else {}
    return {
        "items": [
            {
                "id": run.get("id") or str(uuid5(NAMESPACE_URL, f"synra-mock-ingest-job:{workspace_id}:{normalized_project_id}")),
                "project_id": normalized_project_id,
                "source": "github",
                "status": "completed",
                "progress": 100,
                "message": "Mock sync status: complete.",
                "updated_at": run.get("last_run_at") or datetime.now(timezone.utc).isoformat(),
            }
        ],
        "total": 1,
    }


@app.post("/api/v1/integrations/github/sync", response_model=GitHubSyncResponse)
async def sync_github(payload: GitHubSyncRequest, request: Request) -> GitHubSyncResponse:
    workspace_id = resolve_project_workspace(request, payload.project_id)
    github_is_configured = bool(GITHUB_TOKEN and GITHUB_OWNER and GITHUB_REPO)
    if GITHUB_SYNC_MODE == "mock" or (
        GITHUB_SYNC_MODE == "auto" and not github_is_configured
    ):
        logger.info("Using mock GitHub sync response for project %s.", payload.project_id)
        return GitHubSyncResponse(
            status="success",
            synced_count=5,
            project_id=payload.project_id,
            source_tool="github",
            repositories=0,
            commits=0,
            issues=0,
            pull_requests=0,
            code_files=0,
            memories_created=0,
            last_run_at=record_sync_run(workspace_id, payload.project_id, "github", 0),
            items_ingested=0,
        )

    record_sync_run(workspace_id, payload.project_id, "github", 0)
    memories_created = 0
    try:
        events = await asyncio.to_thread(
            github_memory_events,
            payload.include_code,
            payload.code_paths,
        )
        counts = {"repository": 0, "commit": 0, "issue": 0, "pull_request": 0, "code_file": 0}
        for event_type, prompt, response, metadata, timestamp in events:
            record, _ = create_memory_record(
                "github",
                event_type,
                prompt,
                response,
                metadata,
                timestamp,
            )
            counts[event_type] += 1
            if not memory_exists(workspace_id, payload.project_id, record):
                store_memory(workspace_id, payload.project_id, record)
                memories_created += 1
        return GitHubSyncResponse(
            status="success",
            synced_count=len(events),
            project_id=payload.project_id,
            source_tool="github",
            repositories=counts["repository"],
            commits=counts["commit"],
            issues=counts["issue"],
            pull_requests=counts["pull_request"],
            code_files=counts["code_file"],
            memories_created=memories_created,
            last_run_at=record_sync_run(workspace_id, payload.project_id, "github", memories_created),
            items_ingested=memories_created,
        )
    except GitHubAPIError as exc:
        return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": f"GitHub API error: {exc}",
            "last_run_at": record_sync_run(workspace_id, payload.project_id, "github", memories_created),
            "items_ingested": memories_created,
        },
        )
    except RuntimeError as exc:
        return JSONResponse(
        status_code=503,
        content={
            "detail": str(exc),
            "last_run_at": record_sync_run(workspace_id, payload.project_id, "github", memories_created),
            "items_ingested": memories_created,
        },
        )
    except Exception as exc:
        logger.error("GitHub sync failed: %s", exc, exc_info=True)
        return JSONResponse(
        status_code=502,
        content={
            "detail": "Unable to sync GitHub data.",
            "last_run_at": record_sync_run(workspace_id, payload.project_id, "github", memories_created),
            "items_ingested": memories_created,
        },
        )


@app.post("/api/v1/integrations/gmail/sync")
async def sync_gmail(payload: GmailSyncRequest, request: Request) -> Any:
    workspace_id = resolve_project_workspace(request, payload.project_id)
    last_run_at = record_sync_run(workspace_id, payload.project_id, "gmail", 0)
    if not is_gmail_configured():
        return JSONResponse(
            status_code=503,
            content={
                "error": "gmail_not_configured",
                "message": "Gmail integration is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN (or GMAIL_TOKEN) in .env to enable Gmail sync.",
                "last_run_at": last_run_at,
                "items_ingested": 0,
            },
        )
    try:
        events = await asyncio.to_thread(gmail_memory_events)
        memories_created = 0
        threads_seen: set[str] = set()
        for event_type, prompt, response, metadata, timestamp in events:
            record, _ = create_memory_record(
                "gmail",
                event_type,
                prompt,
                response,
                metadata,
                timestamp,
            )
            thread_id = metadata.get("thread_id", "")
            if thread_id:
                threads_seen.add(thread_id)
            if not memory_exists(workspace_id, payload.project_id, record):
                store_memory(workspace_id, payload.project_id, record)
                memories_created += 1
        return GmailSyncResponse(
            status="success",
            project_id=payload.project_id,
            source_tool="gmail",
            messages_synced=len(events),
            threads_synced=len(threads_seen),
            memories_created=memories_created,
            last_run_at=record_sync_run(workspace_id, payload.project_id, "gmail", memories_created),
            items_ingested=memories_created,
        )
    except RuntimeError as exc:
        return JSONResponse(
            status_code=503,
            content={
                "error": "gmail_sync_unavailable",
                "message": str(exc),
                "last_run_at": record_sync_run(workspace_id, payload.project_id, "gmail", memories_created),
                "items_ingested": memories_created,
            },
        )
    except Exception as exc:
        logger.error("Gmail sync failed: %s", exc, exc_info=True)
        return JSONResponse(
            status_code=502,
            content={
                "error": "gmail_sync_error",
                "message": "Unable to sync Gmail data.",
                "last_run_at": record_sync_run(workspace_id, payload.project_id, "gmail", memories_created),
                "items_ingested": memories_created,
            },
        )


@app.post("/api/v1/memory/search", response_model=MemorySearchResponse)
async def search_memory(payload: MemorySearchRequest, request: Request) -> MemorySearchResponse:
    try:
        workspace_id = resolve_project_workspace(request, payload.project_id)
        return MemorySearchResponse(
            project_id=payload.project_id,
            query=payload.query,
            results=search_project_memories(
                workspace_id, payload.project_id, payload.query, payload.limit
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Search isolated: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error isolated safely.") from exc


@app.get("/api/v1/projects", response_model=list[str])
async def list_projects(request: Request) -> list[str]:
    if getattr(request.state, "auth_type", None) == "api_key":
        workspace_ids = [str(request.state.workspace_id)]
    else:
        result = execute_database_query(
            require_supabase()
            .table("workspaces")
            .select("id")
            .eq("owner_id", request.state.user_id)
        )
        workspace_ids = [str(row["id"]) for row in result.data or []]

    projects: set[str] = set()
    for workspace_id in workspace_ids:
        projects.update(
            str(row.get("project_id", "")).strip()
            for row in read_workspace_rows(workspace_id)
            if row.get("project_id")
        )
    return sorted(projects)


@app.get("/api/v1/memories")
async def list_memories(
    request: Request,
    workspace_id: str = Query(..., min_length=1, max_length=256),
    q: str = Query(default="", max_length=1_000),
    source: str = Query(default="", max_length=128),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    try:
        owned_workspace_id = resolve_workspace_id(request, workspace_id)

        normalized_query = q.casefold().strip()
        normalized_source = source.casefold().strip()
        rows = read_workspace_rows(owned_workspace_id)
        items = [memory_browser_item(row) for row in rows]
        items.sort(key=lambda item: str(item["created_at"]), reverse=True)

        if normalized_source == "manual":
            manual_sources = {"manual", "dashboard"}
            items = [item for item in items if item["source"].casefold() in manual_sources]
        elif normalized_source and normalized_source != "all":
            items = [item for item in items if item["source"].casefold() == normalized_source]

        if normalized_query:
            items = [
                item for item in items
                if normalized_query in " ".join(
                    (
                        item["content"],
                        item["source"],
                        item["event_type"],
                        json.dumps(item["metadata"], sort_keys=True, default=str),
                    )
                ).casefold()
            ]

        total = len(items)
        return {"items": items[offset:offset + limit], "total": total}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("List memories failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to list memories.") from exc


@app.get("/api/v1/memories/{memory_id}")
async def get_memory(
    memory_id: str,
    request: Request,
    workspace_id: str = Query(..., min_length=1, max_length=256),
) -> dict[str, Any]:
    try:
        owned_workspace_id = resolve_workspace_id(request, workspace_id)
        try:
            normalized_memory_id = str(UUID(memory_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Memory not found.") from exc
        result = execute_database_query(
            require_supabase()
            .table("memories")
            .select("*")
            .eq("id", normalized_memory_id)
            .eq("workspace_id", owned_workspace_id)
            .eq("is_deleted", False)
            .limit(1)
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Memory not found.")
        return memory_browser_item(result.data[0])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Get memory failed for %s: %s", memory_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to retrieve memory.") from exc


@app.delete("/api/v1/memories/{memory_id}")
async def delete_memory(
    memory_id: str,
    request: Request,
    workspace_id: str = Query(..., min_length=1, max_length=256),
) -> dict[str, str]:
    try:
        owned_workspace_id = resolve_workspace_id(request, workspace_id)
        try:
            normalized_memory_id = str(UUID(memory_id))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail="Memory not found.") from exc
        result = execute_database_query(
            require_supabase()
            .table("memories")
            .update({"is_deleted": True})
            .eq("id", normalized_memory_id)
            .eq("workspace_id", owned_workspace_id)
            .eq("is_deleted", False)
            .select("id")
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Memory not found.")
        return {"status": "deleted", "id": normalized_memory_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Delete memory failed for %s: %s", memory_id, exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Unable to delete memory.") from exc


@app.get("/api/v1/context/{project_id}", response_model=ContextResponse)
async def get_context(project_id: str, request: Request) -> ContextResponse:
    try:
        project_id = project_id.strip()
        if not project_id:
            raise HTTPException(status_code=400, detail="project_id is required.")

        workspace_id = resolve_project_workspace(request, project_id)
        rows = read_workspace_rows(workspace_id, project_id)
        events = [memory_record_from_row(row) for row in rows]
        recent = events[-CONTEXT_EVENT_LIMIT:]
        tools = sorted({item.source_tool for item in events}) if events else []

        if events:
            summary = (
                f"Synra OS active for {project_id}. "
                f"{len(events)} indexed event(s)"
                + (f" from {', '.join(tools)}." if tools else ".")
            )
            decisions = [
                f"{item.source_tool}: {item.event_type} at {item.timestamp}"
                for item in recent[-5:]
            ]
        else:
            summary = f"Synra OS active. No indexed memory yet for {project_id}."
            decisions = ["Awaiting first ingest"]

        nodes, links = build_graph(project_id, rows, summary)
        return ContextResponse(
            project_id=project_id,
            context_summary=summary,
            active_decisions=decisions,
            recent_events=recent,
            event_count=len(events),
            nodes=nodes,
            links=links,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Context isolated: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error isolated safely.") from exc


@app.get("/api/v1/memory/context", response_model=ContextResponse)
async def get_memory_context(project_id: str, request: Request) -> ContextResponse:
    return await get_context(project_id, request)


@app.post("/api/v1/memory/save")
async def save_agent_memory(payload: AgentMemorySaveRequest, request: Request) -> dict[str, Any]:
    try:
        project_id = payload.project or "demo"
        workspace_id = resolve_project_workspace(request, project_id)
        prompt_summary = f"[{payload.type}]"
        if payload.concepts:
            prompt_summary += f" concepts: {payload.concepts}"
        if payload.files:
            prompt_summary += f" files: {payload.files}"

        metadata = {
            "type": payload.type,
            "concepts": payload.concepts,
            "files": payload.files,
            "agentId": payload.agentId,
        }
        record, _ = create_memory_record(
            source_tool="agentmemory",
            event_type=payload.type,
            prompt=prompt_summary,
            response=payload.content,
            metadata=metadata,
        )
        total = store_memory(workspace_id, project_id, record)
        return {
            "status": "success",
            "project": project_id,
            "type": payload.type,
            "memory_id": memory_id_for_record(workspace_id, project_id, record),
            "items_ingested": 1,
            "total_memories": total,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("AgentMemory save failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error saving AgentMemory record.") from exc


@app.post("/api/v1/memory/recall")
@app.post("/api/v1/memory/smart_search")
async def recall_agent_memory(payload: AgentMemoryRecallRequest, request: Request) -> dict[str, Any]:
    try:
        project_id = payload.project or "demo"
        workspace_id = resolve_project_workspace(request, project_id)
        results = search_project_memories(
            workspace_id, project_id, payload.query, payload.limit
        )

        if payload.agentId and payload.agentId != "*":
            results = [
                r for r in results
                if not r.metadata.get("agentId") or r.metadata.get("agentId") == payload.agentId
            ]

        if payload.format == "compact":
            formatted = [
                {
                    "id": r.event_id,
                    "score": r.score,
                    "tool": r.source_tool,
                    "snippet": (r.prompt + " " + r.response)[:150],
                }
                for r in results
            ]
        elif payload.format == "narrative":
            narrative = "\n\n".join(
                f"- **{r.source_tool}** ({r.metadata.get('type', 'event')}): {r.prompt}\n  Result: {r.response}"
                for r in results
            )
            formatted = [{"narrative": narrative, "count": len(results)}]
        else:
            formatted = [
                {
                    "id": r.event_id,
                    "score": r.score,
                    "source_tool": r.source_tool,
                    "prompt": r.prompt,
                    "response": r.response,
                    "metadata": r.metadata,
                }
                for r in results
            ]

        token_est = sum(len(r.prompt) + len(r.response) for r in results) // 4
        return {
            "status": "success",
            "query": payload.query,
            "project": project_id,
            "format": payload.format,
            "targetLayer": payload.targetLayer,
            "results": formatted,
            "count": len(results),
            "estimated_tokens": token_est,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("AgentMemory recall failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error recalling memory.") from exc


@app.post("/api/v1/memory/file_history")
async def file_history_agent_memory(
    payload: AgentMemoryFileHistoryRequest,
    request: Request,
) -> dict[str, Any]:
    try:
        project_id = payload.project or "demo"
        workspace_id = resolve_project_workspace(request, project_id)
        file_list = [f.strip() for f in payload.files.split(",") if f.strip()]
        rows = read_workspace_rows(workspace_id, project_id)
        matched_results = []
        for row in rows:
            prompt = str(row.get("prompt", ""))
            resp = str(row.get("response", ""))
            metadata = row.get("metadata") or {}
            meta_files = str(metadata.get("files", ""))
            path = str(metadata.get("path", ""))
            combined = f"{prompt} {resp} {meta_files} {path}".casefold()
            for target_file in file_list:
                if target_file.casefold() in combined:
                    matched_results.append({
                        "event_id": str(row["id"]),
                        "source_tool": str(row.get("source", "")),
                        "file": target_file,
                        "prompt": prompt,
                        "response": resp,
                        "timestamp": row.get("created_at"),
                    })
                    break
        return {
            "status": "success",
            "project": project_id,
            "files": file_list,
            "results": matched_results[:20],
            "count": len(matched_results[:20]),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("AgentMemory file history failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error fetching file history.") from exc


@app.get("/api/v1/memory/sessions")
async def get_agent_memory_sessions(
    request: Request,
    project: str = "demo",
    limit: int = Query(default=20, ge=1, le=100),
) -> dict[str, Any]:
    try:
        workspace_id = resolve_project_workspace(request, project)
        events = [
            memory_record_from_row(row)
            for row in read_workspace_rows(workspace_id, project)
        ]
        return {
            "status": "success",
            "project": project,
            "total_events": len(events),
            "recent_sessions": [
                {
                    "source_tool": e.source_tool,
                    "event_type": e.event_type,
                    "timestamp": e.timestamp,
                    "preview": (e.user_prompt or e.ai_response)[:100],
                }
                for e in events[-limit:]
            ],
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("AgentMemory sessions failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal error fetching sessions.") from exc


@app.post("/api/v1/agentmemory/bridge")
async def agentmemory_bridge(payload: AgentMemoryBridgeRequest, request: Request) -> dict[str, Any]:
    try:
        project_id = payload.project_id
        workspace_id = resolve_project_workspace(request, project_id)
        if payload.action == "sync" and payload.memories:
            ingested = 0
            for item in payload.memories:
                record, _ = create_memory_record(
                    source_tool="agentmemory",
                    event_type=item.get("type", "memory"),
                    prompt=item.get("prompt", item.get("content", "")),
                    response=item.get("response", item.get("insight", "")),
                    metadata=item.get("metadata", {}),
                )
                if not memory_exists(workspace_id, project_id, record):
                    store_memory(workspace_id, project_id, record)
                    ingested += 1
            return {
                "status": "success",
                "action": "sync",
                "project_id": project_id,
                "ingested": ingested,
            }
        elif payload.action == "export":
            rows = read_workspace_rows(workspace_id, project_id)
            memories_export = [
                {
                    "id": str(row["id"]),
                    "content": row.get("response", ""),
                    "type": row.get("event_type", "fact"),
                    "prompt": row.get("prompt", ""),
                    "metadata": row.get("metadata") or {},
                    "timestamp": row.get("created_at"),
                }
                for row in rows
            ]
            return {
                "status": "success",
                "action": "export",
                "project_id": project_id,
                "memories": memories_export,
            }
        return {"status": "success", "action": payload.action, "project_id": project_id}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("AgentMemory bridge failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Bridge error.") from exc


def run_server(host: str = "127.0.0.1", start_port: int = 8000, attempts: int = 5) -> None:
    last_error: Optional[BaseException] = None
    for port in range(start_port, start_port + attempts):
        try:
            logger.info("Starting Synra OS Gateway on %s:%s", host, port)
            uvicorn.run(app, host=host, port=port)
            return
        except SystemExit as exc:
            last_error = exc
            logger.warning("Port %s unavailable, trying next port.", port)
        except OSError as exc:
            last_error = exc
            logger.warning("Bind failed on port %s: %s", port, exc)
    logger.error("Could not bind after %s attempts. Last error: %s", attempts, last_error)


if __name__ == "__main__":
    run_server()
