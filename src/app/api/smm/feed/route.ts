// GET /api/smm/feed — the role-aware dashboard feed.
// A customer browses SPECIALISTS, a specialist browses EVENTS.
// scope=mine → the personal library (bookmarked), discover → everything.
// kind=events → FORCE the events feed regardless of the role — the
// customer's «Мероприятия» page (own + pinned events in the personal scope,
// every public open event in discover). kind=specialists works symmetrically.
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { getSmmFeed } from "@/server/services/smm.service";

export const GET = withApiAuth(async ({ userId, searchParams }) => {
  const scope = searchParams.get("scope") === "mine" ? "mine" : "discover";
  const limitRaw = Number(searchParams.get("limit") || 12);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(2, limitRaw), 50) : 12;
  const kindRaw = searchParams.get("kind");
  const kind = kindRaw === "events" ? "events" : kindRaw === "specialists" ? "specialists" : null;
  const feed = await getSmmFeed(userId, scope, limit, kind);
  return NextResponse.json(feed);
});
