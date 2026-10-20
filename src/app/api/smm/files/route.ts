// GET  /api/smm/files?ownerType=user|event&ownerId=… — public read
// POST /api/smm/files — link an uploaded file to a specialist profile / event
import { NextResponse } from "next/server";
import { withApi, withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmFileCreateSchema } from "@/server/schemas";
import { addSmmFile, listSmmFiles } from "@/server/services/smm.service";

export const GET = withApi(async ({ searchParams }) => {
  const ownerType = searchParams.get("ownerType") === "event" ? "event" : "user";
  const ownerId = (searchParams.get("ownerId") || "").slice(0, 64);
  if (!ownerId) return NextResponse.json([]);
  return NextResponse.json(await listSmmFiles(ownerType, ownerId));
});

export const POST = withApiAuth(
  async ({ userId, req }) => {
    const body = await parseBody(req, smmFileCreateSchema);
    return NextResponse.json(await addSmmFile(userId, body), { status: 201 });
  },
  { rateLimit: "testWrite" }
);
