"use client";

import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import type { Product } from "@/lib/domain/product";
import type { StoreConfig } from "@/lib/domain/store-config";
import { Storefront } from "@/components/store/storefront";

export function PublicStorefront(props: {
  slug: string;
  config: StoreConfig;
  product: Pick<Product, "name" | "description" | "price" | "imageUrl">;
}) {
  const conversion = useConversionJourney(props.slug);
  const dialogRef = useDialogFocus(
    conversion.modal,
    conversion.complete,
    conversion.close,
  );
  useStoreTracking(props.slug);

  return (
    <>
      <Storefront
        config={props.config}
        onCta={conversion.open}
        product={props.product}
      />
      {conversion.modal ? (
        <div className="demo-modal-backdrop" role="presentation">
          <section
            aria-labelledby="demo-title"
            aria-modal="true"
            className="demo-modal"
            ref={dialogRef}
            role="dialog"
          >
            {conversion.complete ? (
              <DemoSuccess close={conversion.close} />
            ) : (
              <DemoConfirmation
                close={conversion.close}
                complete={conversion.finish}
                error={conversion.error}
                pending={conversion.pending}
                ready={conversion.ready}
              />
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

function useDialogFocus(
  active: boolean,
  contentChanged: boolean,
  close: () => void,
) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef(close);
  const restoreRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    closeRef.current = close;
  }, [close]);
  useEffect(() => {
    if (!active || !dialogRef.current) return;
    const dialog = dialogRef.current;
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    focusableElements(dialog)[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      handleDialogKey(event, dialog, closeRef.current);
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      restoreRef.current?.focus();
    };
  }, [active, contentChanged]);
  return dialogRef;
}

function handleDialogKey(
  event: KeyboardEvent,
  dialog: HTMLElement,
  close: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== "Tab") return;
  const elements = focusableElements(dialog);
  if (elements.length === 0) return;
  const first = elements[0];
  const last = elements.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

function focusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function DemoConfirmation(props: {
  close: () => void;
  complete: () => Promise<void>;
  error: string;
  pending: boolean;
  ready: boolean;
}) {
  return (
    <>
      <span>DEMONSTRATION ONLY</span>
      <h2 id="demo-title">Complete demo conversion?</h2>
      <p>
        Demo conversion — no payment will be processed. We do not request
        payment or personal information and no order will be created.
      </p>
      <button
        className="demo-primary"
        disabled={props.pending || !props.ready}
        onClick={() => void props.complete()}
        type="button"
      >
        {props.pending
          ? "Recording demo conversion…"
          : "Complete demo conversion"}
      </button>
      {props.error ? (
        <p aria-live="polite" className="demo-error">
          {props.error}
        </p>
      ) : null}
      <button onClick={props.close} type="button">
        Cancel
      </button>
    </>
  );
}

function DemoSuccess({ close }: { close: () => void }) {
  return (
    <>
      <span>DEMO EVENT RECORDED</span>
      <h2 id="demo-title">Thank you for exploring.</h2>
      <p>No money moved and no order was created.</p>
      <button className="demo-primary" onClick={close} type="button">
        Return to store
      </button>
    </>
  );
}

async function track(
  slug: string,
  eventType: string,
  eventId = crypto.randomUUID(),
) {
  const response = await fetch(`/api/events/${encodeURIComponent(slug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, eventType }),
    keepalive: true,
  });
  if (!response.ok) throw new Error("Event could not be recorded");
}

function useStoreTracking(slug: string) {
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (trackedSlug.current !== slug) {
      trackedSlug.current = slug;
      void trackSequence(
        slug,
        trackedRequests(["page_view", "product_view"]),
      ).catch(() => undefined);
    }
    let sent = false;
    const onScroll = () => {
      const available =
        document.documentElement.scrollHeight - window.innerHeight;
      if (!sent && available > 0 && window.scrollY / available >= 0.5) {
        sent = true;
        void track(slug, "scroll_50").catch(() => undefined);
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [slug]);
}

interface TrackRequest {
  eventId: string;
  eventType: string;
}

async function trackSequence(slug: string, requests: TrackRequest[]) {
  for (const request of requests) {
    await track(slug, request.eventType, request.eventId);
  }
}

function trackedRequests(eventTypes: string[]): TrackRequest[] {
  return eventTypes.map((eventType) => ({
    eventId: crypto.randomUUID(),
    eventType,
  }));
}

function useConversionJourney(slug: string) {
  const [state, setState] = useState(conversionState());
  const openLock = useRef(false);
  const finishLock = useRef(false);
  const conversionId = useRef<string | null>(null);
  const journeyToken = useRef(0);

  function open() {
    if (openLock.current) return;
    openLock.current = true;
    const token = ++journeyToken.current;
    setState({ ...conversionState(), modal: true });
    void trackSequence(
      slug,
      trackedRequests(["cta_click", "checkout_started"]),
    ).then(
      () => updateJourney(journeyToken, token, setState, { ready: true }),
      () =>
        updateJourney(journeyToken, token, setState, {
          error: "The demo could not be started. Close and retry.",
        }),
    );
  }

  function close() {
    resetJourney(journeyToken, openLock, finishLock, conversionId, setState);
  }

  async function finish() {
    if (finishLock.current || !state.ready) return;
    finishLock.current = true;
    const token = journeyToken.current;
    conversionId.current ||= crypto.randomUUID();
    const eventId = conversionId.current;
    setState((current) => ({ ...current, error: "", pending: true }));
    try {
      await track(slug, "conversion_completed", eventId);
      updateJourney(journeyToken, token, setState, {
        complete: true,
        pending: false,
      });
    } catch {
      if (journeyToken.current !== token) return;
      finishLock.current = false;
      updateJourney(journeyToken, token, setState, {
        error: "The event could not be recorded. Please retry.",
        pending: false,
      });
    }
  }

  return { ...state, close, finish, open };
}

function resetJourney(
  journeyToken: MutableRefObject<number>,
  openLock: MutableRefObject<boolean>,
  finishLock: MutableRefObject<boolean>,
  conversionId: MutableRefObject<string | null>,
  setState: Dispatch<SetStateAction<ReturnType<typeof conversionState>>>,
) {
  journeyToken.current += 1;
  openLock.current = false;
  finishLock.current = false;
  conversionId.current = null;
  setState(conversionState());
}

function conversionState() {
  return {
    complete: false,
    error: "",
    modal: false,
    pending: false,
    ready: false,
  };
}

function updateJourney(
  tokenRef: MutableRefObject<number>,
  token: number,
  setState: Dispatch<SetStateAction<ReturnType<typeof conversionState>>>,
  update: Partial<ReturnType<typeof conversionState>>,
) {
  if (tokenRef.current !== token) return;
  setState((current) => ({ ...current, ...update }));
}
