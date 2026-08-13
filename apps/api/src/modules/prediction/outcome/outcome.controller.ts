import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { CurrentUserPayload } from '../../../common/decorators';
import { CurrentUser } from '../../../common/decorators';
import {
  ThrottleRelaxed,
  ThrottleSensitive,
} from '../../../common/decorators/throttle.decorator';
import { StorageService } from '../../../common/storage/storage.service';
import { ListMyOutcomesDto, SubmitOutcomeDto } from './dto/submit-outcome.dto';
import { OutcomeService } from './outcome.service';

@ApiTags('Prediction Outcomes')
@ApiBearerAuth()
@Controller('predictions/outcomes')
export class OutcomeController {
  constructor(
    private readonly outcomeService: OutcomeService,
    private readonly storage: StorageService,
  ) {}

  /**
   * User reports an admission outcome.
   * Throttled to prevent spam (5/min — outcomes are infrequent, but legitimate
   * users may report a batch on Decision Day).
   */
  @Post()
  @ThrottleSensitive()
  @ApiOperation({
    summary: 'Report an admission outcome for one of your predictions',
  })
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitOutcomeDto,
  ) {
    return this.outcomeService.submit(user.id, dto);
  }

  @Get('me')
  @ThrottleRelaxed()
  @ApiOperation({ summary: "List all outcomes I've reported" })
  async listMine(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: ListMyOutcomesDto,
  ) {
    return this.outcomeService.listMine(user.id, query);
  }

  @Get('pending-decisions')
  @ThrottleRelaxed()
  @ApiOperation({
    summary:
      "List my predictions that don't yet have an outcome — used by Dashboard banner to prompt reporting",
  })
  async pendingDecisions(@CurrentUser() user: CurrentUserPayload) {
    return this.outcomeService.listPendingDecisions(user.id);
  }

  /**
   * M6.6: Upload acceptance letter / portal screenshot as evidence.
   * Returns the stored URL; client can also submit it directly via
   * SubmitOutcomeDto.evidenceUrl on the original submit.
   *
   * Storage: routed through StorageService (S3/local/etc.) under
   * `outcome-evidence/<userId>/<hash>`. Max 10MB, JPEG/PNG/PDF only.
   */
  @Post(':id/evidence')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ThrottleSensitive()
  @ApiOperation({
    summary:
      'Upload acceptance letter / portal screenshot as evidence for an existing outcome',
  })
  async uploadEvidence(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') outcomeId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('File too large (max 10 MB)');
    }
    const ALLOWED_MIMES = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ];
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Use JPEG/PNG/WebP/PDF.`,
      );
    }
    const upload = await this.storage.uploadOutcomeEvidence(user.id, {
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
    });
    return this.outcomeService.attachEvidence(user.id, outcomeId, upload.url);
  }

  @Get('me/stats')
  @ThrottleRelaxed()
  @ApiOperation({
    summary: 'Quick stats for my reported outcomes (Hall badge eligibility)',
  })
  async getMyStats(@CurrentUser() user: CurrentUserPayload) {
    return this.outcomeService.getMyStats(user.id);
  }
}
