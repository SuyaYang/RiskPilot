import { NextResponse } from "next/server";
import { CheckoutError } from "./checkout";
export function apiError(error: unknown) {
  const known = error instanceof CheckoutError;
  return NextResponse.json({
    error: known ? error.message : "Request could not be saved. Please retry.",
    code: known ? error.code : "INTERNAL_ERROR", retryable: !known || error.status >= 500 || error.status === 202,
    trace_id: crypto.randomUUID(),
  }, { status: known ? error.status : 503 });
}
