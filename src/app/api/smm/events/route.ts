// GET  /api/smm/events — my events (the customer's manager list)
// POST /api/smm/events — create an event (roles inline)
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmEventCreateSchema } from "@/server/schemas";
import { createEvent, listMyEvents } from "@/server/services/smm.service";

export const GET = withApiAuth(async ({ userId }) => {
  return NextResponse.json(await listMyEvents(userId));
});

export const POST = withApiAuth(
  async ({ userId, req }) => {
    const body = await parseBody(req, smmEventCreateSchema);
    return NextResponse.json(await createEvent(userId, body), { status: 201 });
  },
  { rateLimit: "testWrite" }
);
