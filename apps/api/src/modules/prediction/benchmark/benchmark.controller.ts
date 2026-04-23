import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../../common/decorators';
import { BenchmarkService } from './benchmark.service';
import {
  CreateBenchmarkProfileDto,
  StartBenchmarkRunDto,
} from './benchmark.dto';

@ApiTags('admin/predictions/benchmark')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/predictions/benchmark')
export class BenchmarkController {
  constructor(private readonly benchmarkService: BenchmarkService) {}

  @Get('profiles')
  @ApiOperation({ summary: 'List external benchmark profiles' })
  async listProfiles() {
    return this.benchmarkService.listProfiles();
  }

  @Post('profiles')
  @ApiOperation({ summary: 'Create an external benchmark profile' })
  async createProfile(@Body() body: CreateBenchmarkProfileDto) {
    return this.benchmarkService.createProfile(body);
  }

  @Get('sources')
  @ApiOperation({ summary: 'List competitor benchmark sources' })
  async listSources() {
    return this.benchmarkService.listSources();
  }

  @Post('sources/:key/session')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Upload Playwright storageState.json for a competitor source',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSession(
    @Param('key') key: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.benchmarkService.saveSession(
      key,
      file.buffer.toString('utf-8'),
    );
  }

  @Get('runs')
  @ApiOperation({ summary: 'List competitor benchmark runs' })
  async listRuns() {
    return this.benchmarkService.listRuns();
  }

  @Post('runs')
  @ApiOperation({ summary: 'Start or resume a competitor benchmark run' })
  async startRun(@Body() body: StartBenchmarkRunDto) {
    return this.benchmarkService.startRun({
      profileId: body.profileId ?? '',
      sourceKey: body.sourceKey ?? '',
      limit: body.limit,
      headed: body.headed,
    });
  }

  @Get('runs/:id')
  @ApiOperation({ summary: 'Get competitor benchmark run status and progress' })
  async getRun(@Param('id') id: string) {
    return this.benchmarkService.getRunDetail(id);
  }

  @Get('runs/:id/report')
  @ApiOperation({
    summary: 'Build competitor benchmark probability report for a run',
  })
  async getRunReport(@Param('id') id: string) {
    return this.benchmarkService.buildReport(id);
  }
}
