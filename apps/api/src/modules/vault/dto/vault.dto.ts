import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VaultItemType } from '../../../common/types/enums';

// ============================================
// Create Vault Item
// ============================================

export class CreateVaultItemDto {
  @ApiProperty({ enum: VaultItemType })
  @IsEnum(VaultItemType)
  type: VaultItemType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Plain text data to be encrypted' })
  @MaxLength(50000)
  @IsString()
  data: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  icon?: string;
}

// ============================================
// Update Vault Item
// ============================================

export class UpdateVaultItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(200)
  @IsString()
  @MinLength(1)
  title?: string;

  @ApiPropertyOptional({ description: 'Plain text data to be encrypted' })
  @IsOptional()
  @MaxLength(50000)
  @IsString()
  data?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  icon?: string;
}

// ============================================
// Query Vault Items
// ============================================

export class VaultQueryDto {
  @ApiPropertyOptional({ enum: VaultItemType })
  @IsOptional()
  @IsEnum(VaultItemType)
  type?: VaultItemType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(500)
  @IsString()
  search?: string;
}

// ============================================
// Response DTOs
// ============================================

export class VaultItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: VaultItemType })
  type: VaultItemType;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  category?: string;

  @ApiProperty({ type: [String] })
  tags: string[];

  @ApiPropertyOptional()
  icon?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class VaultItemDetailDto extends VaultItemDto {
  @ApiProperty({ description: 'Decrypted data' })
  data: string;
}

export class VaultStatsDto {
  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  credentialCount: number;

  @ApiProperty()
  documentCount: number;

  @ApiProperty()
  noteCount: number;

  @ApiProperty()
  certificateCount: number;

  @ApiProperty({ type: [String] })
  categories: string[];
}

// ============================================
// Import Vault Items
// ============================================

export class ImportVaultItemDto {
  @ApiProperty()
  @MaxLength(100)
  @IsString()
  type: string;

  @ApiProperty()
  @MaxLength(200)
  @IsString()
  @MinLength(1)
  title: string;

  @ApiProperty({ description: 'Plain text data to be encrypted' })
  @MaxLength(50000)
  @IsString()
  data: string;

  @ApiPropertyOptional()
  @IsOptional()
  @MaxLength(100)
  @IsString()
  category?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  tags?: string[];
}
