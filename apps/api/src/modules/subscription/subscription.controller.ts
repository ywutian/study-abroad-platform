import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  Req,
  BadRequestException,
  ParseEnumPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { SubscriptionService, SubscriptionPlan } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Public } from '../../common/decorators/public.decorator';
import {
  ThrottleSensitive,
  ThrottleRelaxed,
} from '../../common/decorators/throttle.decorator';
import * as express from 'express';

@ApiTags('subscriptions')
@ThrottleSensitive()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get the always-open free plan' })
  @ApiResponse({ status: 200, description: 'Returns all available plans' })
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('plans/:planId')
  @Public()
  @ApiOperation({ summary: 'Get plan details' })
  getPlan(
    @Param('planId', new ParseEnumPipe(SubscriptionPlan))
    planId: SubscriptionPlan,
  ) {
    return this.subscriptionService.getPlan(planId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user subscription' })
  async getCurrentSubscription(@CurrentUser() user: CurrentUserPayload) {
    return this.subscriptionService.getUserSubscription(user.id);
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Retired paid-subscription endpoint',
    deprecated: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Subscription created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 503, description: 'Paid subscriptions are retired' })
  async subscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(user.id, dto);
  }

  @Delete('cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retired cancellation endpoint', deprecated: true })
  async cancelSubscription(@CurrentUser() user: CurrentUserPayload) {
    return this.subscriptionService.cancelSubscription(user.id);
  }

  @Get('billing-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get billing history' })
  async getBillingHistory(@CurrentUser() user: CurrentUserPayload) {
    return this.subscriptionService.getBillingHistory(user.id);
  }

  @Post('webhook')
  @Public()
  @ThrottleRelaxed()
  @ApiOperation({ summary: 'Retired legacy payment webhook', deprecated: true })
  async handleWebhook(
    @Req() req: express.Request & { rawBody?: Buffer },
    @Headers('x-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing webhook signature');
    }
    const payload = req.body;
    await this.subscriptionService.handlePaymentWebhook(payload, signature);
    return { received: true };
  }
}
