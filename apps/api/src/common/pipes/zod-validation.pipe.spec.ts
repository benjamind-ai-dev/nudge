import { BadRequestException } from "@nestjs/common";
import { z } from "zod";
import { ZodValidationPipe } from "./zod-validation.pipe";

describe("ZodValidationPipe", () => {
  const schema = z.object({
    email: z.string().email(),
    amountCents: z.number().int().positive(),
  });

  const pipe = new ZodValidationPipe(schema);

  it("returns parsed data for valid input", () => {
    const input = { email: "test@example.com", amountCents: 1000 };
    expect(pipe.transform(input)).toEqual(input);
  });

  it("strips unknown fields", () => {
    const input = { email: "test@example.com", amountCents: 1000, extra: "field" };
    expect(pipe.transform(input)).toEqual({ email: "test@example.com", amountCents: 1000 });
  });

  it("throws BadRequestException for invalid input", () => {
    const input = { email: "not-an-email", amountCents: -5 };
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it("includes field-level details in the error", () => {
    const input = { email: "not-an-email", amountCents: -5 };
    try {
      pipe.transform(input);
      fail("Expected BadRequestException");
    } catch (err) {
      const response = (err as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.statusCode).toBe(400);
      expect(response.error).toBe("Validation Error");
      expect(response.details).toBeDefined();
    }
  });
});
