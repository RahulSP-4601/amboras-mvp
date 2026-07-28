import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreBuilder } from "@/components/store/store-builder";
import { createDeterministicDraft } from "@/lib/domain/generation";
import { fetchProposal, requestDraft } from "@/lib/stores/builder-client";
import type {
  DraftRecord,
  StoreVersionSummary,
} from "@/lib/domain/store-workspace";

const currentConfig = createDeterministicDraft({
  description: "A durable notebook designed for calm and focused daily work.",
  name: "Focus Book",
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("AI store builder controls", () => {
  it("discards or applies an AI proposal explicitly", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          proposal: {
            summary: "Clarify the headline",
            rationale: "Make the product focus clearer.",
            changes: [{ field: "heroHeadline", value: "A clearer focus." }],
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<StoreBuilder initialDraft={localDraft()} />);

    requestProposal();
    await screen.findByText("Clarify the headline");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Headline")).toHaveValue(
      currentConfig.heroHeadline,
    );

    requestProposal();
    await screen.findByText("Clarify the headline");
    fireEvent.click(screen.getByRole("button", { name: "Apply as draft" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Headline")).toHaveValue("A clearer focus."),
    );
  });

  it("locks manual fields while an AI request is pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    const response = new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockReturnValue(response));
    render(<StoreBuilder initialDraft={localDraft()} />);

    requestProposal();
    await waitFor(() =>
      expect(screen.getByLabelText("Headline")).toBeDisabled(),
    );
    resolveRequest?.(jsonResponse(proposalResponse()));
    await screen.findByText("Clarify the headline");
    expect(screen.getByLabelText("Headline")).toBeEnabled();
  });
});

it("reuses proposal idempotency after an ambiguous failure", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("Connection lost"))
    .mockResolvedValue(jsonResponse(proposalResponse()));
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    fetchProposal(currentConfig, "Make the headline clearer"),
  ).rejects.toThrow("Connection lost");
  await fetchProposal(currentConfig, "Make the headline clearer");
  expect(idempotencyKey(fetchMock.mock.calls[0])).toBe(
    idempotencyKey(fetchMock.mock.calls[1]),
  );

  await fetchProposal(currentConfig, "Make the headline clearer");
  expect(idempotencyKey(fetchMock.mock.calls[2])).not.toBe(
    idempotencyKey(fetchMock.mock.calls[1]),
  );
});

it("rotates proposal idempotency after a terminal failure", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("{}", { status: 422 }))
    .mockResolvedValueOnce(jsonResponse(proposalResponse()));
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    fetchProposal(currentConfig, "Make the headline clearer"),
  ).rejects.toThrow("Proposal failed");
  await fetchProposal(currentConfig, "Make the headline clearer");

  expect(idempotencyKey(fetchMock.mock.calls[0])).not.toBe(
    idempotencyKey(fetchMock.mock.calls[1]),
  );
});

it("reuses a draft mutation key after a transport failure", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockRejectedValueOnce(new TypeError("Connection lost"))
    .mockResolvedValue(
      jsonResponse(
        versionMutation(
          "9361c3cb-c33d-40b5-8649-49a761be9c3a",
          3,
          currentConfig,
        ),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    requestDraft(persistedDraft(), currentConfig, "manual_edit"),
  ).rejects.toThrow("Connection lost");
  await requestDraft(persistedDraft(), currentConfig, "manual_edit");

  expect(idempotencyKey(fetchMock.mock.calls[0])).toBe(
    idempotencyKey(fetchMock.mock.calls[1]),
  );
});

it("reuses a draft mutation key after an ambiguous server failure", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("{}", { status: 503 }))
    .mockResolvedValue(
      jsonResponse(
        versionMutation(
          "9361c3cb-c33d-40b5-8649-49a761be9c3a",
          3,
          currentConfig,
        ),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);

  await expect(
    requestDraft(persistedDraft(), currentConfig, "manual_edit"),
  ).rejects.toThrow("Version request failed");
  await requestDraft(persistedDraft(), currentConfig, "manual_edit");

  expect(idempotencyKey(fetchMock.mock.calls[0])).toBe(
    idempotencyKey(fetchMock.mock.calls[1]),
  );
});

