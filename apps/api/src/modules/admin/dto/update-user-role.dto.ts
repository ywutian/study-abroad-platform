import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Role, description: 'New user role' })
  @IsEnum(Role)
  role: Role;
}


