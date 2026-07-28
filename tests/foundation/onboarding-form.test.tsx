import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createDeterministicDraft } from "@/lib/domain/generation";

const onboardingMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getPublicUrl: vi.fn(),
  push: vi.fn(),
  remove: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: onboardingMocks.push }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: { getUser: onboardingMocks.getUser },
    storage: {
      from: () => ({
        getPublicUrl: onboardingMocks.getPublicUrl,
        remove: onboardingMocks.remove,
        upload: onboardingMocks.upload,
      }),
    },
  }),
}));

import { OnboardingForm } from "@/components/onboarding/onboarding-form";

const ownerA = "048c6691-5a11-4b32-b8e0-5c8ea31ce5df";
const ownerB = "2b8ed650-6db4-4fcc-b54d-4f7556e0625d";

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("onboarding generation retries", () => {
  it("reuses the exact payload and uploaded image after ambiguity", async () => {
    prepareUpload();
    installFileAwareFormData();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Connection lost"))
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal("fetch", fetchMock);
    render(<OnboardingForm ownerScope={ownerA} />);

    fillProductForm();
    fireEvent.click(screen.getByRole("button", { name: /generate my store/i }));
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(onboardingMocks.push).toHaveBeenCalled());
    const requests = fetchMock.mock.calls.filter(
      (call) => call[1]?.method === "POST",
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]?.[1]?.body).toBe(requests[1]?.[1]?.body);
    expect(requestKey(requests[0])).toBe(requestKey(requests[1]));
    expect(onboardingMocks.upload).toHaveBeenCalledTimes(1);
    expect(onboardingMocks.remove).not.toHaveBeenCalled();
  });

  it("restores the exact retry after the component remounts", async () => {
    prepareUpload();
    installFileAwareFormData();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("Connection lost"))
      .mockResolvedValueOnce(generationResponse());
    vi.stubGlobal("fetch", fetchMock);
    const firstRender = render(<OnboardingForm ownerScope={ownerA} />);

    fillProductForm();
    fireEvent.click(screen.getByRole("button", { name: /generate my store/i }));
    await screen.findByRole("button", { name: /retry/i });
    firstRender.unmount();

    render(<OnboardingForm ownerScope={ownerA} />);
    fireEvent.click(await screen.findByRole("button", { name: /retry/i }));

    await waitFor(() => expect(onboardingMocks.push).toHaveBeenCalled());
    const requests = fetchMock.mock.calls.filter(
      (call) => call[1]?.method === "POST",
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]?.[1]?.body).toBe(requests[1]?.[1]?.body);
    expect(requestKey(requests[0])).toBe(requestKey(requests[1]));
    expect(onboardingMocks.upload).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem("evolv:generation-attempt")).toBeNull();
  });
});

describe("onboarding generation account boundaries", () => {
  it("does not restore another account's pending generation", async () => {
    prepareUpload();
    installFileAwareFormData();
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Connection lost")),
    );
    const firstRender = render(<OnboardingForm ownerScope={ownerA} />);

    fillProductForm();
    fireEvent.click(screen.getByRole("button", { name: /generate my store/i }));
    await screen.findByRole("button", { name: /retry/i });
    firstRender.unmount();

    render(<OnboardingForm ownerScope={ownerB} />);

    expect(
      screen.getByRole("button", { name: /generate my store/i }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    await waitFor(() =>
      expect(sessionStorage.getItem("evolv:generation-attempt")).toBeNull(),
    );
  });
});

function prepareUpload() {
  onboardingMocks.getUser.mockResolvedValue({
    data: { user: { id: ownerA } },
  });
  onboardingMocks.upload.mockResolvedValue({ error: null });
  onboardingMocks.getPublicUrl.mockReturnValue({
    data: { publicUrl: "https://images.example/product.jpg" },
  });
}

function installFileAwareFormData() {
  const NativeFormData = FormData;
  class FileAwareFormData extends NativeFormData {
    constructor(form?: HTMLFormElement) {
      super(form);
      const input = form?.elements.namedItem("image");
      if (input instanceof HTMLInputElement && input.files?.[0]) {
        this.set("image", input.files[0]);
      }
    }
  }
  vi.stubGlobal("FormData", FileAwareFormData);
}

function fillProductForm() {
  fireEvent.change(screen.getByRole("textbox", { name: /what do you want/i }), {
    target: {
      value: "A durable notebook designed for calm and focused daily work.",
    },
  });
  fireEvent.change(screen.getByLabelText("Product image"), {
    target: {
      files: [new File(["image"], "notebook.jpg", { type: "image/jpeg" })],
    },
  });
}

function generationResponse(): Response {
  const config = createDeterministicDraft({
    description: "A durable notebook designed for calm and focused daily work.",
  });
  return new Response(
    JSON.stringify({ config, mode: "openai", persisted: null }),
    { status: 201 },
  );
}

function requestKey(call: Parameters<typeof fetch> | undefined) {
  return new Headers(call?.[1]?.headers).get("Idempotency-Key");
}
