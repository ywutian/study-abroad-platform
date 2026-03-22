import {
  IsString,
  IsBoolean,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UserPermissionEntryDto {
  @ApiProperty({ description: 'Permission identifier, e.g. "case:create"' })
  @IsString()
  @MaxLength(100)
  permission: string;

  @ApiProperty({ description: 'Whether this permission is granted' })
  @IsBoolean()
  granted: boolean;
}

export class SetUserPermissionsDto {
  @ApiProperty({
    type: [UserPermissionEntryDto],
    description: 'Permissions to set for the user (overrides role defaults)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UserPermissionEntryDto)
  permissions: UserPermissionEntryDto[];
}
