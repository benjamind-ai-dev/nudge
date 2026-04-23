import { Inject, Injectable, Logger } from "@nestjs/common";
import { PrismaClient, Prisma } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import {
  isValidChannel,
  type MessageSendRepository,
  type RunReadyToSend,
  type NextStep,
  type CreateMessageData,
  type UpdateMessageStatusData,
  type MessageChannel,
  type RunStatus,
} from "../domain/message-send.repository";

@Injectable()
export class PrismaMessageSendRepository implements MessageSendRepository {
  private readonly logger = new Logger(PrismaMessageSendRepository.name);

  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  /**
   * Fetches runs ready to send across ALL tenants.
   *
   * This cross-tenant scan is intentional for the background tick job—individual
   * send jobs then scope by businessId via findRunById, advanceRunToNextStep,
   * and completeRun to ensure tenant isolation on mutations.
   *
   * The 500-row limit caps memory usage per tick. At 1-minute tick intervals,
   * this handles up to 30k runs/hour which exceeds expected volume.
   */
  async findRunsReadyToSend(limit = 500): Promise<RunReadyToSend[]> {
    const now = new Date();

    const runs = await this.prisma.sequenceRun.findMany({
      where: {
        status: "active",
        nextSendAt: { lte: now },
        currentStepId: { not: null },
      },
      orderBy: { nextSendAt: "asc" },
      take: limit,
      select: {
        id: true,
        status: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amountCents: true,
            balanceDueCents: true,
            dueDate: true,
            paymentLinkUrl: true,
            customer: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
              },
            },
            business: {
              select: {
                id: true,
                name: true,
                senderName: true,
                senderEmail: true,
                emailSignature: true,
                timezone: true,
              },
            },
          },
        },
        sequence: {
          select: {
            id: true,
          },
        },
        currentStep: {
          select: {
            id: true,
            stepOrder: true,
            channel: true,
            subjectTemplate: true,
            bodyTemplate: true,
            smsBodyTemplate: true,
            isOwnerAlert: true,
            delayDays: true,
          },
        },
      },
    });

    return runs
      .filter((run) => {
        if (!run.currentStep) {
          this.logger.error({
            msg: "Run has no current step despite query filter",
            event: "run_missing_current_step",
            runId: run.id,
          });
          return false;
        }
        const channel = run.currentStep.channel;
        if (!isValidChannel(channel)) {
          this.logger.error({
            msg: "Invalid channel in sequence step",
            event: "invalid_channel",
            runId: run.id,
            stepId: run.currentStep.id,
            channel,
          });
          return false;
        }
        return true;
      })
      .map((run) => ({
        runId: run.id,
        runStatus: run.status as RunStatus,
        invoiceId: run.invoice.id,
        invoiceNumber: run.invoice.invoiceNumber,
        amountCents: run.invoice.amountCents,
        balanceDueCents: run.invoice.balanceDueCents,
        dueDate: run.invoice.dueDate,
        paymentLinkUrl: run.invoice.paymentLinkUrl,
        customerId: run.invoice.customer.id,
        customerCompanyName: run.invoice.customer.companyName,
        customerContactName: run.invoice.customer.contactName,
        customerContactEmail: run.invoice.customer.contactEmail,
        customerContactPhone: run.invoice.customer.contactPhone,
        businessId: run.invoice.business.id,
        businessName: run.invoice.business.name,
        businessSenderName: run.invoice.business.senderName,
        businessSenderEmail: run.invoice.business.senderEmail,
        businessEmailSignature: run.invoice.business.emailSignature,
        businessTimezone: run.invoice.business.timezone,
        sequenceId: run.sequence.id,
        stepId: run.currentStep!.id,
        stepOrder: run.currentStep!.stepOrder,
        stepChannel: run.currentStep!.channel as MessageChannel,
        stepSubjectTemplate: run.currentStep!.subjectTemplate,
        stepBodyTemplate: run.currentStep!.bodyTemplate,
        stepSmsBodyTemplate: run.currentStep!.smsBodyTemplate,
        stepIsOwnerAlert: run.currentStep!.isOwnerAlert,
      }));
  }

  async findRunById(id: string, businessId: string): Promise<RunReadyToSend | null> {
    const run = await this.prisma.sequenceRun.findFirst({
      where: {
        id,
        invoice: { businessId },
      },
      select: {
        id: true,
        status: true,
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amountCents: true,
            balanceDueCents: true,
            dueDate: true,
            paymentLinkUrl: true,
            customer: {
              select: {
                id: true,
                companyName: true,
                contactName: true,
                contactEmail: true,
                contactPhone: true,
              },
            },
            business: {
              select: {
                id: true,
                name: true,
                senderName: true,
                senderEmail: true,
                emailSignature: true,
                timezone: true,
              },
            },
          },
        },
        sequence: {
          select: {
            id: true,
          },
        },
        currentStep: {
          select: {
            id: true,
            stepOrder: true,
            channel: true,
            subjectTemplate: true,
            bodyTemplate: true,
            smsBodyTemplate: true,
            isOwnerAlert: true,
            delayDays: true,
          },
        },
      },
    });

    if (!run || !run.currentStep) {
      return null;
    }

    const channel = run.currentStep.channel;
    if (!isValidChannel(channel)) {
      this.logger.error({
        msg: "Invalid channel in sequence step",
        event: "invalid_channel",
        runId: run.id,
        stepId: run.currentStep.id,
        channel,
      });
      return null;
    }

    return {
      runId: run.id,
      runStatus: run.status as RunStatus,
      invoiceId: run.invoice.id,
      invoiceNumber: run.invoice.invoiceNumber,
      amountCents: run.invoice.amountCents,
      balanceDueCents: run.invoice.balanceDueCents,
      dueDate: run.invoice.dueDate,
      paymentLinkUrl: run.invoice.paymentLinkUrl,
      customerId: run.invoice.customer.id,
      customerCompanyName: run.invoice.customer.companyName,
      customerContactName: run.invoice.customer.contactName,
      customerContactEmail: run.invoice.customer.contactEmail,
      customerContactPhone: run.invoice.customer.contactPhone,
      businessId: run.invoice.business.id,
      businessName: run.invoice.business.name,
      businessSenderName: run.invoice.business.senderName,
      businessSenderEmail: run.invoice.business.senderEmail,
      businessEmailSignature: run.invoice.business.emailSignature,
      businessTimezone: run.invoice.business.timezone,
      sequenceId: run.sequence.id,
      stepId: run.currentStep.id,
      stepOrder: run.currentStep.stepOrder,
      stepChannel: channel,
      stepSubjectTemplate: run.currentStep.subjectTemplate,
      stepBodyTemplate: run.currentStep.bodyTemplate,
      stepSmsBodyTemplate: run.currentStep.smsBodyTemplate,
      stepIsOwnerAlert: run.currentStep.isOwnerAlert,
    };
  }

  async findNextStep(sequenceId: string, businessId: string, currentStepOrder: number): Promise<NextStep | null> {
    const step = await this.prisma.sequenceStep.findFirst({
      where: {
        sequenceId,
        sequence: { businessId },
        stepOrder: { gt: currentStepOrder },
      },
      orderBy: { stepOrder: "asc" },
      select: {
        id: true,
        stepOrder: true,
        delayDays: true,
      },
    });

    return step;
  }

  async messageExistsForRunStep(runId: string, stepId: string, channel: string, businessId: string): Promise<boolean> {
    const count = await this.prisma.message.count({
      where: {
        sequenceRunId: runId,
        sequenceStepId: stepId,
        channel,
        businessId,
        status: "sent",
      },
    });

    return count > 0;
  }

  async createMessage(data: CreateMessageData): Promise<{ created: boolean }> {
    try {
      await this.prisma.message.create({
        data: {
          id: data.id,
          sequenceRunId: data.sequenceRunId,
          sequenceStepId: data.sequenceStepId,
          invoiceId: data.invoiceId,
          customerId: data.customerId,
          businessId: data.businessId,
          channel: data.channel,
          recipientEmail: data.recipientEmail,
          recipientPhone: data.recipientPhone,
          subject: data.subject,
          body: data.body,
          status: data.status,
          externalMessageId: data.externalMessageId,
          sentAt: data.sentAt,
        },
      });
      return { created: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // A record already exists for this run/step/channel. Check its status:
        // - "sent": genuine duplicate, skip
        // - "queued": previous attempt failed mid-flight, delete stale record and retry
        const existing = await this.prisma.message.findFirst({
          where: {
            sequenceRunId: data.sequenceRunId,
            sequenceStepId: data.sequenceStepId,
            channel: data.channel,
            businessId: data.businessId,
          },
          select: { id: true, status: true },
        });

        if (!existing || existing.status === "sent") {
          return { created: false };
        }

        await this.prisma.message.delete({ where: { id: existing.id } });
        await this.prisma.message.create({
          data: {
            id: data.id,
            sequenceRunId: data.sequenceRunId,
            sequenceStepId: data.sequenceStepId,
            invoiceId: data.invoiceId,
            customerId: data.customerId,
            businessId: data.businessId,
            channel: data.channel,
            recipientEmail: data.recipientEmail,
            recipientPhone: data.recipientPhone,
            subject: data.subject,
            body: data.body,
            status: data.status,
            externalMessageId: data.externalMessageId,
            sentAt: data.sentAt,
          },
        });
        return { created: true };
      }
      throw error;
    }
  }

  async updateMessageStatus(data: UpdateMessageStatusData): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        id: data.id,
        businessId: data.businessId,
      },
      data: {
        status: data.status,
        externalMessageId: data.externalMessageId,
        sentAt: data.sentAt,
      },
    });
  }

  async advanceRunToNextStep(
    runId: string,
    businessId: string,
    nextStepId: string,
    nextSendAt: Date,
  ): Promise<void> {
    await this.prisma.sequenceRun.updateMany({
      where: {
        id: runId,
        invoice: { businessId },
      },
      data: {
        currentStepId: nextStepId,
        nextSendAt,
      },
    });
  }

  async completeRun(runId: string, businessId: string): Promise<void> {
    await this.prisma.sequenceRun.updateMany({
      where: {
        id: runId,
        invoice: { businessId },
      },
      data: {
        status: "completed",
        completedAt: new Date(),
        currentStepId: null,
        nextSendAt: null,
      },
    });
  }
}
