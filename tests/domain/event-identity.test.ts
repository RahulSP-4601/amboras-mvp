import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  eventSessionCookieNames,
  resolveEventIdentity,
} from "@/lib/events/identity";

const visitorId = "4e87c174-57a9-4a27-b195-17ca144c0c50";
const sessionId = "64bdd614-79b7-4368-838f-13ec17980724";
const now = Date.parse("2026-07-28T12:00:00.000Z");

describe("public event identity", () => {
  it("retains identity for the same store", () => {
    const names = eventSessionCookieNames("alpha-store");
    const request = requestWithCookies([
      `evolv_visitor=${visitorId}`,
      `${names.session}=${sessionId}`,
      `${names.seen}=${now}`,
    ]);

    expect(resolveEventIdentity(request, "alpha-store", now)).toEqual({
      visitorId,
      sessionId,
    });
  });

  it("uses a distinct session for another store", () => {
    const names = eventSessionCookieNames("alpha-store");
    const request = requestWithCookies([
      `evolv_visitor=${visitorId}`,
      `${names.session}=${sessionId}`,
      `${names.seen}=${now}`,
    ]);
    const identity = resolveEventIdentity(request, "beta-store", now);

    expect(identity.visitorId).toBe(visitorId);
    expect(identity.sessionId).not.toBe(sessionId);
  });
});

function requestWithCookies(values: string[]) {
  return new NextRequest("https://evolv.example/s/alpha-store", {
    headers: { cookie: values.join("; ") },
  });
}
