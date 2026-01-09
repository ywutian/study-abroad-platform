import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { VaultService } from './vault.service';
import {
  CreateVaultItemDto,
  UpdateVaultItemDto,
  VaultQueryDto,
  VaultItemDto,
  VaultItemDetailDto,
  VaultStatsDto,
  ImportVaultItemDto,
} from './dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('vault')
@Controller('vault')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VaultController {
  constructor(private readonly vaultService: VaultService) {}

  // ============================================
  // CRUD Operations
  // ============================================

  @Post()
  @ApiOperation({ summary: 'Create a new vault item' })
  @ApiResponse({ status: 201, type: VaultItemDto })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateVaultItemDto,
  ): Promise<VaultItemDto> {
    return this.vaultService.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all vault items' })
  @ApiResponse({ status: 200, type: [VaultItemDto] })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: VaultQueryDto,
  ): Promise<VaultItemDto[]> {
    return this.vaultService.findAll(user.id, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get vault statistics' })
  @ApiResponse({ status: 200, type: VaultStatsDto })
  async getStats(@CurrentUser() user: CurrentUserPayload): Promise<VaultStatsDto> {
    return this.vaultService.getStats(user.id);
  }

  @Get('generate-password')
  @ApiOperation({ summary: 'Generate a secure password' })
  @ApiResponse({ status: 200, schema: { properties: { password: { type: 'string' } } } })
  generatePassword(@Query('length') length?: string): { password: string } {
    const len = length ? parseInt(length, 10) : 16;
    return { password: this.vaultService.generatePassword(Math.min(Math.max(len, 8), 64)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vault item with decrypted data' })
  @ApiResponse({ status: 200, type: VaultItemDetailDto })
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<VaultItemDetailDto> {
    return this.vaultService.findOne(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a vault item' })
  @ApiResponse({ status: 200, type: VaultItemDto })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateVaultItemDto,
  ): Promise<VaultItemDto> {
    return this.vaultService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a vault item' })
  @ApiResponse({ status: 200, schema: { properties: { success: { type: 'boolean' } } } })
  async delete(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    await this.vaultService.delete(user.id, id);
    return { success: true };
  }

  // ============================================
  // Bulk Operations
  // ============================================

  @Delete()
  @ApiOperation({ summary: 'Delete all vault items' })
  @ApiResponse({ status: 200, schema: { properties: { count: { type: 'number' } } } })
  async deleteAll(@CurrentUser() user: CurrentUserPayload): Promise<{ count: number }> {
    return this.vaultService.deleteAll(user.id);
  }

  @Get('export/all')
  @ApiOperation({ summary: 'Export all vault items with decrypted data' })
  @ApiResponse({ status: 200, type: [VaultItemDetailDto] })
  async exportAll(@CurrentUser() user: CurrentUserPayload): Promise<VaultItemDetailDto[]> {
    return this.vaultService.exportAll(user.id);
  }

  @Post('import')
  @ApiOperation({ summary: 'Import vault items' })
  @ApiResponse({ status: 201, schema: { properties: { imported: { type: 'number' } } } })
  async importItems(
    @CurrentUser() user: CurrentUserPayload,
    @Body() items: ImportVaultItemDto[],
  ): Promise<{ imported: number }> {
    return this.vaultService.importItems(user.id, items);
  }
}


