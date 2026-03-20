import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ThrottleAI } from '../../common/decorators/throttle.decorator';
import { ResumeService } from './resume.service';
import { CreateResumeDto } from './dto/create-resume.dto';
import { UpdateResumeDto } from './dto/update-resume.dto';
import {
  CreateSectionDto,
  UpdateSectionDto,
  ReorderSectionsDto,
} from './dto/section.dto';
import {
  AiBulletOptimizeDto,
  AiResumeReviewDto,
  AiSuggestContentDto,
  CreateSnapshotDto,
} from './dto/resume-ai.dto';

@ApiTags('resumes')
@ApiBearerAuth()
@Controller('resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  // ============================================
  // Resume CRUD
  // ============================================

  @Get()
  @ApiOperation({ summary: 'List all resumes for current user' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.resumeService.findAll(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new resume' })
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateResumeDto) {
    return this.resumeService.create(user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get resume with all sections' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.findById(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update resume metadata/settings' })
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateResumeDto,
  ) {
    return this.resumeService.update(user.id, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a resume' })
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.resumeService.delete(user.id, id);
    return { message: 'Resume deleted' };
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Duplicate a resume' })
  duplicate(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.duplicate(user.id, id);
  }

  // ============================================
  // Sections
  // ============================================

  @Post(':id/sections')
  @ApiOperation({ summary: 'Add a section to a resume' })
  addSection(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreateSectionDto,
  ) {
    return this.resumeService.addSection(user.id, id, dto);
  }

  @Put(':id/sections/:sid')
  @ApiOperation({ summary: 'Update a resume section' })
  updateSection(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('sid') sid: string,
    @Body() dto: UpdateSectionDto,
  ) {
    return this.resumeService.updateSection(user.id, id, sid, dto);
  }

  @Delete(':id/sections/:sid')
  @ApiOperation({ summary: 'Delete a resume section' })
  async deleteSection(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('sid') sid: string,
  ) {
    await this.resumeService.deleteSection(user.id, id, sid);
    return { message: 'Section deleted' };
  }

  @Put(':id/sections/reorder')
  @ApiOperation({ summary: 'Reorder sections' })
  reorderSections(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: ReorderSectionsDto,
  ) {
    return this.resumeService.reorderSections(user.id, id, dto);
  }

  // ============================================
  // Profile Import
  // ============================================

  @Post(':id/import-profile')
  @ApiOperation({ summary: 'Import data from user profile' })
  importProfile(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.importFromProfile(user.id, id);
  }

  // ============================================
  // Snapshots
  // ============================================

  @Post(':id/snapshots')
  @ApiOperation({ summary: 'Create a snapshot of current resume state' })
  createSnapshot(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.resumeService.createSnapshot(user.id, id, dto.description);
  }

  @Get(':id/snapshots')
  @ApiOperation({ summary: 'List resume snapshots' })
  getSnapshots(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.resumeService.getSnapshots(user.id, id);
  }

  @Post(':id/snapshots/:snapId/restore')
  @ApiOperation({ summary: 'Restore a snapshot' })
  restoreSnapshot(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Param('snapId') snapId: string,
  ) {
    return this.resumeService.restoreSnapshot(user.id, id, snapId);
  }

  // ============================================
  // AI Features
  // ============================================

  @Get(':id/ai/reviews/latest')
  @ApiOperation({ summary: 'Get the latest AI full review for a resume' })
  getLatestReview(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.resumeService.getLatestReview(user.id, id);
  }

  @Get(':id/ai/reviews')
  @ApiOperation({ summary: 'List AI review history for a resume' })
  getReviewHistory(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.resumeService.getReviewHistory(user.id, id);
  }

  @Post(':id/ai/review')
  @ThrottleAI()
  @ApiOperation({ summary: 'AI full resume review' })
  aiReview(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AiResumeReviewDto,
  ) {
    return this.resumeService.aiReview(
      user.id,
      id,
      dto.targetSchool,
      dto.targetMajor,
    );
  }

  @Post(':id/ai/optimize-bullets')
  @ThrottleAI()
  @ApiOperation({ summary: 'AI optimize bullet points' })
  aiOptimizeBullets(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AiBulletOptimizeDto,
  ) {
    return this.resumeService.aiOptimizeBullets(
      user.id,
      id,
      dto.sectionId,
      dto.itemId,
      dto.targetSchool,
      dto.targetMajor,
    );
  }

  @Post(':id/ai/suggest-content')
  @ThrottleAI()
  @ApiOperation({ summary: 'AI suggest content for a section' })
  aiSuggestContent(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: AiSuggestContentDto,
  ) {
    return this.resumeService.aiSuggestContent(
      user.id,
      id,
      dto.sectionType,
      dto.targetMajor,
    );
  }
}
