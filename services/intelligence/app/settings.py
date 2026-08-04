from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_api_key: str = ""
    openai_api_key: str = ""
    openai_default_model: str = "gpt-5.6"
    embedding_model: str = "text-embedding-3-small"

    database_url: str = ""
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_collection: str = "agentguard-context"

    litellm_base_url: str = ""
    litellm_api_key: str = ""
    litellm_model: str = "agentguard-primary"

    phoenix_collector_endpoint: str = ""
    phoenix_api_key: str = ""
    phoenix_project_name: str = "agentguard"


@lru_cache
def get_settings() -> Settings:
    return Settings()

