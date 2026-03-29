-- Agent route embeddings for semantic routing (pgvector)
CREATE TABLE IF NOT EXISTS "agent_route_embeddings" (
    "id" TEXT NOT NULL,
    "agent_type" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_route_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "agent_route_embeddings_agent_type_idx" ON "agent_route_embeddings"("agent_type");
