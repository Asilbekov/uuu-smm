// POST /api/smm/events/[id]/roles — add a role (ТЗ template) to my event
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmRoleInputSchema } from "@/server/schemas";
import { addRole } from "@/server/services/smm.service";

export const POST = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmRoleInputSchema);
    return NextResponse.json(await addRole(params.id, userId, body), { status: 201 });
  },
  { rateLimit: "testWrite" }
);
