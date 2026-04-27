import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators';
import { ListPredictionFeedbackDto } from './dto/prediction-feedback.dto';
import { PredictionFeedbackService } from './prediction-feedback.service';

@ApiTags('admin/prediction-feedback')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@Controller('admin/prediction-feedback')
export class AdminPredictionFeedbackController {
  constructor(private readonly feedbackService: PredictionFeedbackService) {}

  @Get()
  @ApiOperation({
    summary:
      'List prediction quality feedback for admin review, filterable by sentiment, category, engine, school, and recency.',
  })
  async listFeedback(@Query() query: ListPredictionFeedbackDto) {
    return this.feedbackService.listFeedback(query);
  }
}
