import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottleRelaxed } from '../../common/decorators/throttle.decorator';
import {
  UpdateSettingValueDto,
  UpdateSettingItemDto,
} from './dto/update-setting-value.dto';

@ApiTags('settings')
@ThrottleRelaxed()
@Controller('settings')
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get all system settings (admin)' })
  @ApiResponse({ status: 200, description: 'Settings list' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Get('category/:category')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get settings by category' })
  async getByCategory(@Param('category') category: string) {
    return this.settingsService.getByCategory(category);
  }

  @Get(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get single setting' })
  async get(@Param('key') key: string) {
    const value = await this.settingsService.get(key);
    return { key, value };
  }

  @Put(':key')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update setting (admin)' })
  @ApiResponse({ status: 200, description: 'Update successful' })
  async update(@Param('key') key: string, @Body() body: UpdateSettingValueDto) {
    this.assertNotProtectedPointSetting(key);
    await this.settingsService.set(key, body.value, body.description);
    return { success: true };
  }

  @Put()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Batch update settings (admin)' })
  async updateMany(
    @Body()
    body: UpdateSettingItemDto[] | { settings: UpdateSettingItemDto[] },
  ) {
    const settings = Array.isArray(body) ? body : body.settings;
    if (!Array.isArray(settings)) {
      throw new BadRequestException(
        'Invalid payload: expected array or { settings: array }',
      );
    }

    for (const setting of settings) {
      this.assertNotProtectedPointSetting(setting.key);
    }

    await this.settingsService.setMany(settings);
    return { success: true };
  }

  private assertNotProtectedPointSetting(key: string): void {
    if (this.settingsService.isProtectedPointSetting(key)) {
      throw new BadRequestException(
        'Points settings must be changed through /admin/points so product gates cannot be bypassed',
      );
    }
  }
}
