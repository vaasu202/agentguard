import logging

from opentelemetry import trace

from .settings import get_settings

logger = logging.getLogger(__name__)


def configure_telemetry() -> bool:
    settings = get_settings()
    if not settings.phoenix_collector_endpoint or not settings.phoenix_api_key:
        return False
    try:
        from phoenix.otel import register

        register(
            project_name=settings.phoenix_project_name,
            endpoint=settings.phoenix_collector_endpoint,
            protocol="http/protobuf",
            headers={"Authorization": f"Bearer {settings.phoenix_api_key}"},
            batch=True,
            auto_instrument=True,
        )
        return True
    except Exception:
        logger.exception("Phoenix registration failed; requests will continue without export")
        return False


tracer = trace.get_tracer("agentguard.intelligence")

