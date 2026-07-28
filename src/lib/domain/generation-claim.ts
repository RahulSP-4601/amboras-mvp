export interface GenerationJobState {
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  attemptCount: number;
  startedAt: string | null;
}

export type GenerationDisposition = "replay" | "restart" | "wait" | "exhausted";

export function generationJobDisposition(
  job: GenerationJobState,
  now: number,
  maxAttempts = 3,
  runningLeaseMs = 2 * 60 * 1_000,
): GenerationDisposition {
  if (job.status === "succeeded") return "replay";
  if (job.status === "running") {
    if (!job.startedAt) return "wait";
    const leaseExpired = now - Date.parse(job.startedAt) > runningLeaseMs;
    if (!leaseExpired) return "wait";
    return job.attemptCount >= maxAttempts ? "exhausted" : "restart";
  }
  if (job.attemptCount >= maxAttempts) return "exhausted";
  if (job.status === "failed") return "restart";
  return "wait";
}
