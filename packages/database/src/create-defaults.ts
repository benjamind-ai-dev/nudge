import { PrismaClient } from "@prisma/client";

export interface StepTemplate {
  stepOrder: number;
  delayDays: number;
  channel: string;
  subjectTemplate: string | null;
  bodyTemplate: string;
  isOwnerAlert: boolean;
}

export const STANDARD_STEPS: StepTemplate[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    channel: "email",
    subjectTemplate:
      "Friendly reminder: Invoice {{invoice.invoice_number}} is due",
    bodyTemplate: `Hi {{customer.contact_name}},

I hope this message finds you well. This is a quick reminder that invoice {{invoice.invoice_number}} for {{invoice.amount}} was due on {{invoice.due_date}}.

If you've already sent payment, please disregard this note — we appreciate it! Otherwise, we'd be grateful if you could arrange payment at your earliest convenience.

You can view and pay your invoice here: {{invoice.payment_link}}

Thank you for your business.

Best regards,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 2,
    delayDays: 7,
    channel: "email",
    subjectTemplate:
      "Following up: Invoice {{invoice.invoice_number}} — {{invoice.days_overdue}} days past due",
    bodyTemplate: `Hi {{customer.contact_name}},

I wanted to follow up regarding invoice {{invoice.invoice_number}} for {{invoice.amount}}, which is now {{invoice.days_overdue}} days past the due date of {{invoice.due_date}}.

We understand things can slip through the cracks, so just a polite nudge to see if we can get this resolved. The outstanding balance is {{invoice.balance_due}}.

Pay online here: {{invoice.payment_link}}

If there are any questions or issues with this invoice, please don't hesitate to reach out — happy to help.

Kind regards,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 3,
    delayDays: 14,
    channel: "email_and_sms",
    subjectTemplate:
      "Action needed: Invoice {{invoice.invoice_number}} is {{invoice.days_overdue}} days overdue",
    bodyTemplate: `Hi {{customer.contact_name}},

I'm reaching out again regarding the outstanding balance of {{invoice.balance_due}} on invoice {{invoice.invoice_number}}, originally due on {{invoice.due_date}}. This invoice is now {{invoice.days_overdue}} days past due.

We'd like to resolve this promptly and keep everything in good standing. Could you please let us know the status of this payment or arrange to settle the balance?

Pay now: {{invoice.payment_link}}

If you're experiencing any difficulties, we're happy to discuss options. Please reply to this message or give us a call.

Thank you,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 4,
    delayDays: 30,
    channel: "email",
    subjectTemplate:
      "Urgent: Invoice {{invoice.invoice_number}} is significantly overdue",
    bodyTemplate: `Hi {{customer.contact_name}},

This is an important notice regarding invoice {{invoice.invoice_number}} for {{invoice.amount}}. The balance of {{invoice.balance_due}} is now {{invoice.days_overdue}} days past due, and we have not yet received payment or a response to our previous reminders.

We value our relationship with {{customer.company_name}} and want to avoid any further escalation. Please arrange payment as soon as possible or contact us immediately to discuss a resolution.

Pay here: {{invoice.payment_link}}

If payment has already been made, please reply with confirmation so we can update our records.

Regards,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 5,
    delayDays: 45,
    channel: "email",
    subjectTemplate:
      "Final notice: Immediate payment required for Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{customer.contact_name}},

This is a final notice regarding the overdue balance of {{invoice.balance_due}} on invoice {{invoice.invoice_number}}, which is now {{invoice.days_overdue}} days past due.

Despite multiple attempts to reach you, this invoice remains unpaid. We must receive payment or hear from you within the next 15 days to avoid further action, which may include suspending services or referring this matter for collections.

Please pay immediately: {{invoice.payment_link}}

We would much prefer to resolve this directly. If there are circumstances preventing payment, please contact us right away so we can work together on a solution.

Sincerely,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 6,
    delayDays: 60,
    channel: "email",
    subjectTemplate:
      "[Internal] Overdue alert: {{customer.company_name}} — Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{business.sender_name}},

This is an automated internal alert. The following invoice has reached 60 days overdue with no resolution despite the full follow-up sequence:

Customer: {{customer.company_name}} ({{customer.contact_name}})
Invoice: {{invoice.invoice_number}}
Original amount: {{invoice.amount}}
Outstanding balance: {{invoice.balance_due}}
Days overdue: {{invoice.days_overdue}}
Due date: {{invoice.due_date}}

All automated reminders have been sent without a response or payment. This account requires your personal attention. Recommended next steps:

1. Call the customer directly to discuss the outstanding balance
2. Evaluate whether to escalate to a collections process
3. Review the customer relationship and adjust terms if needed

This alert is for internal use only and was not sent to the customer.`,
    isOwnerAlert: true,
  },
];

export const VIP_STEPS: StepTemplate[] = [
  {
    stepOrder: 1,
    delayDays: 0,
    channel: "email",
    subjectTemplate:
      "Quick note regarding Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{customer.contact_name}},

Thank you for your continued partnership — we truly value working with {{customer.company_name}}.

Just a gentle heads-up that invoice {{invoice.invoice_number}} for {{invoice.amount}} was due on {{invoice.due_date}}. No rush if it's already in process — we just wanted to make sure it's on your radar.

For your convenience, you can view and pay here: {{invoice.payment_link}}

Please don't hesitate to reach out if you need anything at all.

Warm regards,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 2,
    delayDays: 10,
    channel: "email",
    subjectTemplate:
      "Checking in: Invoice {{invoice.invoice_number}} from {{invoice.due_date}}",
    bodyTemplate: `Hi {{customer.contact_name}},

I hope you're doing well. I'm personally following up on invoice {{invoice.invoice_number}} for {{invoice.amount}}, which was due on {{invoice.due_date}}. The current balance is {{invoice.balance_due}}.

I completely understand that timing doesn't always work out perfectly, and I wanted to check in to see if there's anything on your end we should be aware of. If there's a preferred payment timeline that works better for {{customer.company_name}}, I'm happy to discuss.

Pay at your convenience here: {{invoice.payment_link}}

Looking forward to hearing from you.

Best,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 3,
    delayDays: 21,
    channel: "email_and_sms",
    subjectTemplate:
      "Following up on your outstanding balance — Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{customer.contact_name}},

I wanted to circle back regarding invoice {{invoice.invoice_number}}, which has an outstanding balance of {{invoice.balance_due}} and is now {{invoice.days_overdue}} days past the due date.

Given our strong relationship with {{customer.company_name}}, I want to make sure there isn't an issue we can help with. Whether it's a billing question, a dispute on the invoice, or simply a matter of timing, we're here to work with you.

You can settle the balance here: {{invoice.payment_link}}

Please let me know how you'd like to proceed — I'm happy to accommodate whatever works best for your team.

Warm regards,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 4,
    delayDays: 35,
    channel: "email",
    subjectTemplate:
      "Wanted to connect about Invoice {{invoice.invoice_number}} — {{invoice.days_overdue}} days outstanding",
    bodyTemplate: `Hi {{customer.contact_name}},

I'm reaching out once more about invoice {{invoice.invoice_number}} with an outstanding balance of {{invoice.balance_due}}. It's been {{invoice.days_overdue}} days since the original due date, and I want to make sure everything is okay on your end.

I have not heard back regarding my previous messages and want to assure you that we're committed to finding a resolution that works for both sides. If there are any concerns or if you'd like to arrange a payment plan, I'm here to help.

Payment link: {{invoice.payment_link}}

Your partnership means a great deal to us, and I'd love to get this sorted out together.

Sincerely,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 5,
    delayDays: 50,
    channel: "email",
    subjectTemplate:
      "Important: Resolution needed for Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{customer.contact_name}},

I'm writing with some urgency regarding the outstanding balance of {{invoice.balance_due}} on invoice {{invoice.invoice_number}}, now {{invoice.days_overdue}} days past due.

We have great respect for {{customer.company_name}} and the relationship we've built together, which is why I'd like to resolve this matter directly rather than involve any formal process. However, I do need to hear from you soon so we can agree on a path forward.

Please pay here: {{invoice.payment_link}}

If there is any reason payment has been delayed, or if you'd like to discuss alternative arrangements, please reply to this email or call me directly. I'm confident we can find a solution.

Respectfully,
{{business.sender_name}}`,
    isOwnerAlert: false,
  },
  {
    stepOrder: 6,
    delayDays: 65,
    channel: "email",
    subjectTemplate:
      "[Internal] VIP account alert: {{customer.company_name}} — Invoice {{invoice.invoice_number}}",
    bodyTemplate: `Hi {{business.sender_name}},

This is an automated internal alert for a VIP account that requires your immediate personal attention.

Customer: {{customer.company_name}} ({{customer.contact_name}})
Tier: VIP
Invoice: {{invoice.invoice_number}}
Original amount: {{invoice.amount}}
Outstanding balance: {{invoice.balance_due}}
Days overdue: {{invoice.days_overdue}}
Due date: {{invoice.due_date}}

The full follow-up sequence has been completed without a response or payment. Because this is a VIP account, extra care is needed. Recommended next steps:

1. Reach out to {{customer.contact_name}} with a personal phone call
2. Consider whether a meeting (in-person or virtual) would be appropriate
3. Review the overall account health and relationship history
4. Determine if a custom payment arrangement should be offered
5. Avoid any escalation to collections without first exhausting personal outreach

This is a high-value relationship. Handle with care and prioritize preserving the partnership.

This alert is for internal use only and was not sent to the customer.`,
    isOwnerAlert: true,
  },
];

