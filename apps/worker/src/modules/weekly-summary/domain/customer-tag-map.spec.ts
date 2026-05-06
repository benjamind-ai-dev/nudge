import { CustomerTagMap } from "./customer-tag-map";

describe("CustomerTagMap", () => {
  it("assigns tags A, B, C deterministically by amount desc then id asc", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c2", name: "Beta Co", outstandingCents: 5000 },
      { id: "c1", name: "Alpha Co", outstandingCents: 5000 },
      { id: "c3", name: "Gamma Co", outstandingCents: 9000 },
    ]);

    expect(map.tagFor("c3")).toBe("[CUSTOMER_A]");
    expect(map.tagFor("c1")).toBe("[CUSTOMER_B]");
    expect(map.tagFor("c2")).toBe("[CUSTOMER_C]");
  });

  it("dedupes customers added under multiple sources", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c1", name: "Alpha", outstandingCents: 100 },
      { id: "c1", name: "Alpha", outstandingCents: 100 },
    ]);

    expect(map.size).toBe(1);
  });

  it("returns the real names referenced by tags", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c1", name: "Acme Inc", outstandingCents: 100 },
    ]);

    expect(map.nameFor("[CUSTOMER_A]")).toBe("Acme Inc");
    expect(map.nameFor("[CUSTOMER_Z]")).toBeUndefined();
  });

  it("substitutes all tags in a string with real names", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c1", name: "Acme Inc", outstandingCents: 200 },
      { id: "c2", name: "Bob's Plumbing", outstandingCents: 100 },
    ]);

    const out = map.substitute("Call [CUSTOMER_A]; also chase [CUSTOMER_B] today.");
    expect(out).toBe("Call Acme Inc; also chase Bob's Plumbing today.");
  });

  it("validate() returns the unknown tags found in a string", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c1", name: "Acme", outstandingCents: 1 },
    ]);

    expect(map.validate("All [CUSTOMER_A] is fine")).toEqual({ unknownTags: [] });
    expect(map.validate("Hi [CUSTOMER_X], [CUSTOMER_A]")).toEqual({
      unknownTags: ["[CUSTOMER_X]"],
    });
  });

  it("containsAnyRealName returns true if a real name leaks into output", () => {
    const map = CustomerTagMap.fromEntries([
      { id: "c1", name: "Acme Inc", outstandingCents: 1 },
    ]);

    expect(map.containsAnyRealName("Call [CUSTOMER_A] today")).toBe(false);
    expect(map.containsAnyRealName("Call Acme Inc today")).toBe(true);
  });

  it("supports more than 26 customers via two-letter tags", () => {
    const entries = Array.from({ length: 27 }, (_, i) => ({
      id: `c${i}`,
      name: `Cust ${i}`,
      outstandingCents: 1000 - i,
    }));
    const map = CustomerTagMap.fromEntries(entries);

    expect(map.tagFor("c0")).toBe("[CUSTOMER_A]");
    expect(map.tagFor("c25")).toBe("[CUSTOMER_Z]");
    expect(map.tagFor("c26")).toBe("[CUSTOMER_AA]");
  });
});
