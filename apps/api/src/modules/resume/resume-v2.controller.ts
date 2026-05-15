import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ResumeService } from './resume.service';
import {
  CreateResumeEvidenceDto,
  CreateResumeTargetDto,
} from './dto/resume-v2.dto';

@ApiTags('resume-v2')
@ApiBearerAuth()
@Controller('resume')
export class ResumeV2Controller {
  constructor(private readonly resumeService: ResumeService) {}

  @Get('evidence')
  @ApiOperation({ summary: 'List reusable career/application evidence' })
  listEvidence(@CurrentUser() user: { id: string }) {
    return this.resumeService.listEvidence(user.id);
  }

  @Post('evidence')
  @ApiOperation({ summary: 'Create reusable career/application evidence' })
  createEvidence(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateResumeEvidenceDto,
  ) {
    return this.resumeService.createEvidence(user.id, dto);
  }

  @Delete('evidence/:id')
  @ApiOperation({ summary: 'Delete reusable evidence' })
  deleteEvidence(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.deleteEvidence(user.id, id);
  }

  @Get('targets')
  @ApiOperation({ summary: 'List study-abroad and career resume targets' })
  listTargets(@CurrentUser() user: { id: string }) {
    return this.resumeService.listTargets(user.id);
  }

  @Post('targets')
  @ApiOperation({ summary: 'Create a study-abroad or career resume target' })
  createTarget(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateResumeTargetDto,
  ) {
    return this.resumeService.createTarget(user.id, dto);
  }

  @Delete('targets/:id')
  @ApiOperation({ summary: 'Delete a resume target' })
  deleteTarget(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.deleteTarget(user.id, id);
  }
}
