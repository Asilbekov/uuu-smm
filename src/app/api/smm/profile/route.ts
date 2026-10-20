// GET /api/smm/profile — my SMM profile (role + specialist анкета)
// PUT /api/smm/profile — update the role / анкета fields
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmProfileSchema } from "@/server/schemas";
import { getSmmProfile, updateSmmProfile } from "@/server/services/smm.service";

export const GET = withApiAuth(async ({ userId }) => {
  return NextResponse.json(await getSmmProfile(userId));
});

export const PUT = withApiAuth(
  async ({ userId, req }) => {
    const body = await parseBody(req, smmProfileSchema);
    return NextResponse.json(await updateSmmProfile(userId, body));
  },
  { rateLimit: "testWrite" }
);
