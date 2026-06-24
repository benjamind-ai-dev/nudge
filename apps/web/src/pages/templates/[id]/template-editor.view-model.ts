export const SAMPLE_DATA: Record<string, string> = {
  company_name: "Acme Books",
  contact_name: "Jordan",
  invoice_number: "#INV-1042",
  amount: "$2,400",
  balance_due: "$2,400",
  due_date: "Jun 10, 2026",
  days_overdue: "14",
  payment_link: "https://pay.nudge.app/inv-1042",
  sender_name: "Sarah Chen",
};

export function resolveVariables(
  text: string,
  data: Record<string, string> = SAMPLE_DATA,
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in data ? data[key] : match,
  );
}
