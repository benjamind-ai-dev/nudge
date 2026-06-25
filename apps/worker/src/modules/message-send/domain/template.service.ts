export interface TemplateData {
  company_name: string;
  contact_name: string | null;
  invoice_number: string | null;
  amount: string;
  balance_due: string;
  due_date: string;
  days_overdue: number;
  payment_link: string | null;
  sender_name: string;
}

export interface TemplateService {
  render(cacheKey: string, template: string, data: TemplateData): string;
}

export const TEMPLATE_SERVICE = Symbol("TemplateService");
