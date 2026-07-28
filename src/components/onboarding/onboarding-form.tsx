"use client";

import { ArrowRight, Check, ImagePlus, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { z } from "zod";

import { productInputSchema } from "@/lib/domain/product";
import type { ProductInput } from "@/lib/domain/product";
import { generationResponseSchema } from "@/lib/domain/generation-result";
import { generationFailureIsTerminal } from "@/lib/domain/generation-retry";
import { generationStageSchema } from "@/lib/domain/generation-stage";
import type {
  GenerationAttempt,
  GenerationOwnerScope,
} from "@/lib/domain/generation-attempt";
import {
  clearGenerationAttempt,
  getGenerationAttemptSnapshot,
  persistGenerationAttempt,
  subscribeToGenerationAttempt,
} from "@/lib/stores/generation-attempt";
import { createClient } from "@/lib/supabase/browser";

const stages = [
  "Validating product",
  "Preparing store brief",
  "Generating storefront",
  "Validating generated content",
  "Saving draft version",
];

export function OnboardingForm({
  ownerScope,
}: {
  ownerScope: GenerationOwnerScope;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [stage, setStage] = useState(-1);
  const [formInput, setFormInput] = useState<ProductInput | null>(null);
  const retryRecord = useSyncExternalStore(
    subscribeToGenerationAttempt,
    getGenerationAttemptSnapshot,
    emptyGenerationRecord,
  );
  const retryAttempt =
    retryRecord?.ownerScope === ownerScope ? retryRecord.attempt : null;
  useEffect(() => {
    if (retryRecord && retryRecord.ownerScope !== ownerScope) {
      clearGenerationAttempt();
    }
  }, [ownerScope, retryRecord]);
  const controls = {
    complete: () => router.push("/app/store"),
    ownerScope,
    setError,
    setFormInput,
    setStage,
  };

  if (stage >= 0) return <GenerationProgress stage={stage} />;
  if (retryAttempt) {
    return (
      <GenerationRetry
        error={error}
        hasImage={Boolean(retryAttempt.uploaded)}
        retry={() => runGenerationAttempt(retryAttempt, controls)}
      />
    );
  }
  return (
    <ProductForm
      error={error}
      initialInput={formInput}
      submit={(formData) => submitProduct(formData, controls)}
    />
  );
}

interface GenerationControls {
  complete: () => void;
  ownerScope: GenerationOwnerScope;
  setError: Dispatch<SetStateAction<string>>;
  setFormInput: Dispatch<SetStateAction<ProductInput | null>>;
  setStage: Dispatch<SetStateAction<number>>;
}

function emptyGenerationRecord() {
  return null;
}

function ProductForm(props: {
  error: string;
  initialInput: ProductInput | null;
  submit: (data: FormData) => Promise<void>;
}) {
  return (
    <form action={props.submit} className="onboarding-form">
      <label>
        <span>What do you want to sell?</span>
        <textarea
          name="description"
          placeholder="Example: A premium lightweight backpack designed for daily work and weekend travel…"
          required
          rows={6}
          defaultValue={props.initialInput?.description}
        />
        <small>
          Be specific about the product, audience, materials, and benefits.
        </small>
      </label>
      <ProductDetailsFields initialInput={props.initialInput} />
      <div className="upload-note">
        <ImagePlus size={18} />
        Secure file upload will use Supabase Storage when credentials are
        connected.
      </div>
      {props.error ? <p className="onboarding-error">{props.error}</p> : null}
      <button className="button app-primary generate-button" type="submit">
        <Sparkles size={17} /> Generate my store <ArrowRight size={17} />
      </button>
    </form>
  );
}

function ProductDetailsFields(props: { initialInput: ProductInput | null }) {
  return (
    <div className="form-grid">
      <Field
        defaultValue={props.initialInput?.name}
        label="Product name"
        name="name"
        placeholder="Optional"
      />
      <Field
        defaultValue={props.initialInput?.price}
        label="Confirmed price"
        name="price"
        placeholder="Optional"
        type="number"
      />
      <Field
        defaultValue={props.initialInput?.brandName}
        label="Brand name"
        name="brandName"
        placeholder="Optional"
      />
      <label>
        <span>Product image</span>
        <input
          accept="image/jpeg,image/png,image/webp"
          name="image"
          type="file"
        />
      </label>
    </div>
  );
}

function Field(props: {
  defaultValue?: string | number;
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <input
        defaultValue={props.defaultValue}
        min={props.type === "number" ? "0.01" : undefined}
        name={props.name}
        placeholder={props.placeholder}
        step={props.type === "number" ? "0.01" : undefined}
        type={props.type || "text"}
      />
    </label>
  );
}

function GenerationRetry(props: {
  error: string;
  hasImage: boolean;
  retry: () => Promise<void>;
}) {
  return (
    <div className="generation-retry">
      <Sparkles size={22} />
      <h2>Your generation request is ready to retry.</h2>
      <p>{props.error}</p>
      {props.hasImage ? (
        <small>The uploaded image will be reused.</small>
      ) : null}
      <button
        className="button app-primary generate-button"
        onClick={() => void props.retry()}
        type="button"
      >
        Retry the same request <ArrowRight size={17} />
      </button>
    </div>
  );
}

function GenerationProgress({ stage }: { stage: number }) {
  return (
    <div className="generation-progress">
      <span className="generation-mark">
        <Sparkles />
      </span>
      <h2>Generating your store…</h2>
      <p>Each status below reflects a real application stage.</p>
      <div>
        {stages.map((item, index) => (
          <span className={index <= stage ? "active" : ""} key={item}>
            {index < stage ? <Check size={15} /> : <i />}
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function readInput(data: FormData) {
  const price = readText(data.get("price"));
  return {
    description: readText(data.get("description")),
    name: optional(data.get("name")),
    price: price ? Number(price) : undefined,
    brandName: optional(data.get("brandName")),
  };
}

function optional(value: FormDataEntryValue | null): string | undefined {
  const text = readText(value);
  return text || undefined;
}

function readText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

async function submitProduct(formData: FormData, controls: GenerationControls) {
  controls.setError("");
  const parsed = productInputSchema.safeParse(readInput(formData));
  if (!parsed.success) {
    controls.setError(
      parsed.error.issues[0]?.message || "Review your product details.",
    );
    return;
  }
  controls.setFormInput(parsed.data);
  controls.setStage(0);
  try {
    const uploaded = await uploadImage(formData.get("image"));
    await runGenerationAttempt(
      {
        input: { ...parsed.data, imageUrl: uploaded?.publicUrl },
        uploaded,
      },
      controls,
    );
  } catch {
    showGenerationFailure(controls);
  }
}

async function runGenerationAttempt(
  attempt: GenerationAttempt,
  controls: GenerationControls,
) {
  controls.setError("");
  controls.setFormInput(attempt.input);
  controls.setStage(0);
  try {
    const key = persistGenerationAttempt(attempt, controls.ownerScope);
    const result = await requestGeneration(
      attempt.input,
      key,
      controls.setStage,
    );
    cacheGeneratedDraft(result);
    clearGenerationAttempt();
    controls.complete();
  } catch (cause) {
    const terminal = canDeleteUpload(cause);
    if (attempt.uploaded && terminal) {
      await deleteUpload(attempt.uploaded.path).catch(() => undefined);
    }
    if (terminal) clearGenerationAttempt();
    showGenerationFailure(controls);
  }
}

function showGenerationFailure(controls: GenerationControls) {
  controls.setError(
    "We could not generate this store. Your input is safe—please retry.",
  );
  controls.setStage(-1);
}

async function uploadImage(value: FormDataEntryValue | null) {
  if (!value || typeof value === "string" || value.size === 0) return undefined;
  if (value.size > 5 * 1024 * 1024) throw new Error("Image is too large");
  const extension = imageExtension(value.type);
  if (!extension) throw new Error("Unsupported image type");
  const client = createClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("Authentication is required for uploads");
  const path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
  const { error } = await client.storage
    .from("product-images")
    .upload(path, value, {
      cacheControl: "3600",
      contentType: value.type,
      upsert: false,
    });
  if (error) throw new Error("Image upload failed");
  return {
    path,
    publicUrl: client.storage.from("product-images").getPublicUrl(path).data
      .publicUrl,
  };
}

async function requestGeneration(
  input: ProductInput,
  key: string,
  setStage: (stage: number) => void,
) {
  const stageTimer = window.setInterval(() => {
    void pollGenerationStage(key, setStage);
  }, 500);
  try {
    const response = await fetch("/api/store/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const errorBody: unknown = await response.json().catch(() => null);
      const errorCode = z
        .object({ code: z.string().optional() })
        .safeParse(errorBody);
      const code = errorCode.success ? errorCode.data.code : undefined;
      const terminal = generationFailureIsTerminal(response.status, code);
      throw new GenerationRequestError(terminal);
    }
    const body: unknown = await response.json();
    const result = generationResponseSchema.parse(body);
    setStage(4);
    return {
      config: result.config,
      product: input,
      persisted: result.persisted,
      generatedAt: new Date().toISOString(),
    };
  } finally {
    window.clearInterval(stageTimer);
  }
}

const stageIndex = {
  validating_product: 0,
  preparing_store_brief: 1,
  generating_storefront: 2,
  validating_generated_content: 3,
  saving_draft_version: 4,
} as const;

async function pollGenerationStage(
  key: string,
  setStage: (stage: number) => void,
) {
  try {
    const response = await fetch(
      `/api/store/generate?key=${encodeURIComponent(key)}`,
    );
    if (!response.ok) return;
    const body: unknown = await response.json();
    const parsed = z
      .object({ stage: generationStageSchema.nullable() })
      .parse(body);
    if (parsed.stage) setStage(stageIndex[parsed.stage]);
  } catch {
    // Polling is best-effort; the generation request owns the visible error.
  }
}

function imageExtension(contentType: string) {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };
  return extensions[contentType];
}

async function deleteUpload(path: string) {
  const { error } = await createClient()
    .storage.from("product-images")
    .remove([path]);
  if (error) throw new Error("Image cleanup failed");
}

class GenerationRequestError extends Error {
  constructor(readonly safeToDeleteUpload: boolean) {
    super("Generation request failed");
  }
}

function canDeleteUpload(cause: unknown) {
  return cause instanceof GenerationRequestError && cause.safeToDeleteUpload;
}

function cacheGeneratedDraft(
  result: Awaited<ReturnType<typeof requestGeneration>>,
) {
  if (result.persisted) {
    localStorage.removeItem("evolv:draft");
    return;
  }
  localStorage.setItem("evolv:draft", JSON.stringify(result));
}
