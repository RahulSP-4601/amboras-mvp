import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import { proposeStoreEdit } from "@/lib/ai/store-editor";
import {
  claimProposalJob,
  completeProposalJob,
  failProposalJob,
  ProposalJobError,
  type ProposalJob,
} from "@/lib/ai/proposal-jobs";
import { AiRequestLimitError } from "@/lib/ai/request-guard";
import { storeConfigSchema } from "@/lib/domain/store-config";
import { isSupabaseConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const requestSchema = z
  .object({
    config: storeConfigSchema,
    instruction: z.string().trim().min(3).max(500),
    storeId: z.string().uuid().optional(),
  })
  .strict();

export async function POST(request: Request) {
  let job: ProposalJob | null = null;
  try {
    const input = requestSchema.parse(await request.json());
    if (isSupabaseConfigured()) {
      const client = await createClient();
      const { data: auth, error: authError } = await client.auth.getUser();
      if (authError) return authenticationUnavailableResponse();
      if (!auth.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (!input.storeId) {
        return NextResponse.json(
          { error: "Store is required." },
          { status: 400 },
        );
      }
      const key = z
        .string()
        .uuid()
        .parse(request.headers.get("Idempotency-Key"));
      const claim = await claimProposalJob({
        userId: auth.user.id,
        storeId: input.storeId,
        idempotencyKey: key,
        inputSummary: JSON.stringify(input),
      });
      if (claim.kind === "replay") {
        return NextResponse.json({ proposal: claim.proposal });
      }
      job = claim.job;
    } else if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Store editing is not configured." },
        { status: 503 },
      );
    }
    const proposal = await proposeStoreEdit(input.config, input.instruction);
    if (job) await completeProposalJob(job, proposal);
    return NextResponse.json({ proposal });
  } catch (error) {
    if (job) await failProposalJob(job);
    const status = proposalErrorStatus(error);
    return NextResponse.json(
      { error: "A safe edit proposal could not be created." },
      { status },
    );
  }
}

function authenticationUnavailableResponse() {
  return NextResponse.json(
    { error: "Authentication is temporarily unavailable." },
    { status: 503 },
  );
}

function proposalErrorStatus(error: unknown) {
  if (error instanceof ZodError) return 400;
  if (error instanceof AiRequestLimitError) return 429;
  if (!(error instanceof ProposalJobError)) return 503;
  if (error.code === "not_owned") return 403;
  if (error.code === "exhausted") return 422;
  return 409;
}
