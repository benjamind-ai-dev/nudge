import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";
import type { TemplateService, TemplateData } from "../domain/template.service";

@Injectable()
export class HandlebarsTemplateService implements TemplateService {
  private readonly cache = new Map<string, HandlebarsTemplateDelegate>();

  render(stepId: string, template: string, data: TemplateData): string {
    const compiled = this.getOrCompile(stepId, template);
    return compiled(data);
  }

  private getOrCompile(stepId: string, template: string): HandlebarsTemplateDelegate {
    let compiled = this.cache.get(stepId);

    if (!compiled) {
      compiled = Handlebars.compile(template);
      this.cache.set(stepId, compiled);
    }

    return compiled;
  }
}
