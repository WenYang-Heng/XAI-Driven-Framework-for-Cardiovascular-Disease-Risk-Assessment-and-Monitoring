import os

# Force the in-memory store so tests never touch the Supabase database.
os.environ["DATABASE_URL"] = ""
for key in ("DB_USER", "DB_PASSWORD", "DB_HOST", "DB_NAME", "user", "password", "host", "dbname"):
    os.environ.pop(key, None)
