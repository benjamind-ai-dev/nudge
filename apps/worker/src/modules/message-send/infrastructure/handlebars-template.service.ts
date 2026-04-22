import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import Handlebars from "handlebars";
import type { TemplateService, TemplateData } from "../domain/template.service";

interface CachedTemplate {
  compiled: HandlebarsTemplateDelegate;
  templateHash: string;
}

@Injectable()
export class HandlebarsTemplateService implements TemplateService {
  private readonly cache = new Map<string, CachedTemplate>();

  render(cacheKey: string, template: string, data: TemplateData): string {
    const compiled = this.getOrCompile(cacheKey, template);
    return compiled(data);
  }

  private getOrCompile(cacheKey: string, template: string): HandlebarsTemplateDelegate {
    const templateHash = this.hashTemplate(template);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.templateHash === templateHash) {
      return cached.compiled;
    }

    const compiled = Handlebars.compile(template);
    this.cache.set(cacheKey, { compiled, templateHash });

    return compiled;
  }

  private hashTemplate(template: string): string {
    return createHash("sha256").update(template).digest("hex").slice(0, 16);
  }
}
