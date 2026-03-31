-- Graph entities and relationships for knowledge graph memory

CREATE TABLE IF NOT EXISTS "graph_entities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "graph_entities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "graph_entities_userId_entityType_name_key" ON "graph_entities"("userId", "entityType", "name");
CREATE INDEX "graph_entities_userId_entityType_idx" ON "graph_entities"("userId", "entityType");

CREATE TABLE IF NOT EXISTS "entity_relationships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceEntityId" TEXT NOT NULL,
    "targetEntityId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entity_relationships_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "graph_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "entity_relationships_targetEntityId_fkey" FOREIGN KEY ("targetEntityId") REFERENCES "graph_entities"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "entity_relationships_userId_sourceEntityId_idx" ON "entity_relationships"("userId", "sourceEntityId");
CREATE INDEX "entity_relationships_userId_relationType_idx" ON "entity_relationships"("userId", "relationType");
