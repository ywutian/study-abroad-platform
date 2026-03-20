import {
  IsEnum,
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEmail,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class PermissionEntryDto {
  @ApiProperty({ description: 'Permission identifier, e.g. "case:create"' })
  @IsString()
  @MaxLength(100)
  permission: string;

  @ApiProperty({ description: 'Whether this permission is granted' })
  @IsBoolean()
  granted: boolean;
}

export class UpdateRolePermissionsDto {
  @ApiProperty({ enum: Role, description: 'Target role' })
  @IsEnum(Role)
  role: Role;

  @ApiProperty({
    type: [PermissionEntryDto],
    description: 'Permissions to set',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionEntryDto)
  permissions: PermissionEntryDto[];
}

export class CreateOperatorInviteDto {
  @ApiProperty({
    required: false,
    description: 'Optional email for the invite',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @ApiProperty({
    required: false,
    enum: Role,
    description: 'Role to grant (default: OPERATOR)',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class SearchUserQueryDto {
  @ApiProperty({ description: 'Email of the user to search' })
  @IsEmail()
  @MaxLength(200)
  email: string;
}

export class PromoteUserByEmailDto {
  @ApiProperty({ description: 'Email of the registered user to promote' })
  @IsEmail()
  @MaxLength(200)
  email: string;

  @ApiProperty({ enum: Role, description: 'Target role to assign' })
  @IsEnum(Role)
  role: Role;
}
