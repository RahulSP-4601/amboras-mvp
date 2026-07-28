import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  claimGenerationJob,
  failGenerationJob,
  GenerationAuthenticationError,
  GenerationClaimError,
  getGenerationJobStage,
  saveGenerationOutput,
  updateGenerationStage,
  type GenerationJob,
} from "@/lib/ai/generation-jobs";
import { AiRequestLimitError } from "@/lib/ai/request-guard";
import { generateStore } from "@/lib/ai/store-generator";
import { productInputSchema } from "@/lib/domain/product";
import { isSupabaseConfigured } from "@/lib/env";
import { persistGeneratedStore } from "@/lib/stores/persist-generated-store";

export async function POST(request: Request) {
  let job: GenerationJob | null = null;
  try {
    const payload = productInputSchema.parse(await request.json());
    const key = z.string().uuid().parse(request.headers.get("Idempotency-Key"));
    const configured = isSupabaseConfigured();
    if (!configured && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Store generation is not configured." },
        { status: 503 },
      );
    }
    if (configured) {
      const claim = await claimGenerationJob(key, JSON.stringify(payload));
      if (claim.kind === "replay") {
        return NextResponse.json(claim.result, { status: 200 });
      }
      job = claim.job;
    }
    const result = await resolveGenerationResult(payload, job);
    if (job) {
      if (!job.stagedResult) await saveGenerationOutput(job, result);
      const persisted = await persistGeneratedStore(
        job,
        payload,
        result.config,
        result.mode,
      );
      return NextResponse.json(persisted, { status: 201 });
    }
    return NextResponse.json({ ...result, persisted: null }, { status: 201 });
  } catch (error) {
    if (job) await failGenerationJob(job).catch(() => undefined);
    return generationErrorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const key = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("key"));
    const stage = await getGenerationJobStage(key);
    return NextResponse.json({ stage });
  } catch (error) {
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof GenerationAuthenticationError
          ? 401
          : 503;
    return NextResponse.json({ error: "Status is unavailable." }, { status });
  }
}

async function resolveGenerationResult(
  payload: unknown,
  job: GenerationJob | null,
) {
  if (job?.stagedResult) {
    return { config: job.stagedResult.config, mode: job.stagedResult.mode };
  }
  if (job) await updateGenerationStage(job, "generating_storefront");
  const result = await generateStore(payload);
  if (job) {
    await updateGenerationStage(job, "validating_generated_content");
  }
  return result;
}

function generationErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Please review the product details.", issues: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof GenerationAuthenticationError) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof GenerationClaimError) {
    const status = error.code === "attempts_exhausted" ? 422 : 409;
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status },
    );
  }
  if (error instanceof AiRequestLimitError) {
    return NextResponse.json(
      { error: "Generation request limit reached." },
      { status: 429 },
    );
  }
  return NextResponse.json(
    { error: "Store generation could not be completed." },
    { status: 503 },
  );
}