describe("version history controls", () => {
  it("creates a rollback draft from version history", async () => {
    const rollbackConfig = { ...currentConfig, heroHeadline: "Earlier copy." };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(() =>
        Promise.resolve(
          jsonResponse(versionMutation("rollback-version", 3, rollbackConfig)),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <StoreBuilder
        initialDraft={persistedDraft()}
        initialVersions={versionHistory()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Headline")).toHaveValue("Earlier copy."),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/store/rollback",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

it("switches between draft and published preview data", () => {
  render(
    <StoreBuilder
      initialDraft={persistedDraft()}
      initialPublishedConfig={{
        ...currentConfig,
        heroHeadline: "Published headline.",
      }}
      initialVersions={versionHistory()}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "Published" }));
  expect(
    screen.getByRole("heading", {
      level: 1,
      name: "Published headline.",
    }),
  ).toBeVisible();
});

it("initializes the builder from a published current version", () => {
  render(
    <StoreBuilder
      initialDraft={persistedDraft()}
      initialPublishedConfig={currentConfig}
      initialVersions={versionHistory()}
    />,
  );

  expect(
    screen.getByText("Published", { selector: ".status-pill" }),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Published" })).toHaveClass(
    "active",
  );
});

it("does not expose a browser draft when local fallback is disabled", () => {
  localStorage.setItem("evolv:draft", JSON.stringify(localDraft()));
  render(<StoreBuilder allowLocalDraft={false} />);

  expect(
    screen.getByRole("heading", { name: "No draft store yet" }),
  ).toBeVisible();
});

it("hydrates an explicitly allowed local preview after mount", async () => {
  localStorage.setItem("evolv:draft", JSON.stringify(localDraft()));
  render(<StoreBuilder allowLocalDraft />);

  expect(
    await screen.findByRole("heading", {
      level: 1,
      name: currentConfig.heroHeadline,
    }),
  ).toBeVisible();
});

it("retries publishing the draft that was already saved", async () => {
  const editedConfig = { ...currentConfig, heroHeadline: "Edited headline." };
  const createdId = "9361c3cb-c33d-40b5-8649-49a761be9c3a";
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      jsonResponse(versionMutation(createdId, 3, editedConfig)),
    )
    .mockResolvedValueOnce(new Response("{}", { status: 503 }))
    .mockResolvedValueOnce(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <StoreBuilder
      initialDraft={persistedDraft()}
      initialVersions={versionHistory()}
    />,
  );

  fireEvent.change(screen.getByLabelText("Headline"), {
    target: { value: editedConfig.heroHeadline },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await screen.findByText("Publish failed");
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

  expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/store/draft");
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/store/publish");
  expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/store/publish");
  expect(requestBody(fetchMock.mock.calls[2])).toMatchObject({
    versionId: createdId,
  });
});

it("archives a superseded draft in local version history", async () => {
  const editedConfig = { ...currentConfig, heroHeadline: "Next headline." };
  const createdId = "9361c3cb-c33d-40b5-8649-49a761be9c3a";
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse(versionMutation(createdId, 3, editedConfig)),
      )
      .mockResolvedValueOnce(new Response("{}", { status: 200 })),
  );
  render(
    <StoreBuilder
      initialDraft={persistedDraft()}
      initialVersions={[
        version("d63a3e31-c396-4e23-bb4f-d27d0f4d8805", 2, "draft"),
      ]}
    />,
  );

  fireEvent.change(screen.getByLabelText("Headline"), {
    target: { value: editedConfig.heroHeadline },
  });
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await screen.findByText("Published");

  expect(screen.getByText("v2").closest(".version-row")).toHaveTextContent(
    "archived",
  );
});

it("disables publishing while manually edited fields are invalid", () => {
  render(<StoreBuilder initialDraft={localDraft()} />);
  const cta = screen.getByLabelText("Button text");
  const publish = screen.getByRole("button", { name: "Publish" });

  fireEvent.change(cta, { target: { value: "" } });
  expect(publish).toBeDisabled();
  expect(screen.getByText("Review highlighted fields")).toBeVisible();

  fireEvent.change(cta, { target: { value: "x".repeat(41) } });
  expect(publish).toBeDisabled();
  fireEvent.change(cta, { target: { value: "x".repeat(40) } });
  expect(publish).toBeEnabled();
});

function requestProposal() {
  fireEvent.change(
    screen.getByPlaceholderText("Example: make the headline more direct"),
    { target: { value: "Make the headline clearer" } },
  );
  fireEvent.click(screen.getByRole("button", { name: "Propose change" }));
}

function localDraft(): DraftRecord {
  return {
    config: currentConfig,
    product: {
      name: "Focus Book",
      description:
        "A durable notebook designed for calm and focused daily work.",
    },
    generatedAt: "2026-07-28T12:00:00.000Z",
  };
}

function persistedDraft(): DraftRecord {
  return {
    ...localDraft(),
    persisted: {
      storeId: "048c6691-5a11-4b32-b8e0-5c8ea31ce5df",
      versionId: "d63a3e31-c396-4e23-bb4f-d27d0f4d8805",
      slug: "focus-book",
    },
  };
}

function versionHistory(): StoreVersionSummary[] {
  return [
    version("d63a3e31-c396-4e23-bb4f-d27d0f4d8805", 2, "published"),
    version("e64d150a-c5ea-43db-819e-74213fbfeae8", 1, "archived"),
  ];
}

function version(
  id: string,
  versionNumber: number,
  status: StoreVersionSummary["status"],
): StoreVersionSummary {
  return {
    id,
    versionNumber,
    status,
    source: "manual_edit",
    parentVersionId: null,
    createdAt: "2026-07-28T12:00:00.000Z",
  };
}

function versionMutation(
  idLabel: string,
  versionNumber: number,
  config: typeof currentConfig,
) {
  return {
    ...version(
      idLabel === "rollback-version"
        ? "22ef651f-46e7-471f-b746-d25a0032a752"
        : idLabel,
      versionNumber,
      "draft",
    ),
    source: "rollback",
    config,
  };
}

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    status: 201,
    json: () => Promise.resolve(value),
  } as Response;
}

function proposalResponse() {
  return {
    proposal: {
      summary: "Clarify the headline",
      rationale: "Make the product focus clearer.",
      changes: [{ field: "heroHeadline", value: "A clearer focus." }],
    },
  };
}

function idempotencyKey(
  call: Parameters<typeof fetch> | undefined,
): string | null {
  return new Headers(call?.[1]?.headers).get("Idempotency-Key");
}

function requestBody(
  call: Parameters<typeof fetch> | undefined,
): Record<string, unknown> {
  const body = call?.[1]?.body;
  return typeof body === "string"
    ? (JSON.parse(body) as Record<string, unknown>)
    : {};
}
