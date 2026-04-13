import { Controller, Get, Post, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RequirePermission } from '@packages/rbac';
import { CurrentUser, type JwtPayload } from '@packages/auth';
import { OfferApprovalsService } from '../services/offer-approvals.service';
import { OfferLetterService } from '../services/offer-letter.service';
import { SubmitApprovalDto, SetApproversDto } from '../dto/submit-approval.dto';
import { SendOfferLetterDto } from '../dto/send-offer-letter.dto';

@ApiTags('offer-approvals')
@Controller('offers')
export class OfferApprovalsController {
  constructor(
    private readonly approvalsService: OfferApprovalsService,
    private readonly offerLetterService: OfferLetterService,
  ) {}

  @Get(':offerId/approvals')
  @RequirePermission('offers.read')
  @ApiOperation({ summary: 'List approval decisions for an offer' })
  async list(@Param('offerId', ParseUUIDPipe) offerId: string) {
    return this.approvalsService.listForOffer(offerId);
  }

  @Post(':offerId/approvals')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('offers.update')
  @ApiOperation({ summary: 'Submit an approval decision' })
  async submitDecision(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: SubmitApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalsService.submitDecision(offerId, user.userId, dto.decision, dto.comment);
  }

  @Post(':offerId/approvers')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('offers.update')
  @ApiOperation({ summary: 'Set approvers for an offer (creates pending approval rows)' })
  async setApprovers(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: SetApproversDto,
  ) {
    await this.approvalsService.createPendingApprovals(offerId, dto.approverIds);
    return { success: true };
  }

  @Post(':offerId/send-letter')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('offers.update')
  @ApiOperation({ summary: 'Render offer letter, generate PDF, and email to candidate' })
  async sendOfferLetter(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: SendOfferLetterDto,
  ) {
    return this.offerLetterService.sendOfferLetter(offerId, dto.templateId, dto.candidateEmail);
  }
}
