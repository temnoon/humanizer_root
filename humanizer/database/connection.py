"""
Database connection and session management

Uses SQLAlchemy 2.0 async patterns with PostgreSQL + pgvector.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

# For now, use hardcoded DB URL (will move to config)
DATABASE_URL = "postgresql+asyncpg://localhost/humanizer_dev"

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=True,  # Log SQL queries (disable in production)
    poolclass=NullPool,  # For development simplicity
)

# Create async session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Base class for all models
Base = declarative_base()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI routes.

    Usage:
        @router.get("/readings")
        async def get_readings(session: AsyncSession = Depends(get_session)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """
    Initialize database (create all tables).

    Only use in development. In production, use Alembic migrations.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_db():
    """
    Drop all tables (CAREFUL!).

    Only use in testing.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
