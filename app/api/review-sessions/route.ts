import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../lib/legal-review/errors";
import { createReviewSession } from "../../../lib/legal-review/service";
import { createReviewSessionSchema, parseJsonBody } from "../../../lib/legal-review/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = await parseJsonBody(request, createReviewSessionSchema);
    const session = await createReviewSession(input);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

