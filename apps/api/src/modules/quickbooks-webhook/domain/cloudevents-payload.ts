import { z } from "zod";

export const cloudEventSchema = z.object({
  specversion: z.literal("1.0"),
  id: z.string().min(1),
  source: z.string().min(1),
  type: z.string().min(1),
  time: z.string().datetime({ offset: true }),
  intuitentityid: z.string().min(1),
  intuitaccountid: z.string().min(1),
  datacontenttype: z.string().optional(),
  data: z.unknown().optional(),
});

export type CloudEvent = z.infer<typeof cloudEventSchema>;

export const cloudEventsArraySchema = z.array(cloudEventSchema).min(1);

const INVOICE_TYPE = /^qbo\.invoice\.([a-z]+)\.v1$/i;

export function parseInvoiceOperation(type: string): string | null {
  const match = INVOICE_TYPE.exec(type);
  return match ? match[1].toLowerCase() : null;
}
