import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../../../lib/legal-review/errors";
import { exportRequestSchema, parseJsonBody } from "../../../../../lib/legal-review/schema";
import { generateExportArtifact } from "../../../../../lib/legal-review/service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const payload = await parseJsonBody(request, exportRequestSchema);
    const result = await generateExportArtifact(sessionId, payload);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

