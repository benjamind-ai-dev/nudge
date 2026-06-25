import { Inject, Injectable } from "@nestjs/common";
import { ENROLLMENT_REPOSITORY, type EnrollmentRepository } from "../domain/enrollment.repository";
import { EnrollInvoicesUseCase, type EnrollResult } from "./enroll-invoices.use-case";
import { CustomerNotInBusinessError } from "../domain/sequence.errors";

export interface AttachCustomerResult { customerId: string; overrideSet: boolean; enrollment: EnrollResult; }

@Injectable()
export class AttachCustomerUseCase {
  constructor(
    @Inject(ENROLLMENT_REPOSITORY) private readonly repo: EnrollmentRepository,
    private readonly enroll: EnrollInvoicesUseCase,
  ) {}

  async execute(sequenceId: string, businessId: string, customerId: string): Promise<AttachCustomerResult> {
    const ok = await this.repo.setCustomerSequenceOverride(customerId, businessId, sequenceId);
    if (!ok) throw new CustomerNotInBusinessError(customerId);
    const invoiceIds = await this.repo.findChaseableInvoiceIdsForCustomer(customerId, businessId);
    const enrollment = await this.enroll.execute(sequenceId, businessId, invoiceIds);
    return { customerId, overrideSet: true, enrollment };
  }
}
