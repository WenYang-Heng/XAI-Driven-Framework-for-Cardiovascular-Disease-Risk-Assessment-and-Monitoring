from dotenv import load_dotenv

from app.services.database import get_connection, get_database_url


def main() -> None:
    load_dotenv()

    database_url = get_database_url()
    if not database_url:
        raise RuntimeError(
            "Missing database settings. Set DATABASE_URL or user/password/host/port/dbname in .env."
        )

    try:
        with get_connection() as connection:
            with connection.cursor() as cursor:
                cursor.execute("select 1")
        print("Connection successful!")
    except Exception as error:
        print(f"Failed to connect: {error}")


if __name__ == "__main__":
    main()
