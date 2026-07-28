export interface StoredEventContext {
  storeId: string;
  visitorId: string;
  sessionId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  synthetic: boolean;
}

export function isMatchingEventReplay(
  stored: StoredEventContext,
  candidate: StoredEventContext,
) {
  return (
    stored.storeId === candidate.storeId &&
    stored.visitorId === candidate.visitorId &&
    stored.sessionId === candidate.sessionId &&
    stored.eventType === candidate.eventType &&
    stored.synthetic === candidate.synthetic &&
    canonicalMetadata(stored.metadata) === canonicalMetadata(candidate.metadata)
  );
}

function canonicalMetadata(value: Record<string, unknown>) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  );
}
