import { Inject, Injectable } from "@nestjs/common";
import { PrismaClient } from "@nudge/database";
import { PRISMA_CLIENT } from "../../../common/database/database.module";
import type {
  MessageSendRepository,
  RunReadyToSend,
  NextStep,
  CreateMessageData,
} from "../domain/message-send.repository";

@Injectable()
export class PrismaMessageSendRepository implements MessageSendRepository {
  constructor(
    @Inject(PRISMA_CLIENT) private readonly prisma: PrismaClient,
  ) {}

  async findRunsReadyToSend(): Promise<RunReadyToSend[]> {
    const now = new Date();

    const runs = await this.prisma.sequenceRun.findMany({
      where: {
        status: "active",
        nextSendAt: { lte: now },
        currentStepId: { not: null },
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
            isOwnerAlert: true,
            delayDays: true,
          },
        },
      },
    });

    return runs.map((run) => ({
      runId: run.id,
      runStatus: run.status,
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
      stepChannel: run.currentStep!.channel,
      stepSubjectTemplate: run.currentStep!.subjectTemplate,
      stepBodyTemplate: run.currentStep!.bodyTemplate,
      stepIsOwnerAlert: run.currentStep!.isOwnerAlert,
      stepDelayDays: run.currentStep!.delayDays,
    }));
  }

  async findRunById(id: string): Promise<RunReadyToSend | null> {
    const run = await this.prisma.sequenceRun.findUnique({
      where: { id },
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
            isOwnerAlert: true,
            delayDays: true,
          },
        },
      },
    });

    if (!run || !run.currentStep) {
      return null;
    }

    return {
      runId: run.id,
      runStatus: run.status,
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
      stepChannel: run.currentStep.channel,
      stepSubjectTemplate: run.currentStep.subjectTemplate,
      stepBodyTemplate: run.currentStep.bodyTemplate,
      stepIsOwnerAlert: run.currentStep.isOwnerAlert,
      stepDelayDays: run.currentStep.delayDays,
    };
  }

  async findNextStep(sequenceId: string, currentStepOrder: number): Promise<NextStep | null> {
    const step = await this.prisma.sequenceStep.findFirst({
      where: {
        sequenceId,
        stepOrder: currentStepOrder + 1,
      },
      select: {
        id: true,
        stepOrder: true,
        delayDays: true,
      },
    });

    return step;
  }

  async messageExistsForRunStep(runId: string, stepId: string, channel: string): Promise<boolean> {
    const count = await this.prisma.message.count({
      where: {
        sequenceRunId: runId,
        sequenceStepId: stepId,
        channel,
      },
    });

    return count > 0;
  }

  async createMessage(data: CreateMessageData): Promise<void> {
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
  }

  async advanceRunToNextStep(runId: string, nextStepId: string, nextSendAt: Date): Promise<void> {
    await this.prisma.sequenceRun.update({
      where: { id: runId },
      data: {
        currentStepId: nextStepId,
        nextSendAt,
      },
    });
  }

  async completeRun(runId: string): Promise<void> {
    await this.prisma.sequenceRun.update({
      where: { id: runId },
      data: {
        status: "completed",
        completedAt: new Date(),
        currentStepId: null,
        nextSendAt: null,
      },
    });
  }
}
