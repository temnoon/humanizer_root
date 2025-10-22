"""
Configuration management using Pydantic Settings
"""

from enum import Enum
from typing import Literal, Optional
from pydantic_settings import BaseSettings


class DeploymentMode(str, Enum):
    """Deployment mode determines which features are available"""
    LOCAL = "local"           # Desktop app: full features, local storage
    WEB_EPHEMERAL = "web"     # humanizer.com: transform only, no persistence
    API_SERVICE = "api"       # API: metered usage, multi-tenant


class Settings(BaseSettings):
    """Application settings."""

    # Database
    database_url: str = "postgresql+asyncpg://localhost/humanizer_dev"

    # TRM
    trm_rank: int = 64
    embedding_model: str = "all-MiniLM-L6-v2"

    # API
    api_title: str = "Humanizer API"
    api_version: str = "1.0.0"
    api_port: int = 8000

    # CORS (allow file:// for local HTML, localhost for dev servers)
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:5173,http://localhost:8000,null"

    # AUI (Agentic User Interface)
    aui_llm_provider: str = "claude"  # "claude" or "ollama"
    claude_model: str = "claude-haiku-4-5-20251001"
    claude_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "mistral:7b"

    # Enable prompt caching for Claude (90% cost reduction)
    claude_enable_caching: bool = True

    # Max tokens for AUI responses
    aui_max_tokens: int = 4096

    # Deployment configuration
    deployment_mode: DeploymentMode = DeploymentMode.LOCAL

    # Storage backend selection
    storage_backend: Literal["postgres", "sqlite", "ephemeral"] = "postgres"

    # SQLite path (for mobile/desktop deployments)
    sqlite_path: Optional[str] = None

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def features_enabled(self) -> dict:
        """Return enabled features based on deployment mode"""
        features = {
            DeploymentMode.LOCAL: {
                "archives": True,
                "embeddings": True,
                "offline": True,
                "cloud_sync": True,  # Optional
                "full_search": True,
            },
            DeploymentMode.WEB_EPHEMERAL: {
                "archives": False,
                "embeddings": False,  # Could use client-side
                "offline": False,
                "cloud_sync": False,
                "full_search": False,
                "transform_only": True,
            },
            DeploymentMode.API_SERVICE: {
                "archives": True,
                "embeddings": True,
                "offline": False,
                "cloud_sync": False,
                "full_search": True,
                "metering": True,
                "webhooks": True,
            }
        }
        return features[self.deployment_mode]

    @property
    def storage_config(self) -> dict:
        """Return storage configuration based on backend"""
        if self.storage_backend == "postgres":
            return {
                "url": self.database_url,
                "pool_size": 10,
            }
        elif self.storage_backend == "sqlite":
            return {
                "path": self.sqlite_path or "./humanizer.db",
            }
        elif self.storage_backend == "ephemeral":
            return {
                "max_memory_mb": 100,
            }
        return {}

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# Global settings instance
settings = Settings()
