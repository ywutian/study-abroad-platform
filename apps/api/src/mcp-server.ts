#!/usr/bin/env node
/**
 * MCP Server — Expose study-abroad AI Agent tools via Model Context Protocol.
 *
 * Allows Claude Desktop, Cursor, and other MCP clients to call the platform's
 * 42+ tools (school search, essay review, profile analysis, etc.) directly.
 *
 * Usage:
 *   npx tsx apps/api/src/mcp-server.ts
 *
 * Environment:
 *   MCP_API_KEY    — API key for authentication (recommended, created via /admin/mcp-keys)
 *   MCP_USER_ID    — User ID fallback for development (deprecated)
 *   MCP_LOCALE     — Response locale (default: 'zh')
 *   DATABASE_URL   — PostgreSQL connection string
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { AppModule } from './app.module';

import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { ToolExecutorService } from './modules/ai-agent/core/tool-executor.service';
import { TOOLS } from './modules/ai-agent/config/tools.config';

// Import all tool domain services
import {
  ProfileToolsService,
  SchoolToolsService,
  EssayToolsService,
  RecommendationToolsService,
  PredictionToolsService,
  CaseToolsService,
  TimelineToolsService,
  AssessmentToolsService,
  ForumToolsService,
  RankingToolsService,
  SearchToolsService,
  ResumeToolsService,
  SimilarityToolsService,
  SchoolLookupHelper,
  ProfileLoaderHelper,
} from './modules/ai-agent/tools';
import { McpApiKeyService } from './modules/auth/mcp-api-key.service';

// Import domain modules needed by tool services
import { PredictionModule } from './modules/prediction/prediction.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ForumModule } from './modules/forum/forum.module';
import { HallModule } from './modules/hall/hall.module';
import { ResumeModule } from './modules/resume/resume.module';
import { EssayModule } from './modules/essay/essay.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { LLMProvidersModule } from './modules/ai-agent/providers/provider.module';
import { AgentSecurityModule } from './modules/ai-agent/security/security.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ContentModerationService } from './modules/ai-agent/security/content-moderation.service';
import {
  getMcpAuthErrorMessage,
  normalizeMcpArguments,
  serializeMcpToolContent,
} from './mcp-server.helpers';

const MCP_TOOL_INPUT_SCHEMA = z.object({}).passthrough();

/**
 * Minimal NestJS module for MCP — only what ToolExecutorService needs.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AgentSecurityModule,
    SettingsModule,
    LLMProvidersModule.forRoot(),
    PredictionModule,
    AssessmentModule,
    ForumModule,
    HallModule,
    ResumeModule,
    EssayModule,
    RecommendationModule,
  ],
  providers: [
    SchoolLookupHelper,
    ProfileLoaderHelper,
    ProfileToolsService,
    SchoolToolsService,
    EssayToolsService,
    RecommendationToolsService,
    PredictionToolsService,
    CaseToolsService,
    TimelineToolsService,
    AssessmentToolsService,
    ForumToolsService,
    RankingToolsService,
    SearchToolsService,
    ResumeToolsService,
    SimilarityToolsService,
    ToolExecutorService,
    McpApiKeyService,
  ],
})
class McpAppModule {}

export async function main() {
  const locale = process.env.MCP_LOCALE || 'zh';

  // Bootstrap minimal NestJS app (no HTTP listener)
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const toolExecutor = app.get(ToolExecutorService);
  const contentModeration = app.get(ContentModerationService);

  // ── Authenticate via API Key or fallback to MCP_USER_ID (dev only) ──
  let userId: string;
  const apiKey = process.env.MCP_API_KEY;
  if (apiKey) {
    const mcpKeyService = app.get(McpApiKeyService);
    const validation = await mcpKeyService.validateKeyDetailed(apiKey);
    if (validation.status !== 'valid' || !validation.info) {
      console.error(`ERROR: ${getMcpAuthErrorMessage(validation.status)}`);
      process.exit(1);
    }
    const keyInfo = validation.info;
    userId = keyInfo.userId;
    await mcpKeyService.updateLastUsed(keyInfo.keyId);
    console.error(
      `MCP Server authenticated via API key "${keyInfo.name}" as user ${userId} (${keyInfo.role})`,
    );
  } else if (process.env.MCP_USER_ID) {
    userId = process.env.MCP_USER_ID;
    console.error(
      'WARNING: Using MCP_USER_ID without API key validation (dev mode). Set MCP_API_KEY for production.',
    );
  } else {
    console.error(
      'ERROR: MCP_API_KEY or MCP_USER_ID environment variable is required',
    );
    process.exit(1);
  }

  // Create MCP server
  const server = new McpServer({
    name: 'study-abroad-tools',
    version: '1.0.0',
  });

  // Register each tool from TOOLS config (skip delegate_to_agent — MCP clients don't need it)
  for (const tool of TOOLS) {
    if (tool.name === 'delegate_to_agent') continue;

    // Build zod schema from JSON Schema (simplified: accept any object)
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: MCP_TOOL_INPUT_SCHEMA,
      },
      async (args) => {
        const result = await toolExecutor.execute(
          {
            id: `mcp_${Date.now()}`,
            name: tool.name,
            arguments: normalizeMcpArguments(args),
          },
          userId,
          { userId, profile: undefined, preferences: undefined },
          locale,
        );

        const text = await serializeMcpToolContent(
          tool.name,
          result,
          contentModeration,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text,
            },
          ],
        };
      },
    );
  }

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('MCP server failed to start:', err);
    process.exit(1);
  });
}
