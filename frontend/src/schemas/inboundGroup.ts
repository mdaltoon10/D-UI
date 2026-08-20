import { z } from 'zod';

export const InboundGroupSummarySchema = z.object({
  id: z.coerce.number(),
  name: z.string().default(''),
  remark: z.string().nullable().optional().transform((v) => v ?? ''),
  inboundIds: z.array(z.coerce.number()).nullable().optional().transform((v) => v ?? []),
  inboundTags: z.array(z.string()).nullable().optional().transform((v) => v ?? []),
  nodeIds: z.array(z.coerce.number()).nullable().optional().transform((v) => v ?? []),
  enable: z.boolean().nullable().optional().transform((v) => v !== false),
  inboundCount: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  nodeCount: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  clientCount: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  onlineCount: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  trafficUsed: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  up: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
  down: z.coerce.number().nullable().optional().transform((v) => v ?? 0),
}).passthrough();

export const InboundGroupListSchema = z.array(InboundGroupSummarySchema).nullable().optional().transform((v) => v ?? []);

export type InboundGroupSummary = z.infer<typeof InboundGroupSummarySchema>;
