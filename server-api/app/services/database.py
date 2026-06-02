import os
from urllib.parse import quote_plus

import psycopg2
from psycopg2.extensions import connection


def get_database_url() -> str:
    explicit_url = os.getenv("DATABASE_URL")
    if explicit_url:
        return explicit_url

    user = os.getenv("DB_USER") or os.getenv("user")
    password = os.getenv("DB_PASSWORD") or os.getenv("password")
    host = os.getenv("DB_HOST") or os.getenv("host")
    port = os.getenv("DB_PORT") or os.getenv("port", "5432")
    dbname = os.getenv("DB_NAME") or os.getenv("dbname")

    if not all([user, password, host, port, dbname]):
        return ""

    return f"postgresql://{quote_plus(user)}:{quote_plus(password)}@{host}:{port}/{dbname}?sslmode=require"


def database_enabled() -> bool:
    return bool(get_database_url())


def get_connection() -> connection:
    return psycopg2.connect(get_database_url())
