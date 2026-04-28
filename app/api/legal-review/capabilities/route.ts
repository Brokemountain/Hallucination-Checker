import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../../lib/legal-review/errors";
import { getCapabilities } from "../../../../lib/legal-review/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(getCapabilities());
  } catch (error) {
    return toErrorResponse(error);
  }
}

