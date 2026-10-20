// GET    /api/smm/events/[id] — full event detail (public; roles carry the
//                              ACCEPTED specialists = the event's assignments)
// PUT    /api/smm/events/[id] — owner-only update
// DELETE /api/smm/events/[id] — owner-only delete (cascades roles/invites/apps)
import { NextResponse } from "next/server";
import { withApi, withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmEventUpdateSchema } from "@/server/schemas";
import { deleteEvent, getEventDetail, updateEvent } from "@/server/services/smm.service";

export const GET = withApi(async ({ params, userId }) => {
  return NextResponse.json(await getEventDetail(params.id, userId || undefined));
});

export const PUT = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmEventUpdateSchema);
    return NextResponse.json(await updateEvent(params.id, userId, body));
  },
  { rateLimit: "testWrite" }
);

export const DELETE = withApiAuth(
  async ({ userId, params }) => {
    return NextResponse.json(await deleteEvent(params.id, userId));
  },
  { rateLimit: "testWrite" }
);
