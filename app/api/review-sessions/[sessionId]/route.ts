import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../../lib/legal-review/errors";
import { getReviewSession } from "../../../../lib/legal-review/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const session = await getReviewSession(sessionId);
    return NextResponse.json({ session });
  } catch (error) {
    return toErrorResponse(error);
  }
}

