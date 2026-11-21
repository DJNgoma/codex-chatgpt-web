export interface ChatGptWebAdapterErrorOptions {
  status: number;
  errorType: string;
  code: string;
  retryable: boolean;
  cause?: unknown;
}

export class ChatGptWebAdapterError extends Error {
  readonly status: number;
  readonly errorType: string;
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: ChatGptWebAdapterErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ChatGptWebAdapterError";
    this.status = options.status;
    this.errorType = options.errorType;
    this.code = options.code;
    this.retryable = options.retryable;
  }
}

export function chatGptToolTimeoutError(tool: string, timeoutMs: number): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    `Codex tool ${tool} did not return a result within ${timeoutMs / 1_000} seconds. `
    + "The turn was stopped. Check whether the command is still running or waiting for approval before retrying.",
    { status: 504, errorType: "server_error", code: "codex_tool_timeout", retryable: false },
  );
}

export function chatGptResponseIncompleteError(message: string): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(message, {
    status: 502, errorType: "server_error", code: "chatgpt_response_incomplete", retryable: false,
  });
}

export function chatGptToolApprovalRequiredError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "ChatGPT is waiting for plugin permission. Open the plugin's settings in ChatGPT, "
    + 'then Permissions → Allow all actions, and retry this turn.',
    { status: 403, errorType: "permission_error", code: "chatgpt_tool_approval_required", retryable: false },
  );
}

// Only the compaction owner may signal this after the broker accepts its one-shot handoff.
// It cancels browser observation, while the accepted summary remains the native result.
export class ChatGptCompactionHandoffAccepted extends DOMException {
  constructor() {
    super("Structured compaction handoff accepted", "AbortError");
  }
}

export function chatGptBrowserTabClosedError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "The ChatGPT browser tab was closed, so the Codex turn was cancelled.",
    {
      status: 499,
      errorType: "client_closed_request",
      code: "client_cancelled",
      retryable: false,
    },
  );
}

export function chatGptTurnSupersededError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "A newer Codex instruction superseded this ChatGPT response.",
    { status: 499, errorType: "client_closed_request", code: "client_cancelled", retryable: false },
  );
}

export function chatGptStoppedThinkingError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "ChatGPT displayed 'Stopped thinking' and could not continue this response. "
    + "A ChatGPT Web usage limit may have been reached. Check the ChatGPT tab for the exact reason before retrying.",
    {
      status: 502,
      errorType: "server_error",
      code: "chatgpt_stopped_thinking",
      retryable: false,
    },
  );
}

export function chatGptRetainedConversationUnavailableError(): ChatGptWebAdapterError {
  return new ChatGptWebAdapterError(
    "The retained ChatGPT conversation is no longer available.",
    {
      status: 409,
      errorType: "invalid_request_error",
      code: "compaction_source_unavailable",
      retryable: false,
    },
  );
}

// An abort says the turn stopped; `signal.reason` says why. Every abort path used to throw a fresh
// AbortError and drop the reason, so a turn retired by the Codex side and a turn ChatGPT really
// abandoned arrived at the reporter identically — and the one message they shared blamed ChatGPT.
const CHATGPT_TURN_RETIRED = Symbol.for("codex-chatgpt-web.chatgpt-turn-retired");

/** Mark the error that ends a turn because its Codex-side binding went away. */
export function chatGptTurnRetiredError(message: string, options?: { cause?: unknown }): Error {
  const error = new Error(message, options?.cause === undefined ? undefined : { cause: options.cause });
  Object.defineProperty(error, CHATGPT_TURN_RETIRED, { value: true });
  return error;
}

/** True when this error, or anything it was caused by, is a Codex-side turn retirement. */
export function isChatGptTurnRetired(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    if ((current as Record<symbol, unknown>)[CHATGPT_TURN_RETIRED] === true) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * The abort error for a turn, carrying `signal.reason` so the reason survives to the reporter.
 * DOMException takes no cause option, so it is attached without disturbing the AbortError name
 * that the abort contract depends on.
 */
export function chatGptTurnAbortError(signal?: AbortSignal): DOMException {
  const error = new DOMException("ChatGPT web turn aborted", "AbortError");
  const reason: unknown = signal?.reason;
  if (reason !== undefined && reason !== null && reason !== error) {
    Object.defineProperty(error, "cause", { value: reason, configurable: true, writable: true });
  }
  return error;
}

/**
 * A safe, bounded description of why a turn failed, for the runtime log.
 *
 * Codex is told that ChatGPT stopped responding whenever a submitted turn fails, whatever the
 * reason was. The reason itself is an internal message, never request text, but it is still kept
 * to one bounded line so it cannot flood the log or imitate another entry. This must not throw:
 * diagnostics are a side channel and cannot be allowed to take the turn down.
 */
export function chatGptFailureCauseEvidence(error: unknown): { causeName: string; causeMessage: string; causeDepth: number } {
  const field = (read: () => unknown, fallback: string): string => {
    try {
      const value = read();
      return typeof value === "string" ? value : fallback;
    } catch {
      return fallback;
    }
  };
  let current: unknown = error;
  let depth = 0;
  const seen = new Set<unknown>();
  // Follow the cause chain to its origin; wrappers only restate the generic outcome.
  for (;;) {
    if (current === null || typeof current !== "object" || seen.has(current)) break;
    seen.add(current);
    let next: unknown;
    try { next = (current as { cause?: unknown }).cause; } catch { break; }
    if (next === undefined || next === null || seen.has(next)) break;
    current = next;
    depth += 1;
  }
  const isObject = current !== null && typeof current === "object";
  const causeName = isObject
    ? field(() => (current as { name?: unknown }).name, "Error")
    : current === null ? "null" : typeof current;
  const rawMessage = isObject
    ? field(() => (current as { message?: unknown }).message, "")
    : typeof current === "string" ? current : "";
  const causeMessage = rawMessage.replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, 240);
  return { causeName: causeName.replace(/[\u0000-\u001f\u007f]+/g, " ").slice(0, 80), causeMessage, causeDepth: depth };
}
