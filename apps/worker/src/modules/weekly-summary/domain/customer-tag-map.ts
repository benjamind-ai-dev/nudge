export interface CustomerEntry {
  id: string;
  name: string;
  outstandingCents: number;
}

export class CustomerTagMap {
  private readonly idToTag = new Map<string, string>();
  private readonly tagToName = new Map<string, string>();

  private constructor(entries: CustomerEntry[]) {
    const dedupedById = new Map<string, CustomerEntry>();
    for (const e of entries) {
      if (!dedupedById.has(e.id)) dedupedById.set(e.id, e);
    }

    const sorted = [...dedupedById.values()].sort((a, b) => {
      if (b.outstandingCents !== a.outstandingCents) return b.outstandingCents - a.outstandingCents;
      return a.id.localeCompare(b.id);
    });

    sorted.forEach((entry, index) => {
      const tag = CustomerTagMap.indexToTag(index);
      this.idToTag.set(entry.id, tag);
      this.tagToName.set(tag, entry.name);
    });
  }

  static fromEntries(entries: CustomerEntry[]): CustomerTagMap {
    return new CustomerTagMap(entries);
  }

  get size(): number {
    return this.idToTag.size;
  }

  tagFor(customerId: string): string | undefined {
    return this.idToTag.get(customerId);
  }

  nameFor(tag: string): string | undefined {
    return this.tagToName.get(tag);
  }

  substitute(text: string): string {
    let out = text;
    for (const [tag, name] of this.tagToName) {
      out = out.split(tag).join(name);
    }
    return out;
  }

  validate(text: string): { unknownTags: string[] } {
    const found = text.match(/\[CUSTOMER_[A-Z]+\]/g) ?? [];
    const unknownTags = [...new Set(found)].filter((t) => !this.tagToName.has(t));
    return { unknownTags };
  }

  containsAnyRealName(text: string): boolean {
    for (const name of this.tagToName.values()) {
      if (name.length > 0 && text.includes(name)) return true;
    }
    return false;
  }

  private static indexToTag(index: number): string {
    let n = index;
    let label = "";
    do {
      label = String.fromCharCode(65 + (n % 26)) + label;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return `[CUSTOMER_${label}]`;
  }
}
