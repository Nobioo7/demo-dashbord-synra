import unittest

from test_support import TEST_API_KEY, TEST_WORKSPACE_ID, SupabaseTestCase


AUTH_HEADERS = {"X-API-Key": TEST_API_KEY}


class MemoryBrowserTests(SupabaseTestCase, unittest.TestCase):
    def add_memory(self, source: str, prompt: str, response: str = "") -> None:
        result = self.client.post(
            "/api/v1/memory/add",
            headers=AUTH_HEADERS,
            json={
                "project_id": "workspace-test",
                "source": source,
                "prompt": prompt,
                "response": response,
            },
        )
        self.assertEqual(result.status_code, 200, result.text)

    def test_memory_browser_requires_authentication(self) -> None:
        response = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID},
        )
        self.assertEqual(response.status_code, 401)

    def test_mock_ingest_jobs_returns_completed_status(self) -> None:
        unauthorized = self.client.get(
            "/api/v1/ingest/jobs",
            params={"project_id": "workspace-test"},
        )
        self.assertEqual(unauthorized.status_code, 401)

        response = self.client.get(
            "/api/v1/ingest/jobs",
            params={"project_id": "workspace-test"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(data["total"], 1)
        self.assertEqual(data["items"][0]["project_id"], "workspace-test")
        self.assertEqual(data["items"][0]["status"], "completed")
        self.assertEqual(data["items"][0]["progress"], 100)

    def test_list_filters_searches_and_paginates_workspace_memories(self) -> None:
        self.add_memory("github", "Review the authentication flow")
        self.add_memory("agentmemory", "Remember the database design")
        self.add_memory("dashboard", "Write deployment notes", "Manual entry")

        first_page = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID, "limit": 2, "offset": 0},
            headers=AUTH_HEADERS,
        )
        second_page = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID, "limit": 2, "offset": 2},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(first_page.status_code, 200, first_page.text)
        self.assertEqual(first_page.json()["total"], 3)
        self.assertEqual(len(first_page.json()["items"]), 2)
        self.assertEqual(len(second_page.json()["items"]), 1)

        github = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID, "source": "github"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(github.json()["total"], 1)
        self.assertEqual(github.json()["items"][0]["source"], "github")

        manual = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID, "source": "manual"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(manual.json()["total"], 1)
        self.assertEqual(manual.json()["items"][0]["source"], "dashboard")

        searched = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID, "q": "DATABASE"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(searched.json()["total"], 1)
        self.assertIn("database", searched.json()["items"][0]["content"].casefold())

        other_workspace = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": "00000000-0000-4000-8000-000000000099"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(other_workspace.status_code, 403)

    def test_detail_is_workspace_scoped_and_delete_soft_hides_memory(self) -> None:
        self.add_memory("github", "Keep this memory searchable after no deletion")
        item = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=AUTH_HEADERS,
        ).json()["items"][0]
        memory_id = item["id"]

        wrong_workspace = self.client.get(
            f"/api/v1/memories/{memory_id}",
            params={"workspace_id": "00000000-0000-4000-8000-000000000099"},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(wrong_workspace.status_code, 403)

        detail = self.client.get(
            f"/api/v1/memories/{memory_id}",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(detail.status_code, 200, detail.text)
        self.assertEqual(detail.json()["id"], memory_id)
        self.assertEqual(detail.json()["source"], "github")
        self.assertEqual(detail.json()["content"], "Keep this memory searchable after no deletion")

        deleted = self.client.delete(
            f"/api/v1/memories/{memory_id}",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(deleted.status_code, 200, deleted.text)
        self.assertEqual(deleted.json()["status"], "deleted")

        hidden_from_list = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=AUTH_HEADERS,
        )
        hidden_from_context = self.client.get(
            "/api/v1/context/workspace-test",
            headers=AUTH_HEADERS,
        )
        hidden_from_detail = self.client.get(
            f"/api/v1/memories/{memory_id}",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=AUTH_HEADERS,
        )
        self.assertEqual(hidden_from_list.json(), {"items": [], "total": 0})
        self.assertEqual(hidden_from_context.json()["event_count"], 0)
        self.assertEqual(hidden_from_detail.status_code, 404)

    def test_malformed_memory_ids_return_not_found(self) -> None:
        query = {"workspace_id": TEST_WORKSPACE_ID}
        detail = self.client.get(
            "/api/v1/memories/not-a-uuid",
            params=query,
            headers=AUTH_HEADERS,
        )
        deleted = self.client.delete(
            "/api/v1/memories/not-a-uuid",
            params=query,
            headers=AUTH_HEADERS,
        )
        self.assertEqual(detail.status_code, 404)
        self.assertEqual(deleted.status_code, 404)


if __name__ == "__main__":
    unittest.main()
