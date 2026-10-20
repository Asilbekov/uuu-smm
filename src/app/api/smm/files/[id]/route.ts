// DELETE /api/smm/files/[id] — remove a file from a profile / event
// (the Telegram channel post is deleted best-effort, like test attachments)
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { telegramDeleteFile } from "@/lib/telegram";
import { deleteSmmFile } from "@/server/services/smm.service";

export const DELETE = withApiAuth(
  async ({ userId, params }) => {
    const res = await deleteSmmFile(params.id, userId);
    // Best-effort channel cleanup (tg:<file_id> references only)
    if (res.tgMessageId && String(res.url || "").startsWith("tg:")) {
      telegramDeleteFile(String(res.url).slice(3), res.tgMessageId).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  },
  { rateLimit: "testWrite" }
);
