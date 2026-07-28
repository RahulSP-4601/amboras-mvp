import { createHmac } from "node:crypto";

export type Variant = "A" | "B";

export function assignVariant(
  secret: string,
  experimentId: string,
  visitorId: string,
  controlBasisPoints = 5_000,
): Variant {
  if (!secret) throw new Error("Assignment secret is required");
  if (controlBasisPoints < 0 || controlBasisPoints > 10_000) {
    throw new Error("Control allocation must be between 0 and 10000");
  }

  const digest = createHmac("sha256", secret)
    .update(`${experimentId}:${visitorId}`)
    .digest();
  const bucket = digest.readUInt32BE(0) % 10_000;
  return bucket < controlBasisPoints ? "A" : "B";
}
