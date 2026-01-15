import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('settings')
@Controller('settings')
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取所有系统设置（管理员）' })
  @ApiResponse({ status: 200, description: '设置列表' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get('category/:category')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '按分类获取设置' })
  async getByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  @Get(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '获取单个设置' })
  async get(@Param('key') key: string) {
    const value = await this.settingsService.get(key);
    return { key, value };
  }

  @Put(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新设置（管理员）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async update(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
  ) {
    await this.settingsService.set(key, body.value, body.description);
    return { success: true };
  }

  @Put()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '批量更新设置（管理员）' })
  async updateMany(@Body() settings: Array<{ key: string; value: string }>) {
    await this.settingsService.setMany(settings);
    return { success: true };
  }
}
