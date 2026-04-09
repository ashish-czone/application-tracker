import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, eq } from '@packages/database';
import { DocumentTemplatesService } from '@packages/document-templates';
import { PdfGeneratorService } from '@packages/pdf-generator';
import { EmailChannelService } from '@packages/notification-channels';
import { AppLoggerService, type ContextLogger } from '@packages/logger';
import { offers } from '../schema/offers';

@Injectable()
export class OfferLetterService {
  private readonly logger: ContextLogger;

  constructor(
    private readonly database: DatabaseService,
    private readonly templatesService: DocumentTemplatesService,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly emailService: EmailChannelService,
    appLogger: AppLoggerService,
  ) {
    this.logger = appLogger.forContext(OfferLetterService.name);
  }

  /**
   * Render the offer letter, generate PDF, email it to the candidate,
   * and update sentAt on the offer.
   */
  async sendOfferLetter(offerId: string, templateId: string, candidateEmail: string): Promise<{ success: boolean; error?: string }> {
    // 1. Render the template with real offer data
    const { html, subject } = await this.templatesService.render(templateId, offerId);

    // 2. Generate PDF from rendered HTML
    const pdfBuffer = await this.pdfGenerator.generatePdfFromFragment(html);

    // 3. Send email with PDF attachment
    const result = await this.emailService.send({
      to: candidateEmail,
      subject: subject ?? 'Your Offer Letter',
      body: html,
      correlationId: `offer-letter:${offerId}`,
      attachments: [
        {
          filename: 'offer-letter.pdf',
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (result.success) {
      // 4. Update sentAt on the offer
      await this.database.db
        .update(offers)
        .set({ sentAt: new Date() })
        .where(eq(offers.id, offerId));

      this.logger.log('Offer letter sent', { offerId, candidateEmail });
    } else {
      this.logger.error('Failed to send offer letter', { offerId, candidateEmail, error: result.error });
    }

    return result;
  }
}
