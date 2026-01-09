import { Controller, Get, Post, Delete, Body, Headers, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SubscriptionService, SubscriptionPlan } from './subscription.service';
import type { CreateSubscriptionDto } from './subscription.service';
import { CurrentUser } from '../../common/decorators';
import type { CurrentUserPayload } from '../../common/decorators';
import { Public } from '../../common/decorators/public.decorator';
import * as express from 'express';

@ApiTags('subscriptions')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  @Public()
  @ApiOperation({ summary: 'Get all subscription plans' })
  @ApiResponse({ status: 200, description: 'Returns all available plans' })
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @Get('plans/:planId')
  @Public()
  @ApiOperation({ summary: 'Get plan details' })
  getPlan(planId: SubscriptionPlan) {
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
  @ApiOperation({ summary: 'Create or upgrade subscription' })
  @ApiResponse({ status: 200, description: 'Subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async subscribe(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(user.id, dto);
  }

  @Delete('cancel')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel current subscription' })
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
  @ApiOperation({ summary: 'Payment webhook endpoint' })
  async handleWebhook(
    @Req() req: express.Request & { rawBody?: Buffer },
    @Headers('x-signature') signature: string,
  ) {
    const payload = req.body;
    await this.subscriptionService.handlePaymentWebhook(payload, signature);
    return { received: true };
  }
}

