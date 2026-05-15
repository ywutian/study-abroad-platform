import { IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  content: string;

  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for optimistic sends',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientMessageId?: string;

  @ApiPropertyOptional({ description: 'Message ID this message replies to' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  replyToId?: string;
}

export class UploadMessageDto {
  @ApiPropertyOptional({ description: 'Optional caption for uploaded media' })
  @IsString()
  @IsOptional()
  @MaxLength(10000)
  content?: string;

  @ApiPropertyOptional({
    description: 'Client-generated idempotency key for optimistic sends',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  clientMessageId?: string;

  @ApiPropertyOptional({ description: 'Message ID this media replies to' })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  replyToId?: string;
}
