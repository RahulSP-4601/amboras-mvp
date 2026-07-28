const TERMINAL_STATUSES = [400, 401, 403, 404, 422];
const TERMINAL_CODES = ["key_conflict", "store_exists"];

export function generationFailureIsTerminal(
  status: number,
  code: string | undefined,
) {
  return (
    TERMINAL_STATUSES.includes(status) || TERMINAL_CODES.includes(code ?? "")
  );
}
