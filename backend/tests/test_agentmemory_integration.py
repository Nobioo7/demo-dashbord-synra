import os
import unittest
from unittest.mock import patch

import httpx
from test_support import (
    TEST_API_KEY,
    TEST_WORKSPACE_ID,
    SupabaseTestCase,
    agentmemory_client,
    main,
)

AUTH_HEADERS = {"X-API-Key": TEST_API_KEY}


class AgentMemoryIntegrationTests(SupabaseTestCase, unittest.TestCase):

    def test_agentmemory_url_supports_documented_and_legacy_environment_names(self) -> None:
        with patch.dict(os.environ, {"AGENTMEMORY_URL": "http://agentmemory.test/"}):
            self.assertEqual(
                agentmemory_client._configured_agentmemory_url(),
                "http://agentmemory.test",
            )

        with patch.dict(
            os.environ,
            {
                "AGENTMEMORY_URL": "",
                "AGENTMEMORY_API_URL": "http://legacy-agentmemory.test/",
            },
        ):
            self.assertEqual(
                agentmemory_client._configured_agentmemory_url(),
                "http://legacy-agentmemory.test",
            )

        with patch.dict(
            os.environ,
            {
                "APP_ENV": "production",
                "AGENTMEMORY_URL": "",
                "AGENTMEMORY_API_URL": "",
            },
        ):
            self.assertEqual(agentmemory_client._configured_agentmemory_url(), "")

    def test_agentmemory_save_and_recall_lifecycle(self) -> None:
        save_response = self.client.post(
            "/api/v1/memory/save",
            json={
                "content": "Use PostgreSQL for workspace-scoped memory indexing.",
                "type": "architecture",
                "concepts": "workspace-scoping,postgres,embeddings",
                "files": "backend/main.py",
                "project": "agentmemory-demo",
                "agentId": "agent-007",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(save_response.status_code, 200, save_response.text)
        save_data = save_response.json()
        self.assertEqual(save_data["status"], "success")
        self.assertEqual(save_data["type"], "architecture")

        recall_response = self.client.post(
            "/api/v1/memory/recall",
            json={
                "query": "PostgreSQL workspace memory",
                "project": "agentmemory-demo",
                "format": "full",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(recall_response.status_code, 200, recall_response.text)
        recall_data = recall_response.json()
        self.assertEqual(recall_data["status"], "success")
        self.assertGreaterEqual(recall_data["count"], 1)
        self.assertIn("workspace-scoped", recall_data["results"][0]["response"])

    def test_agentmemory_smart_search_and_formats(self) -> None:
        self.client.post(
            "/api/v1/memory/save",
            json={
                "content": "Always validate relative paths when ingesting source files.",
                "type": "pattern",
                "concepts": "validation,security",
                "project": "format-test",
            },
            headers=AUTH_HEADERS,
        )

        compact_response = self.client.post(
            "/api/v1/memory/smart_search",
            json={
                "query": "validate paths",
                "project": "format-test",
                "format": "compact",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(compact_response.status_code, 200)
        self.assertIn("snippet", compact_response.json()["results"][0])

        narrative_response = self.client.post(
            "/api/v1/memory/recall",
            json={
                "query": "validate paths",
                "project": "format-test",
                "format": "narrative",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(narrative_response.status_code, 200)
        self.assertIn("narrative", narrative_response.json()["results"][0])

    def test_agentmemory_file_history(self) -> None:
        self.client.post(
            "/api/v1/memory/save",
            json={
                "content": "Updated Vite config for local proxying.",
                "type": "workflow",
                "files": "vite.config.js,src/index.ts",
                "project": "file-history-test",
            },
            headers=AUTH_HEADERS,
        )

        response = self.client.post(
            "/api/v1/memory/file_history",
            json={
                "files": "vite.config.js",
                "project": "file-history-test",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertGreaterEqual(data["count"], 1)

    def test_agentmemory_bridge_sync_and_export(self) -> None:
        bridge_in = self.client.post(
            "/api/v1/agentmemory/bridge",
            json={
                "action": "sync",
                "project_id": "bridge-test",
                "memories": [
                    {
                        "type": "bug",
                        "prompt": "Fix 401 on unauthenticated calls",
                        "response": "Ensure Authorization Bearer token matches SYNRA_API_KEY",
                        "metadata": {"fixed": True},
                    }
                ],
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(bridge_in.status_code, 200)
        self.assertEqual(bridge_in.json()["ingested"], 1)

        bridge_out = self.client.post(
            "/api/v1/agentmemory/bridge",
            json={
                "action": "export",
                "project_id": "bridge-test",
            },
            headers=AUTH_HEADERS,
        )
        self.assertEqual(bridge_out.status_code, 200)
        export_data = bridge_out.json()
        self.assertEqual(export_data["status"], "success")
        self.assertEqual(len(export_data["memories"]), 1)

    def test_agentmemory_graph_unauthorized(self) -> None:
        response = self.client.get("/api/v1/agentmemory/graph")
        self.assertEqual(response.status_code, 401)

    def test_agentmemory_graph_offline(self) -> None:
        with patch("agentmemory_client.fetch_agentmemory_export", return_value=None):
            response = self.client.get("/api/v1/agentmemory/graph", headers=AUTH_HEADERS)
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "offline")
            self.assertGreaterEqual(len(data["nodes"]), 1)
            self.assertIn("agentmemory-core", [n["id"] for n in data["nodes"]])

    def test_agentmemory_graph_online(self) -> None:
        mock_export = {
            "sessions": [
                {
                    "id": "sess-1",
                    "title": "Session 1",
                    "description": "Agent session",
                    "workspace_id": TEST_WORKSPACE_ID,
                },
                {
                    "id": "sess-other",
                    "title": "Other workspace",
                    "workspace_id": "00000000-0000-4000-8000-000000000099",
                },
            ],
            "memories": [
                {
                    "id": "mem-1",
                    "content": "Use FastAPI as the bridge gateway",
                    "type": "architecture",
                    "sessionId": "sess-1",
                    "workspace_id": TEST_WORKSPACE_ID,
                    "concepts": ["fastapi", "bridge"],
                },
                {
                    "id": "mem-other",
                    "content": "This belongs to a different workspace.",
                    "workspace_id": "00000000-0000-4000-8000-000000000099",
                },
            ],
            "observations": [
                {
                    "id": "obs-1",
                    "title": "Observed API response",
                    "narrative": "API responded with status 200",
                    "type": "observation",
                    "sessionId": "sess-1",
                    "workspace_id": TEST_WORKSPACE_ID,
                    "concepts": ["fastapi"],
                }
            ],
        }
        with patch("agentmemory_client.fetch_agentmemory_export", return_value=mock_export):
            response = self.client.get(
                "/api/v1/agentmemory/graph",
                params={"workspace_id": TEST_WORKSPACE_ID},
                headers=AUTH_HEADERS,
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()
            self.assertEqual(data["status"], "online")
            self.assertEqual(data["event_count"], 2)
            node_ids = [n["id"] for n in data["nodes"]]
            self.assertIn("agentmemory-core", node_ids)
            self.assertIn("session:sess-1", node_ids)
            self.assertIn("mem:mem-1", node_ids)
            self.assertNotIn("mem:mem-other", node_ids)
            self.assertNotIn("session:sess-other", node_ids)
            self.assertIn("obs:obs-1", node_ids)
            self.assertGreaterEqual(len(data["links"]), 3)

    def test_agentmemory_export_uses_authenticated_export_route(self) -> None:
        captured_request: dict[str, object] = {}

        class RecordingClient:
            def __init__(self, timeout: float) -> None:
                captured_request["timeout"] = timeout

            def __enter__(self) -> "RecordingClient":
                return self

            def __exit__(self, *_args: object) -> None:
                return None

            def get(self, url: str, headers: dict[str, str]) -> httpx.Response:
                captured_request["url"] = url
                captured_request["headers"] = headers
                request = httpx.Request("GET", url)
                return httpx.Response(200, json={"memories": []}, request=request)

        with (
            patch.object(agentmemory_client, "AGENTMEMORY_API_URL", "http://localhost:3111"),
            patch.object(agentmemory_client.httpx, "Client", RecordingClient),
            patch.dict(os.environ, {"AGENTMEMORY_TOKEN": "test-agentmemory-token"}),
        ):
            exported = agentmemory_client.fetch_agentmemory_export()

        self.assertEqual(exported, {"memories": []})
        self.assertEqual(
            captured_request["url"],
            "http://localhost:3111/agentmemory/export",
        )
        self.assertEqual(
            captured_request["headers"],
            {"Authorization": "Bearer test-agentmemory-token"},
        )
