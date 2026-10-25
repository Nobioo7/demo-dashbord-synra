import copy
import hashlib
import hmac
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from unittest.mock import patch
from uuid import uuid4


BACKEND_PATH = str(Path(__file__).resolve().parents[1])
if BACKEND_PATH not in sys.path:
    sys.path.insert(0, BACKEND_PATH)

os.environ.setdefault("SYNRA_SESSION_SECRET", "test-only-session-secret")

import main
import agentmemory_client


TEST_USER_ID = "test-user-123"
TEST_WORKSPACE_ID = "00000000-0000-4000-8000-000000000001"
TEST_API_KEY = "synra_test_key_for_backend_tests"
TEST_SESSION_SECRET = "test-only-session-secret"


def web_headers(user_id: str = TEST_USER_ID) -> dict[str, str]:
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    signature = hmac.new(
        TEST_SESSION_SECRET.encode("utf-8"),
        f"{user_id}\n{timestamp}".encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return {
        "X-Synra-User-Id": user_id,
        "X-Synra-Auth-Timestamp": timestamp,
        "X-Synra-Auth-Signature": signature,
    }


class FakeResult:
    def __init__(self, data: list[dict[str, Any]] | None = None) -> None:
        self.data = data or []


class FakeSupabaseQuery:
    def __init__(self, database: "FakeSupabase", table_name: str) -> None:
        self.database = database
        self.table_name = table_name
        self.operation = "select"
        self.payload: dict[str, Any] | list[dict[str, Any]] = {}
        self.columns = "*"
        self.returning = False
        self.filters: list[tuple[str, str, Any]] = []
        self.orders: list[tuple[str, bool]] = []
        self.start: int | None = None
        self.end: int | None = None
        self.max_rows: int | None = None
        self.conflict_fields: list[str] = []

    def select(self, columns: str = "*", **_kwargs: Any) -> "FakeSupabaseQuery":
        self.columns = columns
        if self.operation != "select":
            self.returning = True
        return self

    def insert(self, values: dict[str, Any] | list[dict[str, Any]]) -> "FakeSupabaseQuery":
        self.operation = "insert"
        self.payload = values
        return self

    def upsert(
        self,
        values: dict[str, Any] | list[dict[str, Any]],
        on_conflict: str | None = None,
        **_kwargs: Any,
    ) -> "FakeSupabaseQuery":
        self.operation = "upsert"
        self.payload = values
        self.conflict_fields = [field.strip() for field in (on_conflict or "id").split(",")]
        return self

    def update(self, values: dict[str, Any]) -> "FakeSupabaseQuery":
        self.operation = "update"
        self.payload = values
        return self

    def eq(self, field: str, value: Any) -> "FakeSupabaseQuery":
        self.filters.append(("eq", field, value))
        return self

    def is_(self, field: str, value: Any) -> "FakeSupabaseQuery":
        self.filters.append(("is", field, value))
        return self

    def limit(self, count: int) -> "FakeSupabaseQuery":
        self.max_rows = count
        return self

    def order(self, field: str, desc: bool = False, **_kwargs: Any) -> "FakeSupabaseQuery":
        self.orders.append((field, desc))
        return self

    def range(self, start: int, end: int) -> "FakeSupabaseQuery":
        self.start = start
        self.end = end
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        for operation, field, value in self.filters:
            actual = row.get(field)
            if operation == "eq" and actual != value:
                return False
            if operation == "is" and value == "null" and actual is not None:
                return False
            if operation == "is" and value != "null" and actual is not value:
                return False
        return True

    def _defaults(self, values: dict[str, Any]) -> dict[str, Any]:
        now = datetime.now(timezone.utc).isoformat()
        defaults: dict[str, dict[str, Any]] = {
            "workspaces": {"id": str(uuid4()), "created_at": now},
            "memories": {
                "id": str(uuid4()),
                "event_type": "memory",
                "content": "",
                "prompt": "",
                "response": "",
                "metadata": {},
                "created_at": now,
                "is_deleted": False,
            },
            "api_keys": {
                "id": str(uuid4()),
                "created_at": now,
                "last_used_at": None,
                "revoked_at": None,
            },
            "sync_runs": {"last_run_at": now, "items_ingested": 0},
            "waitlist_signups": {"id": str(uuid4()), "created_at": now},
        }
        row = defaults.get(self.table_name, {}).copy()
        row.update(values)
        return row

    def _returning_rows(self, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not self.returning and self.operation != "select":
            return []
        if self.columns.strip() == "*":
            return copy.deepcopy(rows)
        selected = [column.strip() for column in self.columns.split(",") if column.strip()]
        return [{column: copy.deepcopy(row.get(column)) for column in selected} for row in rows]

    def execute(self) -> FakeResult:
        rows = self.database.tables.setdefault(self.table_name, [])

        if self.operation == "insert":
            inserted = []
            values = self.payload if isinstance(self.payload, list) else [self.payload]
            for value in values:
                row = self._defaults(dict(value))
                rows.append(row)
                inserted.append(row)
            return FakeResult(self._returning_rows(inserted))

        if self.operation == "upsert":
            upserted = []
            values = self.payload if isinstance(self.payload, list) else [self.payload]
            for value in values:
                row = self._defaults(dict(value))
                existing = next(
                    (
                        item for item in rows
                        if all(item.get(field) == row.get(field) for field in self.conflict_fields)
                    ),
                    None,
                )
                if existing is None:
                    rows.append(row)
                    upserted.append(row)
                else:
                    existing.update(row)
                    upserted.append(existing)
            return FakeResult(self._returning_rows(upserted))

        matching = [row for row in rows if self._matches(row)]
        if self.operation == "update":
            values = self.payload if isinstance(self.payload, dict) else {}
            for row in matching:
                row.update(values)
            return FakeResult(self._returning_rows(matching))

        result = matching
        for field, descending in reversed(self.orders):
            result = sorted(
                result,
                key=lambda row: (row.get(field) is not None, str(row.get(field) or "")),
                reverse=descending,
            )
        if self.max_rows is not None:
            result = result[:self.max_rows]
        if self.start is not None:
            result = result[self.start:(self.end + 1 if self.end is not None else None)]
        return FakeResult(self._returning_rows(result))


class FakeSupabase:
    def __init__(self) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {}
        self.table("workspaces").insert(
            {"id": TEST_WORKSPACE_ID, "name": "Test workspace", "owner_id": TEST_USER_ID}
        ).execute()
        self.table("api_keys").insert(
            {
                "id": "00000000-0000-4000-8000-000000000002",
                "name": "Test integration key",
                "owner_id": TEST_USER_ID,
                "workspace_id": TEST_WORKSPACE_ID,
                "key_hash": hashlib.sha256(TEST_API_KEY.encode("utf-8")).hexdigest(),
            }
        ).execute()

    def table(self, table_name: str) -> FakeSupabaseQuery:
        return FakeSupabaseQuery(self, table_name)


class SupabaseTestCase:
    def setUp(self) -> None:
        self.store = FakeSupabase()
        self.supabase_patch = patch.object(main, "supabase", self.store)
        self.secret_patch = patch.object(
            main,
            "SYNRA_SESSION_SECRET",
            TEST_SESSION_SECRET,
        )
        self.supabase_patch.start()
        self.secret_patch.start()
        from fastapi.testclient import TestClient

        self.client = TestClient(main.app)

    def tearDown(self) -> None:
        self.client.close()
        self.secret_patch.stop()
        self.supabase_patch.stop()
