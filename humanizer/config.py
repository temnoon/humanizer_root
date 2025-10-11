"""
Configuration management using Pydantic Settings
"""

from pydantic_settings import BaseSettings


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

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


# Global settings instance
settings = Settings()
