import { AI_CHAT_RATE_LIMIT_MS, AI_RATE_LIMIT_MS } from "@/lib/ai/constants";

export type AiThrottleChannel = "analyze" | "chat" | "searchPlan";

const lastOk = new Map<string, number>();

function storageKey(clientKey: string, channel: AiThrottleChannel): string {
  return `${channel}:${clientKey}`;
}

function intervalMs(channel: AiThrottleChannel): number {
  if (channel === "chat") return AI_CHAT_RATE_LIMIT_MS;
  return AI_RATE_LIMIT_MS;
}

/**
 * Returns true if the client should be throttled (too soon since last OK).
 * Call `recordClientOk` only after a successful completion.
 */
export function shouldThrottleClient(
  clientKey: string,
  channel: AiThrottleChannel = "analyze",
  now = Date.now(),
): boolean {
  const k = storageKey(clientKey, channel);
  const prev = lastOk.get(k);
  if (prev == null) return false;
  return now - prev < intervalMs(channel);
}

export function recordClientOk(
  clientKey: string,
  channel: AiThrottleChannel = "analyze",
  now = Date.now(),
): void {
  const k = storageKey(clientKey, channel);
  lastOk.set(k, now);
  if (lastOk.size > 5000) {
    const cutoff = now - Math.max(AI_RATE_LIMIT_MS, AI_CHAT_RATE_LIMIT_MS) * 4;
    for (const [key, t] of lastOk) {
      if (t < cutoff) lastOk.delete(key);
    }
  }
}
