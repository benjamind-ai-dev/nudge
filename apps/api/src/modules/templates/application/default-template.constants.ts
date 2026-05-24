export const DEFAULT_TEMPLATE_NAME = "Friendly first reminder";

export const DEFAULT_TEMPLATE_SUBJECT =
  "Quick note about invoice {{invoice.invoice_number}}";

export const DEFAULT_TEMPLATE_BODY =
  "Hi {{customer.contact_name}},\n\n" +
  "Just a quick reminder that invoice {{invoice.invoice_number}} for {{invoice.balance_due}} was due on {{invoice.due_date}}. " +
  "If you've already paid, please disregard. Otherwise, you can pay here: {{invoice.payment_link}}\n\n" +
  "Let me know if you have any questions.";

export const DEFAULT_TEMPLATE_SIGNATURE = "Thanks,\n{{business.sender_name}}";
