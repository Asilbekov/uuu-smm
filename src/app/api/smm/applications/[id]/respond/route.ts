// POST /api/smm/applications/[id]/respond — the CUSTOMER accepts / declines
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmRespondSchema } from "@/server/schemas";
import { respondApplication } from "@/server/services/smm.service";

export const POST = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmRespondSchema);
    return NextResponse.json(await respondApplication(params.id, userId, body.action));
  },
  { rateLimit: "testWrite" }
);
