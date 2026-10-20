// PUT    /api/smm/roles/[id] — edit a role template (event owner only)
// DELETE /api/smm/roles/[id] — remove a role (cascades its invites/apps)
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmRoleUpdateSchema } from "@/server/schemas";
import { deleteRole, updateRole } from "@/server/services/smm.service";

export const PUT = withApiAuth(
  async ({ userId, params, req }) => {
    const body = await parseBody(req, smmRoleUpdateSchema);
    return NextResponse.json(await updateRole(params.id, userId, body));
  },
  { rateLimit: "testWrite" }
);

export const DELETE = withApiAuth(
  async ({ userId, params }) => {
    return NextResponse.json(await deleteRole(params.id, userId));
  },
  { rateLimit: "testWrite" }
);
