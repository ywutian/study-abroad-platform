import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { McpApiKeyService } from './mcp-api-key.service';

class CreateMcpKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  userId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

@ApiTags('Admin - MCP API Keys')
@Controller('admin/mcp-keys')
@Roles(Role.ADMIN)
export class McpApiKeyController {
  constructor(private readonly mcpKeyService: McpApiKeyService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new MCP API key (returns plain key once)',
  })
  async createKey(@Body() dto: CreateMcpKeyDto) {
    const result = await this.mcpKeyService.generateKey(
      dto.userId,
      dto.name,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    );
    return {
      message:
        'API key created. Save the key now — it cannot be retrieved later.',
      ...result,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List all MCP API keys (no hashes)' })
  async listKeys() {
    return this.mcpKeyService.listKeys();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke an MCP API key' })
  async revokeKey(@Param('id') id: string) {
    await this.mcpKeyService.revokeKey(id);
  }
}
