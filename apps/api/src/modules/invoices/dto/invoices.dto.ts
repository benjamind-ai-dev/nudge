import { z } from "zod";

export const businessIdQuerySchema = z.string().uuid();
export type BusinessIdQuery = z.infer<typeof businessIdQuerySchema>;
