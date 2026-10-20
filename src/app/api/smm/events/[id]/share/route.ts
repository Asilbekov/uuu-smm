// POST /api/smm/events/[id]/share { scope: 'link' | 'community' } — the
// event's analogue of the tests' share endpoint: "link" copies through,
// "community" flips isPublic (owner-only) so the event joins or leaves the
// general events library (the discover feed).
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmEventShareSchema } from "@/server/schemas";
import { shareEvent } from "@/server/services/smm.service";

export const POST = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmEventShareSchema);
    const result = await shareEvent(userId, params.id, body);
    return NextResponse.json(result);
  },
  { rateLimit: "testWrite" }
);
