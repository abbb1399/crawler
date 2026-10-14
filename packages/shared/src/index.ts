import { z } from 'zod';

/** Job sources supported by the crawler. Extended in later phases. */
export const JobSource = z.enum(['WANTED', 'JOBKOREA']);
export type JobSource = z.infer<typeof JobSource>;

/** Shape returned by GET /health. */
export const HealthResponse = z.object({
  status: z.literal('ok'),
  uptimeSec: z.number(),
  timestamp: z.string(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
