import { NextResponse } from "next/server";

export class LegalReviewError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "LegalReviewError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error: unknown) {
  if (error instanceof LegalReviewError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.status },
    );
  }

  console.error("[LegalCheck] Unhandled backend error", error);

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "The legal review engine hit an unexpected failure.",
      },
    },
    { status: 500 },
  );
}
