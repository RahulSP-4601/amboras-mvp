import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { PublicStorefront } from "@/components/store/public-storefront";
import { createDeterministicDraft } from "@/lib/domain/generation";

const config = createDeterministicDraft({
  description: "A durable notebook designed for calm and focused daily work.",
  name: "Focus Book",
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("serializes the initial storefront events", async () => {
  let releaseFirst: ((response: Response) => void) | undefined;
  const firstResponse = new Promise<Response>((resolve) => {
    releaseFirst = resolve;
  });
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(() => firstResponse)
    .mockResolvedValue(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);

  render(
    <PublicStorefront
      config={config}
      product={{
        name: "Focus Book",
        description: "A durable notebook designed for focused daily work.",
        price: 24,
      }}
      slug="focus-book"
    />,
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  releaseFirst?.(new Response("{}", { status: 201 }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  expect(eventType(fetchMock.mock.calls[0]?.[1])).toBe("page_view");
  expect(eventType(fetchMock.mock.calls[1]?.[1])).toBe("product_view");
});

it("does not duplicate initial events under Strict Mode", async () => {
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response("{}", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);

  render(
    <StrictMode>
      <PublicStorefront
        config={config}
        product={{
          name: "Focus Book",
          description: "A durable notebook designed for focused daily work.",
          price: 24,
        }}
        slug="focus-book"
      />
    </StrictMode>,
  );

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
});

it("locks conversion submission and reuses its event ID on retry", async () => {
  const conversionResolvers: Array<(response: Response) => void> = [];
  const fetchMock = vi.fn<typeof fetch>().mockImplementation((_url, init) => {
    if (eventType(init) === "conversion_completed") {
      return new Promise((resolve) => conversionResolvers.push(resolve));
    }
    return Promise.resolve(new Response("{}", { status: 201 }));
  });
  vi.stubGlobal("fetch", fetchMock);
  renderStorefront();

  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getAllByRole("button", { name: config.ctaText })[0]);
  const complete = await screen.findByRole("button", {
    name: "Complete demo conversion",
  });
  await waitFor(() => expect(complete).toBeEnabled());
  fireEvent.click(complete);
  fireEvent.click(complete);
  await waitFor(() => expect(conversionResolvers).toHaveLength(1));
  const firstId = eventId(lastRequest(fetchMock));

  conversionResolvers[0]?.(new Response("{}", { status: 503 }));
  await screen.findByText("The event could not be recorded. Please retry.");
  fireEvent.click(complete);
  await waitFor(() => expect(conversionResolvers).toHaveLength(2));
  expect(eventId(lastRequest(fetchMock))).toBe(firstId);
  conversionResolvers[1]?.(new Response("{}", { status: 201 }));
  await screen.findByText("Thank you for exploring.");
  expect(screen.getByRole("button", { name: "Return to store" })).toHaveFocus();
});

it("traps modal focus, closes on Escape, and restores the CTA", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 201 })),
  );
  renderStorefront();
  const cta = screen.getAllByRole("button", { name: config.ctaText })[0];
  cta?.focus();
  fireEvent.click(cta);

  const cancel = await screen.findByRole("button", { name: "Cancel" });
  const complete = screen.getByRole("button", {
    name: "Complete demo conversion",
  });
  expect(cancel).toHaveFocus();
  await waitFor(() => expect(complete).toBeEnabled());

  fireEvent.keyDown(document, { key: "Tab" });
  expect(complete).toHaveFocus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(cancel).toHaveFocus();
  fireEvent.keyDown(document, { key: "Escape" });

  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(cta).toHaveFocus();
});

function renderStorefront() {
  render(
    <PublicStorefront
      config={config}
      product={{
        name: "Focus Book",
        description: "A durable notebook designed for focused daily work.",
        price: 24,
      }}
      slug="focus-book"
    />,
  );
}

function eventType(init: RequestInit | undefined): string | undefined {
  if (typeof init?.body !== "string") return undefined;
  const value: unknown = JSON.parse(init.body);
  if (!value || typeof value !== "object") return undefined;
  return "eventType" in value && typeof value.eventType === "string"
    ? value.eventType
    : undefined;
}

function eventId(call: Parameters<typeof fetch>): string | undefined {
  const init = call[1];
  if (typeof init?.body !== "string") return undefined;
  const value: unknown = JSON.parse(init.body);
  if (!value || typeof value !== "object") return undefined;
  return "eventId" in value && typeof value.eventId === "string"
    ? value.eventId
    : undefined;
}

function lastRequest(mock: ReturnType<typeof vi.fn<typeof fetch>>) {
  return mock.mock.calls.at(-1) as Parameters<typeof fetch>;
}
