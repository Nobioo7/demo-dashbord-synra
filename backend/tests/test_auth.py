import hashlib
import hmac
import time
import unittest

from test_support import (
    TEST_API_KEY,
    TEST_SESSION_SECRET,
    TEST_USER_ID,
    TEST_WORKSPACE_ID,
    SupabaseTestCase,
    main,
    web_headers,
)


API_HEADERS = {"X-API-Key": TEST_API_KEY}


class ApiKeyAuthTests(SupabaseTestCase, unittest.TestCase):
    def test_root_without_credentials_is_unauthorized(self) -> None:
        response = self.client.get("/")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json(), {"detail": "Unauthorized"})

    def test_root_rejects_unknown_key(self) -> None:
        response = self.client.get("/", headers={"X-API-Key": "unknown"})
        self.assertEqual(response.status_code, 401)

    def test_root_accepts_scoped_api_key(self) -> None:
        response = self.client.get("/", headers=API_HEADERS)
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(self.store.tables["api_keys"][0]["last_used_at"])

    def test_bearer_token_is_not_an_integration_credential(self) -> None:
        response = self.client.get("/", headers={"Authorization": f"Bearer {TEST_API_KEY}"})
        self.assertEqual(response.status_code, 401)

    def test_invalid_api_key_is_rejected_even_with_bearer_header(self) -> None:
        response = self.client.get(
            "/",
            headers={
                "Authorization": f"Bearer {TEST_API_KEY}",
                "X-API-Key": "different",
            },
        )
        self.assertEqual(response.status_code, 401)

    def test_health_is_exempt_and_checks_supabase(self) -> None:
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["storage"]["provider"], "supabase")

    def test_openapi_is_exempt(self) -> None:
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)

    def test_memory_add_requires_authentication(self) -> None:
        response = self.client.post(
            "/api/v1/memory/add",
            json={"project_id": "auth-test", "prompt": "no key"},
        )
        self.assertEqual(response.status_code, 401)

    def test_memory_add_uses_workspace_bound_to_api_key(self) -> None:
        response = self.client.post(
            "/api/v1/memory/add",
            headers=API_HEADERS,
            json={
                "project_id": "auth-test",
                "source_tool": "test",
                "prompt": "authorized memory",
                "response": "stored",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

        context = self.client.get(
            "/api/v1/context/auth-test",
            headers=API_HEADERS,
        )
        self.assertEqual(context.status_code, 200, context.text)
        self.assertEqual(context.json()["event_count"], 1)
        self.assertEqual(
            self.store.tables["memories"][0]["workspace_id"],
            TEST_WORKSPACE_ID,
        )

    def test_memory_add_accepts_project_and_source_aliases(self) -> None:
        response = self.client.post(
            "/api/v1/memory/add",
            headers=API_HEADERS,
            json={
                "project": "alias-project",
                "source": "extension",
                "prompt": "Alias payload",
                "response": "Stored locally",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)

        context = self.client.get(
            "/api/v1/memory/context",
            params={"project_id": "alias-project"},
            headers=API_HEADERS,
        )
        self.assertEqual(context.status_code, 200, context.text)
        data = context.json()
        self.assertEqual(data["project_id"], "alias-project")
        self.assertEqual(data["event_count"], 1)
        source_nodes = [node for node in data["nodes"] if node["group"] == "source"]
        self.assertEqual([node["label"] for node in source_nodes], ["extension"])

    def test_api_key_cannot_select_a_different_workspace(self) -> None:
        response = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": "00000000-0000-4000-8000-000000000099"},
            headers=API_HEADERS,
        )
        self.assertEqual(response.status_code, 403)

    def test_revoked_api_key_is_rejected(self) -> None:
        self.store.tables["api_keys"][0]["revoked_at"] = "2026-10-25T00:00:00+00:00"
        response = self.client.get("/", headers=API_HEADERS)
        self.assertEqual(response.status_code, 401)

    def test_signed_web_identity_can_create_owned_workspace(self) -> None:
        response = self.client.post(
            "/api/v1/workspaces",
            headers=web_headers(),
            json={"name": "New workspace"},
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(response.json()["name"], "New workspace")
        self.assertEqual(self.store.tables["workspaces"][-1]["owner_id"], TEST_USER_ID)

    def test_web_user_cannot_access_another_users_workspace(self) -> None:
        self.store.tables["workspaces"].append(
            {
                "id": "00000000-0000-4000-8000-000000000003",
                "name": "Other workspace",
                "owner_id": "other-user",
            }
        )
        response = self.client.get(
            "/api/v1/memories",
            params={"workspace_id": "00000000-0000-4000-8000-000000000003"},
            headers=web_headers(),
        )
        self.assertEqual(response.status_code, 404)

    def test_api_keys_are_returned_once_stored_as_hashes_and_revocable(self) -> None:
        created = self.client.post(
            "/api/v1/api-keys",
            headers=web_headers(),
            json={
                "workspace_id": TEST_WORKSPACE_ID,
                "name": "MCP test key",
            },
        )
        self.assertEqual(created.status_code, 201, created.text)
        key_data = created.json()
        raw_key = key_data["key"]
        self.assertTrue(raw_key.startswith("synra_"))

        stored = next(
            row for row in self.store.tables["api_keys"]
            if row["id"] == key_data["id"]
        )
        self.assertEqual(stored["key_hash"], hashlib.sha256(raw_key.encode("utf-8")).hexdigest())
        self.assertNotIn("key", stored)

        listed = self.client.get(
            "/api/v1/api-keys",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=web_headers(),
        )
        self.assertEqual(listed.status_code, 200, listed.text)
        self.assertNotIn(raw_key, listed.text)
        self.assertNotIn("key_hash", listed.text)

        revoked = self.client.delete(
            f"/api/v1/api-keys/{key_data['id']}",
            params={"workspace_id": TEST_WORKSPACE_ID},
            headers=web_headers(),
        )
        self.assertEqual(revoked.status_code, 200, revoked.text)
        rejected = self.client.get("/", headers={"X-API-Key": raw_key})
        self.assertEqual(rejected.status_code, 401)

    def test_tampered_session_signature_is_unauthorized(self) -> None:
        headers = web_headers()
        headers["X-Synra-User-Id"] = "attacker"
        response = self.client.get("/", headers=headers)
        self.assertEqual(response.status_code, 401)

    def test_expired_session_signature_is_unauthorized(self) -> None:
        timestamp = str(int(time.time()) - 61)
        signature = hmac.new(
            TEST_SESSION_SECRET.encode("utf-8"),
            f"{TEST_USER_ID}\n{timestamp}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        response = self.client.get(
            "/",
            headers={
                "X-Synra-User-Id": TEST_USER_ID,
                "X-Synra-Auth-Timestamp": timestamp,
                "X-Synra-Auth-Signature": signature,
            },
        )
        self.assertEqual(response.status_code, 401)


if __name__ == "__main__":
    unittest.main()
