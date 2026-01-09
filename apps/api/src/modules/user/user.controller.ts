import { Controller, Get, Delete, Post, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user info' })
  async getCurrentUser(@CurrentUser() user: CurrentUserPayload) {
    const fullUser = await this.userService.findByIdOrThrow(user.id);
    const { passwordHash, ...result } = fullUser;
    return result;
  }

  @Delete('me')
  @ApiOperation({ summary: 'Delete current user account (soft delete)' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.userService.softDelete(user.id);
    return { 
      success: true,
      message: 'Account deleted successfully. Your data will be permanently removed within 30 days.' 
    };
  }

  @Get('me/export')
  @ApiOperation({ summary: 'Export user data (GDPR compliance)' })
  @ApiResponse({ status: 200, description: 'Returns all user data as JSON' })
  async exportData(
    @CurrentUser() user: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.userService.exportUserData(user.id);
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${user.id}.json"`);
    
    return data;
  }
}

