import { z } from "zod";

export const snapshotInput = z.object({
  status: z.enum(["green", "yellow", "red"]),
  summary: z.string().min(1),
  nextSteps: z
    .array(z.object({ text: z.string().min(1), owner: z.string().optional(), due: z.string().optional() }))
    .default([]),
  openPoints: z.array(z.object({ text: z.string().min(1), since: z.string().optional() })).default([]),
  sources: z
    .object({
      threads: z.array(z.object({ id: z.string(), subject: z.string() })).default([]),
      meetings: z.array(z.object({ id: z.string(), title: z.string(), date: z.string() })).default([]),
    })
    .default({ threads: [], meetings: [] }),
  hasChanges: z.boolean().default(true),
});
export type SnapshotInput = z.infer<typeof snapshotInput>;

export const clientPatch = z
  .object({
    gmailLabelId: z.string().optional(),
    domains: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
  })
  .strict();
export type ClientPatch = z.infer<typeof clientPatch>;

export const noteInput = z.object({ body: z.string().trim().min(1) });
