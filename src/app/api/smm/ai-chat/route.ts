// POST /api/smm/ai-chat — the CUSTOMER discusses a SPECIALIST with the AI:
// the server builds the prompt from the person's анкета (headline, resume,
// city/rate, files) — the same provider chain as the rest of the app.
import { NextResponse } from "next/server";
import { withApiAuth } from "@/server/http/handler";
import { parseBody } from "@/server/http/validation";
import { smmAiChatSchema } from "@/server/schemas";
import { chatAboutSpecialist } from "@/server/services/smm.service";

export const POST = withApiAuth(
  async ({ req }) => {
    const body = await parseBody(req, smmAiChatSchema);
    return NextResponse.json(await chatAboutSpecialist(body.specialistId, body.messages));
  },
  { rateLimit: "ai" }
);
