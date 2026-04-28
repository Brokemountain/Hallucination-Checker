import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../../../lib/legal-review/errors";
import { scopedActionSchema, parseJsonBody } from "../../../../../lib/legal-review/schema";
import { runSupportReview } from "../../../../../lib/legal-review/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const payload = await parseJsonBody(request, scopedActionSchema);
    const session = await runSupportReview(sessionId, payload);
    return NextResponse.json({ session });
  } catch (error) {
    return toErrorResponse(error);
  }
}

