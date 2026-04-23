import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import Handlebars from "handlebars";
import type { TemplateService, TemplateData } from "../domain/template.service";

interface CachedTemplate {
  compiled: HandlebarsTemplateDelegate;
  templateHash: string;
}

/**
 * LRU-style template cache with a max size.
 * Uses Map's insertion order: deletes oldest entries when full.
 * Re-inserting on access moves entry to end (most recent).
 */
@Injectable()
export class HandlebarsTemplateService implements TemplateService {
  private readonly cache = new Map<string, CachedTemplate>();
  private readonly maxCacheSize = 1000;

  render(cacheKey: string, template: string, data: TemplateData): string {
    const compiled = this.getOrCompile(cacheKey, template);
    return compiled(data);
  }

  private getOrCompile(cacheKey: string, template: string): HandlebarsTemplateDelegate {
    const templateHash = this.hashTemplate(template);
    const cached = this.cache.get(cacheKey);

    if (cached && cached.templateHash === templateHash) {
      // Move to end (most recently used) by re-inserting
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.compiled;
    }

    const compiled = Handlebars.compile(template);

    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, { compiled, templateHash });

    return compiled;
  }

  private hashTemplate(template: string): string {
    return createHash("sha256").update(template).digest("hex").slice(0, 16);
  }
}
