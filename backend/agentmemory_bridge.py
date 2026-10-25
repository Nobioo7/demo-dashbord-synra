import asyncio
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request

if __package__:
    from .agentmemory_client import get_agentmemory_graph_data
else:
    from agentmemory_client import get_agentmemory_graph_data

router = APIRouter()
logger = logging.getLogger("SynraAgentMemoryBridge")


def execute_workspace_query(query: Any) -> Any:
    try:
        return query.execute()
    except Exception as exc:
        logger.error("Workspace ownership lookup failed: %s", exc, exc_info=True)
        raise HTTPException(status_code=503, detail="Unable to validate workspace access.") from exc


@router.get("/api/v1/agentmemory/graph")
async def get_agentmemory_graph(
    request: Request,
    workspace_id: str | None = Query(default=None, min_length=1, max_length=64),
) -> dict[str, Any]:
    auth_type = getattr(request.state, "auth_type", None)
    if auth_type == "api_key":
        bound_workspace_id = str(request.state.workspace_id)
        if workspace_id and workspace_id != bound_workspace_id:
            raise HTTPException(status_code=403, detail="API key is not authorized for this workspace.")
        workspace_id = bound_workspace_id
    elif auth_type == "web":
        if not workspace_id:
            raise HTTPException(status_code=422, detail="workspace_id is required.")
        client = getattr(request.app.state, "supabase", None)
        if client is None:
            raise HTTPException(status_code=503, detail="Supabase database is not configured.")
        result = execute_workspace_query(
            client.table("workspaces")
            .select("id")
            .eq("id", workspace_id)
            .eq("owner_id", request.state.user_id)
            .limit(1)
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Workspace not found.")
    else:
        raise HTTPException(status_code=401, detail="Unauthorized.")

    return await asyncio.to_thread(get_agentmemory_graph_data, workspace_id)
