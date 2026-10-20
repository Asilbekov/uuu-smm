// GET  /api/smm/invitations?box=sent|inbox — sent (customer) / received (specialist)
// POST /api/smm/invitations — the customer invites a specialist to an event role
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmInvitationCreateSchema } from "@/server/schemas";
import { createInvitation, listInvitations } from "@/server/services/smm.service";

export const GET = withApiAuth(async ({ userId, searchParams }) => {
  const box = searchParams.get("box") === "sent" ? "sent" : "inbox";
  return NextResponse.json(await listInvitations(userId, box));
});

export const POST = withApiAuth(
  async ({ userId, req }) => {
    const body = await parseBody(req, smmInvitationCreateSchema);
    return NextResponse.json(await createInvitation(userId, body), { status: 201 });
  },
  { rateLimit: "testWrite" }
);
