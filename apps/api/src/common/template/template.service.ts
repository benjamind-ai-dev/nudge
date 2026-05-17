export interface TemplateData {
  [key: string]: string;
}

export interface TemplateService {
  render(cacheKey: string, template: string, data: TemplateData): string;
}

export const TEMPLATE_SERVICE = Symbol("TemplateService");
