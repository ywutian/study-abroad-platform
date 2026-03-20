/**
 * Profile Tools Service
 *
 * Tools: GET_PROFILE, UPDATE_PROFILE
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ProfileLoaderHelper } from './helpers/profile-loader.helper';
import { ToolHandler, IToolHandlerProvider } from './tool-handler.interface';

@Injectable()
export class ProfileToolsService implements IToolHandlerProvider {
  private readonly logger = new Logger(ProfileToolsService.name);

  constructor(
    private prisma: PrismaService,
    private profileLoader: ProfileLoaderHelper,
  ) {}

  getHandlers(): Map<string, ToolHandler> {
    return new Map([
      [
        'get_profile',
        (args, userId, _ctx, locale) => this.getProfile(userId, locale),
      ],
      [
        'update_profile',
        (args, userId, _ctx, locale) =>
          this.updateProfile(userId, args.field, args.value, locale),
      ],
    ]);
  }

  async getProfile(userId: string, locale = 'zh') {
    const isZh = locale === 'zh';
    const profile = await this.profileLoader.loadProfile(userId, locale);

    if (!profile) {
      return {
        message: isZh
          ? '用户档案为空，建议先完善档案信息'
          : 'Profile is empty. Please complete your profile.',
      };
    }

    return profile;
  }

  async updateProfile(
    userId: string,
    field: string,
    value: string,
    locale = 'zh',
  ) {
    const isZh = locale === 'zh';
    const allowedFields = [
      'targetMajor',
      'budgetTier',
      'nationality',
      'grade',
      'currentSchoolType',
    ];

    if (!allowedFields.includes(field)) {
      return {
        success: false,
        message: isZh
          ? `不允许更新字段: ${field}`
          : `Field not allowed: ${field}`,
      };
    }

    await this.prisma.profile.update({
      where: { userId },
      data: { [field]: value },
    });

    return {
      success: true,
      message: isZh ? `已更新 ${field}` : `Updated ${field}`,
    };
  }
}