export async function createDefaultTiersAndSequences(
  prisma: PrismaClient,
  businessId: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.relationshipTier.findFirst({
      where: { businessId },
    });

    if (existing) {
      return;
    }

    const standardTier = await tx.relationshipTier.create({
      data: {
        businessId,
        name: "Standard",
        description:
          "Default tier for all customers. Uses a direct, professional follow-up sequence.",
        isDefault: true,
        sortOrder: 1,
      },
    });

    const vipTier = await tx.relationshipTier.create({
      data: {
        businessId,
        name: "VIP",
        description:
          "High-value accounts that require a softer, relationship-focused approach with longer intervals.",
        isDefault: false,
        sortOrder: 2,
      },
    });

    const standardSequence = await tx.sequence.create({
      data: {
        businessId,
        relationshipTierId: standardTier.id,
        name: "Standard Follow-Up",
      },
    });

    const vipSequence = await tx.sequence.create({
      data: {
        businessId,
        relationshipTierId: vipTier.id,
        name: "VIP Follow-Up",
      },
    });

    await tx.sequenceStep.createMany({
      data: STANDARD_STEPS.map((step) => ({
        sequenceId: standardSequence.id,
        stepOrder: step.stepOrder,
        delayDays: step.delayDays,
        channel: step.channel,
        subjectTemplate: step.subjectTemplate,
        bodyTemplate: step.bodyTemplate,
        isOwnerAlert: step.isOwnerAlert,
      })),
    });

    await tx.sequenceStep.createMany({
      data: VIP_STEPS.map((step) => ({
        sequenceId: vipSequence.id,
        stepOrder: step.stepOrder,
        delayDays: step.delayDays,
        channel: step.channel,
        subjectTemplate: step.subjectTemplate,
        bodyTemplate: step.bodyTemplate,
        isOwnerAlert: step.isOwnerAlert,
      })),
    });
  });
}
