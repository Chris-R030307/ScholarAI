import { NextResponse } from "next/server";
import { isLlmAdminDisabled } from "@/lib/llm-admin";

/**
 * Public read of non-secret feature flags for the client (no keys exposed).
 * Safe to call without auth; does not reveal whether API keys exist.
 */
export async function GET() {
  return NextResponse.json({
    llmEnabled: !isLlmAdminDisabled(),
  });
}
