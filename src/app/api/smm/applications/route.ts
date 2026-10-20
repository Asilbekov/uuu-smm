// GET  /api/smm/applications?box=inbox|sent — inbox = to my events (customer),
//                                            sent = my applications (specialist)
// POST /api/smm/applications — the specialist applies to an event role
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmApplicationCreateSchema } from "@/server/schemas";
import { createApplication, listApplications } from "@/server/services/smm.service";

export const GET = withApiAuth(async ({ userId, searchParams }) => {
  const box = searchParams.get("box") === "sent" ? "sent" : "inbox";
  return NextResponse.json(await listApplications(userId, box));
});

export const POST = withApiAuth(
  async ({ userId, req }) => {
    const body = await parseBody(req, smmApplicationCreateSchema);
    return NextResponse.json(await createApplication(userId, body), { status: 201 });
  },
  { rateLimit: "testWrite" }
);
