export const DEFAULT_TEMPLATE_NAME = "Friendly first reminder";

export const DEFAULT_TEMPLATE_SUBJECT =
  "Quick note about invoice {{invoice_number}}";

export const DEFAULT_TEMPLATE_BODY =
  "Hi {{contact_name}},\n\n" +
  "Just a quick reminder that invoice {{invoice_number}} for {{balance_due}} was due on {{due_date}}. " +
  "If you've already paid, please disregard. Otherwise, you can pay here: {{payment_link}}\n\n" +
  "Let me know if you have any questions.";

export const DEFAULT_TEMPLATE_SIGNATURE = "Thanks,\n{{sender_name}}";
