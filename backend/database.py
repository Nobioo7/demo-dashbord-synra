import os
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client


@lru_cache(maxsize=1)
def get_supabase_client() -> Optional[Client]:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_KEY", "").strip()
    if bool(url) != bool(key):
        raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured together.")
    if not url:
        return None
    return create_client(url, key)
