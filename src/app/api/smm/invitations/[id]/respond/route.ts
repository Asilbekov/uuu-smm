// POST /api/smm/invitations/[id]/respond — the SPECIALIST accepts / declines
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmRespondSchema } from "@/server/schemas";
import { respondInvitation } from "@/server/services/smm.service";

export const POST = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmRespondSchema);
    return NextResponse.json(await respondInvitation(params.id, userId, body.action));
  },
  { rateLimit: "testWrite" }
);
