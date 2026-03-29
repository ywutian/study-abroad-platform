#!/usr/bin/env node
/**
 * MCP Server — Expose study-abroad AI Agent tools via Model Context Protocol.
 *
 * Allows Claude Desktop, Cursor, and other MCP clients to call the platform's
 * 42 tools (school search, essay review, profile analysis, etc.) directly.
 *
 * Usage:
 *   npx tsx apps/api/src/mcp-server.ts
 *
 * Environment:
 *   MCP_USER_ID    — User ID to execute tools as (required)
 *   MCP_LOCALE     — Response locale (default: 'zh')
 *   DATABASE_URL   — PostgreSQL connection string
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

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
  SchoolLookupHelper,
  ProfileLoaderHelper,
} from './modules/ai-agent/tools';

// Import domain modules needed by tool services
import { PredictionModule } from './modules/prediction/prediction.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { ForumModule } from './modules/forum/forum.module';
import { HallModule } from './modules/hall/hall.module';
import { ResumeModule } from './modules/resume/resume.module';
import { EssayModule } from './modules/essay/essay.module';
import { RecommendationModule } from './modules/recommendation/recommendation.module';
import { LLMProvidersModule } from './modules/ai-agent/providers/provider.module';

/**
 * Minimal NestJS module for MCP — only what ToolExecutorService needs.
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    PrismaModule,
    RedisModule,
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
    ToolExecutorService,
  ],
})
class McpAppModule {}

async function main() {
  const userId = process.env.MCP_USER_ID;
  if (!userId) {
    console.error('ERROR: MCP_USER_ID environment variable is required');
    process.exit(1);
  }
  const locale = process.env.MCP_LOCALE || 'zh';

  // Bootstrap minimal NestJS app (no HTTP listener)
  const app = await NestFactory.createApplicationContext(McpAppModule, {
    logger: ['error', 'warn'],
  });
  const toolExecutor = app.get(ToolExecutorService);

  // Create MCP server
  const server = new McpServer({
    name: 'study-abroad-tools',
    version: '1.0.0',
  });

  // Register each tool from TOOLS config (skip delegate_to_agent — MCP clients don't need it)
  for (const tool of TOOLS) {
    if (tool.name === 'delegate_to_agent') continue;

    // Build zod schema from JSON Schema (simplified: accept any object)
    server.tool(
      tool.name,
      tool.description,
      { args: z.record(z.unknown()).optional() },
      async ({ args }) => {
        const result = await toolExecutor.execute(
          {
            id: `mcp_${Date.now()}`,
            name: tool.name,
            arguments: (args?.args as Record<string, unknown>) || {},
          },
          userId,
          { userId, profile: undefined, preferences: undefined },
          locale,
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: result.success
                ? JSON.stringify(result.result, null, 2)
                : `Error: ${result.error}`,
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

main().catch((err) => {
  console.error('MCP server failed to start:', err);
  process.exit(1);
});
