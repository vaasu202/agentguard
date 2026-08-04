from .settings import get_settings


BASELINE_CONTROLS = [
    "AG-101 blocks instruction-override language originating in untrusted retrieved content.",
    "AG-102 blocks destructive SQL including DROP, TRUNCATE, and DELETE FROM.",
    "AG-103 pauses state-changing production actions for human approval.",
    "AG-105 redacts credential-shaped values before outbound tool execution.",
    "AG-106 permits registered read-only tools for authenticated principals.",
]


def _vector_store():
    settings = get_settings()
    if not settings.qdrant_url or not settings.qdrant_api_key:
        raise RuntimeError("Qdrant is not configured")
    from llama_index.vector_stores.qdrant import QdrantVectorStore
    from qdrant_client import QdrantClient

    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key)
    return QdrantVectorStore(client=client, collection_name=settings.qdrant_collection)


async def retrieve_controls(query: str, limit: int = 3) -> list[str]:
    settings = get_settings()
    if not (settings.qdrant_url and settings.qdrant_api_key and settings.openai_api_key):
        return BASELINE_CONTROLS[:limit]
    from llama_index.core import VectorStoreIndex
    from llama_index.embeddings.openai import OpenAIEmbedding

    index = VectorStoreIndex.from_vector_store(
        _vector_store(),
        embed_model=OpenAIEmbedding(model=settings.embedding_model, api_key=settings.openai_api_key),
    )
    nodes = await index.as_retriever(similarity_top_k=limit).aretrieve(query)
    return [node.get_content() for node in nodes] or BASELINE_CONTROLS[:limit]


def ingest_documents(documents: list[str], source: str) -> int:
    settings = get_settings()
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required to create hosted embeddings")
    from llama_index.core import Document, StorageContext, VectorStoreIndex
    from llama_index.embeddings.openai import OpenAIEmbedding

    llama_documents = [Document(text=text, metadata={"source": source}) for text in documents]
    storage = StorageContext.from_defaults(vector_store=_vector_store())
    VectorStoreIndex.from_documents(
        llama_documents,
        storage_context=storage,
        embed_model=OpenAIEmbedding(model=settings.embedding_model, api_key=settings.openai_api_key),
    )
    return len(llama_documents)

