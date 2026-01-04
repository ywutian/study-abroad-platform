import { Controller, Get, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    await this.userService.softDelete(user.id);
    return { message: 'Account deleted successfully' };
  }
}

