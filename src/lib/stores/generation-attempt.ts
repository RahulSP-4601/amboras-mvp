"use client";

import {
  generationAttemptSchema,
  generationOwnerScopeSchema,
  generationRecordSchema,
  type GenerationAttempt,
  type GenerationOwnerScope,
  type GenerationRecord,
} from "@/lib/domain/generation-attempt";

const STORAGE_KEY = "evolv:generation-attempt";
const LEGACY_KEY = "evolv:generation-key";

let cachedRaw: string | null | undefined;
let cachedRecord: GenerationRecord | null = null;
const listeners = new Set<() => void>();

export function getGenerationAttemptSnapshot(): GenerationRecord | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedRecord;
  const record = parseRecord(raw);
  cachedRaw = raw;
  cachedRecord = record;
  return cachedRecord;
}

export function subscribeToGenerationAttempt(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function persistGenerationAttempt(
  attempt: GenerationAttempt,
  ownerScope: GenerationOwnerScope,
): string {
  const validated = generationAttemptSchema.parse(attempt);
  const validatedScope = generationOwnerScopeSchema.parse(ownerScope);
  const existing = readRecord();
  if (
    existing?.ownerScope === validatedScope &&
    attemptsMatch(existing.attempt, validated)
  ) {
    return existing.key;
  }
  const record = generationRecordSchema.parse({
    attempt: validated,
    key: crypto.randomUUID(),
    ownerScope: validatedScope,
  });
  const serialized = JSON.stringify(record);
  window.sessionStorage.setItem(STORAGE_KEY, serialized);
  window.sessionStorage.removeItem(LEGACY_KEY);
  updateCache(serialized, record);
  return record.key;
}

export function clearGenerationAttempt() {
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_KEY);
  updateCache(null, null);
}

function readRecord() {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  const record = parseRecord(raw);
  if (!record && raw) {
    window.sessionStorage.removeItem(STORAGE_KEY);
    updateCache(null, null);
  }
  return record;
}

function parseRecord(raw: string | null) {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const result = generationRecordSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function attemptsMatch(left: GenerationAttempt, right: GenerationAttempt) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function updateCache(raw: string | null, record: GenerationRecord | null) {
  cachedRaw = raw;
  cachedRecord = record;
  listeners.forEach((listener) => listener());
}
