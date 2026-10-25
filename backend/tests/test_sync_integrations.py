import json
from datetime import datetime
from pathlib import Path
import unittest
from unittest.mock import patch
from uuid import NAMESPACE_URL, uuid5

from test_support import TEST_API_KEY, TEST_WORKSPACE_ID, SupabaseTestCase, main


FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sync_events.json"
AUTH_HEADERS = {"X-API-Key": TEST_API_KEY}


def load_events(source_tool: str) -> list[tuple[str, str, str, dict, datetime]]:
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return [
        (
            event["event_type"],
            event["prompt"],
            event["response"],
            event["metadata"],
            datetime.fromisoformat(event["timestamp"].replace("Z", "+00:00")),
        )
        for event in fixtures[source_tool]
    ]


class IntegrationSyncTests(SupabaseTestCase, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.github_mode_patch = patch.object(main, "GITHUB_SYNC_MODE", "live")
        self.github_mode_patch.start()

    def tearDown(self) -> None:
        self.github_mode_patch.stop()
        super().tearDown()

    def assert_sync_is_idempotent(self, source_tool: str) -> None:
        project_id = f"fixture-{source_tool}-sync"
        fixture_loader = lambda *_args, **_kwargs: load_events(source_tool)
        route = f"/api/v1/integrations/{source_tool}/sync"

        if source_tool == "github":
            patcher = patch.object(main, "github_memory_events", side_effect=fixture_loader)
        else:
            patcher = patch.object(main, "gmail_memory_events", side_effect=fixture_loader)

        with patcher:
            if source_tool == "gmail":
                with patch.object(main, "GMAIL_TOKEN", "fixture-access-token"):
                    first = self.client.post(route, json={"project_id": project_id}, headers=AUTH_HEADERS)
                    second = self.client.post(route, json={"project_id": project_id}, headers=AUTH_HEADERS)
            else:
                first = self.client.post(route, json={"project_id": project_id}, headers=AUTH_HEADERS)
                second = self.client.post(route, json={"project_id": project_id}, headers=AUTH_HEADERS)

        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(second.status_code, 200, second.text)
        first_data = first.json()
        second_data = second.json()
        self.assertEqual(first_data["items_ingested"], 1)
        self.assertEqual(second_data["items_ingested"], 0)
        self.assertGreaterEqual(second_data["last_run_at"], first_data["last_run_at"])

        context = self.client.get(f"/api/v1/context/{project_id}", headers=AUTH_HEADERS)
        self.assertEqual(context.status_code, 200, context.text)
        context_data = context.json()
        self.assertEqual(context_data["event_count"], 1)
        self.assertEqual(
            [node["source"] for node in context_data["nodes"] if node["group"] == "memory"],
            [source_tool],
        )

        run_id = str(uuid5(
            NAMESPACE_URL,
            f"synra-sync:{TEST_WORKSPACE_ID}:{project_id}:{source_tool}",
        ))
        run = next(
            row for row in self.store.tables["sync_runs"]
            if row["id"] == run_id
        )
        self.assertEqual(run["items_ingested"], 0)
        self.assertEqual(run["last_run_at"], second_data["last_run_at"])

    def test_github_fixture_sync_is_idempotent_and_recorded(self) -> None:
        self.assert_sync_is_idempotent("github")

    def test_github_auth_error_keeps_upstream_status_and_message(self) -> None:
        project_id = "fixture-github-auth-error"
        with patch.object(
            main,
            "github_memory_events",
            side_effect=main.GitHubAPIError(401, "Bad credentials"),
        ):
            response = self.client.post(
                "/api/v1/integrations/github/sync",
                json={"project_id": project_id},
                headers=AUTH_HEADERS,
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "GitHub API error: Bad credentials")
        self.assertEqual(response.json()["items_ingested"], 0)
        self.assertIn("last_run_at", response.json())
        run_id = str(uuid5(
            NAMESPACE_URL,
            f"synra-sync:{TEST_WORKSPACE_ID}:{project_id}:github",
        ))
        run = next(
            row for row in self.store.tables["sync_runs"]
            if row["id"] == run_id
        )
        self.assertEqual(run["items_ingested"], 0)

    def test_github_code_sync_creates_code_memory(self) -> None:
        code_event = (
            "code_file",
            "Source file: Nobioo7/synra-v1/backend/main.py",
            "def health_check(): return {'status': 'ok'}",
            {"path": "backend/main.py", "seed_id": "fixture:github:file:main"},
            datetime.fromisoformat("2026-10-01T12:00:00+00:00"),
        )
        with patch.object(main, "github_memory_events", return_value=[code_event]) as sync:
            response = self.client.post(
                "/api/v1/integrations/github/sync",
                json={"project_id": "fixture-github-code", "include_code": True, "code_paths": ["backend/main.py"]},
                headers=AUTH_HEADERS,
            )

        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["code_files"], 1)
        self.assertEqual(response.json()["items_ingested"], 1)
        self.assertEqual(sync.call_args.args, (True, ["backend/main.py"]))
        context = self.client.get("/api/v1/context/fixture-github-code", headers=AUTH_HEADERS)
        self.assertEqual(context.status_code, 200, context.text)
        self.assertEqual(context.json()["nodes"][-1]["event_type"], "code_file")

    def test_github_code_sync_rejects_parent_paths(self) -> None:
        response = self.client.post(
            "/api/v1/integrations/github/sync",
            json={"project_id": "fixture-github-code", "include_code": True, "code_paths": ["../.env"]},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(response.status_code, 422)

    def test_github_sync_uses_local_mock_when_requested(self) -> None:
        with patch.object(main, "GITHUB_SYNC_MODE", "mock"):
            response = self.client.post(
                "/api/v1/integrations/github/sync",
                json={"project_id": "fixture-github-mock"},
                headers=AUTH_HEADERS,
            )

        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["synced_count"], 5)
        self.assertEqual(data["items_ingested"], 0)
        self.assertEqual(data["code_files"], 0)

    def test_unconfigured_gmail_sync_records_attempt(self) -> None:
        with patch.object(main, "GMAIL_TOKEN", ""), patch.dict(
            "os.environ",
            {
                "GMAIL_TOKEN": "",
                "GMAIL_CLIENT_ID": "",
                "GMAIL_CLIENT_SECRET": "",
                "GMAIL_REFRESH_TOKEN": "",
            },
        ):
            response = self.client.post(
                "/api/v1/integrations/gmail/sync",
                json={"project_id": "fixture-gmail-unconfigured"},
                headers=AUTH_HEADERS,
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["items_ingested"], 0)
        self.assertIn("last_run_at", response.json())

    def test_gmail_fixture_sync_is_idempotent_and_recorded(self) -> None:
        self.assert_sync_is_idempotent("gmail")


if __name__ == "__main__":
    unittest.main()
