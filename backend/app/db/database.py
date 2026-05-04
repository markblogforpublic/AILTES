"""MongoDB connection management using Motor (async driver)."""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import settings

client: AsyncIOMotorClient | None = None


async def get_db() -> AsyncIOMotorDatabase:
    """Return the application database instance."""
    global client
    if client is None:
        client = AsyncIOMotorClient(
            settings.mongodb_url,
            serverSelectionTimeoutMS=3000,  # fail fast if MongoDB is not running
        )
    return client[settings.mongodb_db_name]


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        client = None


async def ping_db() -> bool:
    """Verify the database connection is alive."""
    db = await get_db()
    try:
        await db.command("ping")
        return True
    except Exception:
        return False
