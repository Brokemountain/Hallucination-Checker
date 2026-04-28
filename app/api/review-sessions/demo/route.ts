import { NextResponse } from "next/server";

import { toErrorResponse } from "../../../../lib/legal-review/errors";
import { getOrCreateDemoSession } from "../../../../lib/legal-review/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getOrCreateDemoSession();
    return NextResponse.json({ session });
  } catch (error) {
    return toErrorResponse(error);
  }
}

