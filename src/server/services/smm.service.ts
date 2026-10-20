// ---------------------------------------------------------------------------
// SMM service — the marketplace domain: specialists (анкета), events
// (мероприятия) with their roles (ТЗ templates), invitations (customer →
// specialist), applications (specialist → event), personal-library
// bookmarks, files and the per-entity group chats.
//
// Access rules:
//   * events belong to their customer — only the owner edits roles/status;
//   * an ACCEPTED invitation or application makes the event "have" the
//     specialist for that role (derived, no extra table);
//   * the feed is role-aware: a customer browses SPECIALISTS, a specialist
//     browses EVENTS.
// ---------------------------------------------------------------------------

import { db } from "@/lib/db";
import { ApiError } from "@/server/http/errors";
import { aiChat } from "@/lib/ai";

// ------------------------------------------------------------- profile (SMM) --

export async function getSmmProfile(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, image: true,
      smmRole: true, smmHeadline: true, smmResume: true,
      smmVideoUrl: true, smmCity: true, smmRate: true, smmReady: true,
    },
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateSmmProfile(
  userId: string,
  body: {
    smmRole?: string; smmHeadline?: string; smmResume?: string;
    smmVideoUrl?: string | null; smmCity?: string; smmRate?: string; smmReady?: boolean;
  }
) {
  const data: Record<string, unknown> = {};
  if (body.smmRole) data.smmRole = body.smmRole;
  if (typeof body.smmHeadline === "string") data.smmHeadline = body.smmHeadline.slice(0, 120);
  if (typeof body.smmResume === "string") data.smmResume = body.smmResume.slice(0, 8000);
  if (body.smmVideoUrl !== undefined) data.smmVideoUrl = body.smmVideoUrl ? String(body.smmVideoUrl).slice(0, 11_000_000) : null;
  if (typeof body.smmCity === "string") data.smmCity = body.smmCity.slice(0, 60);
  if (typeof body.smmRate === "string") data.smmRate = body.smmRate.slice(0, 120);
  if (typeof body.smmReady === "boolean") data.smmReady = body.smmReady;
  if (Object.keys(data).length === 0) throw ApiError.badRequest("Nothing to update");
  return db.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, smmRole: true, smmHeadline: true, smmResume: true,
      smmVideoUrl: true, smmCity: true, smmRate: true, smmReady: true,
    },
  });
}

// ---------------------------------------------------------------- feed --

const SPECIALIST_SELECT = {
  id: true, name: true, image: true,
  smmRole: true, smmHeadline: true, smmResume: true,
  smmVideoUrl: true, smmCity: true, smmRate: true, smmReady: true,
  createdAt: true,
} as const;

function specialistPayload(u: Record<string, unknown> & { id: string }, filesCount: number) {
  return {
    id: u.id, name: u.name, image: u.image,
    headline: u.smmHeadline, resume: u.smmResume, videoUrl: u.smmVideoUrl,
    city: u.smmCity, rate: u.smmRate, ready: u.smmReady,
    smmRole: u.smmRole, filesCount, createdAt: u.createdAt,
  };
}

/** The dashboard feed, role-aware. scope "mine" = the personal library
 * (bookmarked specialists / bookmarked events), "discover" = everything. */
export async function getSmmFeed(userId: string, scope: "mine" | "discover", limit = 12) {
  const me = await db.user.findUnique({ where: { id: userId }, select: { smmRole: true } });
  if (!me) throw ApiError.unauthorized("Not authenticated");

  if (me.smmRole === "specialist") {
    // Specialist browses EVENTS
    const bm = await db.smmBookmark.findMany({
      where: { userId, targetType: "event" },
      select: { targetId: true },
    });
    const pinnedIds = bm.map(b => b.targetId);
    const events = await db.smmEvent.findMany({
      where: scope === "mine"
        ? { id: { in: pinnedIds } }
        : { isPublic: true, status: "open" },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 50),
      select: {
        id: true, title: true, summary: true, brief: true, deadline: true,
        budget: true, restrictions: true, kind: true, coverColor: true,
        coverIcon: true, status: true, createdAt: true,
        customer: { select: { id: true, name: true, image: true } },
        roles: { orderBy: { orderNum: "asc" }, select: { id: true, name: true, brief: true, payment: true, deadline: true } },
        _count: { select: { applications: true } },
      },
    });
    const fileCounts = await db.smmFile.groupBy({
      by: ["ownerId"],
      where: { ownerType: "event", ownerId: { in: events.map(e => e.id) } },
      _count: { _all: true },
    });
    const fcMap = new Map(fileCounts.map(f => [f.ownerId, f._count._all]));
    return {
      kind: "events" as const,
      items: events.map(e => ({
        ...e,
        filesCount: fcMap.get(e.id) || 0,
        applicationsCount: e._count.applications,
        _count: undefined,
      })),
    };
  }

  // Customer browses SPECIALISTS
  const bm = await db.smmBookmark.findMany({
    where: { userId, targetType: "specialist" },
    select: { targetId: true },
  });
  const pinnedIds = bm.map(b => b.targetId);
  const specialists = await db.user.findMany({
    where: scope === "mine"
      ? { id: { in: pinnedIds }, smmRole: "specialist" }
      : { smmRole: "specialist" },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 50),
    select: SPECIALIST_SELECT,
  });
  const fileCounts = await db.smmFile.groupBy({
    by: ["ownerId"],
    where: { ownerType: "user", ownerId: { in: specialists.map(s => s.id) } },
    _count: { _all: true },
  });
  const fcMap = new Map(fileCounts.map(f => [f.ownerId, f._count._all]));
  return {
    kind: "specialists" as const,
    items: specialists.map(s => specialistPayload(s as unknown as Record<string, unknown> & { id: string }, fcMap.get(s.id) || 0)),
  };
}

// -------------------------------------------------------------- events CRUD --

const EVENT_ROLES_SELECT = {
  id: true, name: true, brief: true, payment: true, deadline: true, orderNum: true,
} as const;

export async function listMyEvents(userId: string) {
  const events = await db.smmEvent.findMany({
    where: { customerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      roles: { orderBy: { orderNum: "asc" }, select: EVENT_ROLES_SELECT },
      _count: { select: { applications: { where: { status: "pending" } }, invitations: true } },
    },
  });
  return events.map(e => ({
    ...e,
    pendingApplications: e._count.applications,
    invitationsCount: e._count.invitations,
    _count: undefined,
  }));
}

async function assertEventOwner(eventId: string, userId: string) {
  const ev = await db.smmEvent.findUnique({ where: { id: eventId }, select: { customerId: true } });
  if (!ev) throw ApiError.notFound("Event not found");
  if (ev.customerId !== userId) throw ApiError.forbidden("Not your event");
  return ev;
}

export async function getEventDetail(eventId: string, userId?: string) {
  const ev = await db.smmEvent.findUnique({
    where: { id: eventId },
    include: {
      customer: { select: { id: true, name: true, image: true } },
      roles: {
        orderBy: { orderNum: "asc" },
        select: { ...EVENT_ROLES_SELECT },
      },
    },
  });
  if (!ev) throw ApiError.notFound("Event not found");
  // Assignments = accepted invitations + accepted applications, per role
  const [inv, apps] = await Promise.all([
    db.smmInvitation.findMany({
      where: { eventId, status: "accepted" },
      select: { roleId: true, specialist: { select: { id: true, name: true, image: true } }, message: true, updatedAt: true },
    }),
    db.smmApplication.findMany({
      where: { eventId, status: "accepted" },
      select: { roleId: true, specialist: { select: { id: true, name: true, image: true } }, message: true, updatedAt: true },
    }),
  ]);
  const assigned = new Map<string, { userId: string; name: string; image: string | null; source: string }[]>();
  for (const r of [...inv, ...apps]) {
    const list = assigned.get(r.roleId) || [];
    if (!list.some(x => x.userId === r.specialist.id)) {
      list.push({ userId: r.specialist.id, name: r.specialist.name, image: r.specialist.image, source: "accepted" });
    }
    assigned.set(r.roleId, list);
  }
  const files = await db.smmFile.findMany({
    where: { ownerType: "event", ownerId: eventId },
    orderBy: { orderNum: "asc" },
    select: { id: true, title: true, type: true, url: true, size: true, tgMessageId: true, orderNum: true, createdAt: true },
  });
  const isOwner = !!userId && userId === ev.customerId;
  return {
    ...ev,
    isOwner,
    files,
    roles: ev.roles.map(r => ({ ...r, assigned: assigned.get(r.id) || [] })),
  };
}

export async function createEvent(userId: string, body: any) {
  const { roles, ...rest } = body;
  return db.smmEvent.create({
    data: {
      ...rest,
      customerId: userId,
      roles: roles?.length
        ? { create: roles.map((r: any, i: number) => ({ name: r.name, brief: r.brief || "", payment: r.payment || "", deadline: r.deadline || "", orderNum: i }))}
        : undefined,
    },
    include: { roles: { orderBy: { orderNum: "asc" } } },
  });
}

export async function updateEvent(eventId: string, userId: string, body: any) {
  await assertEventOwner(eventId, userId);
  const { roles, ...rest } = body;
  return db.smmEvent.update({ where: { id: eventId }, data: rest, include: { roles: { orderBy: { orderNum: "asc" } } } });
}

export async function deleteEvent(eventId: string, userId: string) {
  await assertEventOwner(eventId, userId);
  // Best-effort Telegram cleanup for the event's files
  const files = await db.smmFile.findMany({ where: { ownerType: "event", ownerId: eventId }, select: { url: true, tgMessageId: true } });
  await db.smmEvent.delete({ where: { id: eventId } });
  return { removedFiles: files.length };
}

// ----------------------------------------------------------------- roles --

export async function addRole(eventId: string, userId: string, body: { name: string; brief?: string; payment?: string; deadline?: string }) {
  await assertEventOwner(eventId, userId);
  const count = await db.smmRole.count({ where: { eventId } });
  return db.smmRole.create({
    data: { ...body, brief: body.brief || "", payment: body.payment || "", deadline: body.deadline || "", eventId, orderNum: count },
  });
}

async function assertRoleOwner(roleId: string, userId: string) {
  const role = await db.smmRole.findUnique({ where: { id: roleId }, select: { event: { select: { customerId: true } } } });
  if (!role) throw ApiError.notFound("Role not found");
  if (role.event.customerId !== userId) throw ApiError.forbidden("Not your event");
}

export async function updateRole(roleId: string, userId: string, body: any) {
  await assertRoleOwner(roleId, userId);
  return db.smmRole.update({ where: { id: roleId }, data: body });
}

export async function deleteRole(roleId: string, userId: string) {
  await assertRoleOwner(roleId, userId);
  await db.smmRole.delete({ where: { id: roleId } });
  return { ok: true };
}

// ------------------------------------------------------------ invitations --

export async function createInvitation(userId: string, body: { eventId: string; roleId: string; specialistId: string; message?: string }) {
  await assertEventOwner(body.eventId, userId);
  const role = await db.smmRole.findUnique({ where: { id: body.roleId }, select: { eventId: true } });
  if (!role || role.eventId !== body.eventId) throw ApiError.badRequest("Role does not belong to the event");
  const specialist = await db.user.findUnique({ where: { id: body.specialistId }, select: { smmRole: true } });
  if (!specialist) throw ApiError.notFound("Specialist not found");
  if (specialist.smmRole !== "specialist") throw ApiError.badRequest("User is not an SMM specialist");
  if (body.specialistId === userId) throw ApiError.badRequest("Cannot invite yourself");
  // Idempotent re-invite: refresh the pending one instead of stacking rows
  const existing = await db.smmInvitation.findFirst({
    where: { eventId: body.eventId, roleId: body.roleId, specialistId: body.specialistId, status: "pending" },
  });
  if (existing) {
    return db.smmInvitation.update({ where: { id: existing.id }, data: { message: body.message || "" } });
  }
  return db.smmInvitation.create({
    data: {
      eventId: body.eventId, roleId: body.roleId, customerId: userId,
      specialistId: body.specialistId, message: body.message || "",
    },
    include: {
      event: { select: { id: true, title: true } },
      role: { select: { id: true, name: true } },
      specialist: { select: { id: true, name: true, image: true } },
    },
  });
}

export async function listInvitations(userId: string, box: "sent" | "inbox") {
  const where = box === "sent" ? { customerId: userId } : { specialistId: userId };
  return db.smmInvitation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      event: { select: { id: true, title: true, summary: true, budget: true, deadline: true } },
      role: { select: { id: true, name: true, brief: true, payment: true, deadline: true } },
      customer: { select: { id: true, name: true, image: true } },
      specialist: { select: { id: true, name: true, image: true } },
    },
  });
}

export async function respondInvitation(id: string, userId: string, action: "accept" | "decline") {
  const inv = await db.smmInvitation.findUnique({ where: { id }, select: { specialistId: true, status: true } });
  if (!inv) throw ApiError.notFound("Invitation not found");
  if (inv.specialistId !== userId) throw ApiError.forbidden("Not your invitation");
  if (inv.status !== "pending") throw ApiError.badRequest("Already responded");
  return db.smmInvitation.update({ where: { id }, data: { status: action === "accept" ? "accepted" : "declined" } });
}

// ----------------------------------------------------------- applications --

export async function createApplication(userId: string, body: { eventId: string; roleId: string; message?: string }) {
  const ev = await db.smmEvent.findUnique({ where: { id: body.eventId }, select: { isPublic: true, status: true, customerId: true } });
  if (!ev) throw ApiError.notFound("Event not found");
  if (!ev.isPublic || ev.status !== "open") throw ApiError.badRequest("Event is not accepting applications");
  if (ev.customerId === userId) throw ApiError.badRequest("Cannot apply to your own event");
  const role = await db.smmRole.findUnique({ where: { id: body.roleId }, select: { eventId: true } });
  if (!role || role.eventId !== body.eventId) throw ApiError.badRequest("Role does not belong to the event");
  const existing = await db.smmApplication.findFirst({
    where: { eventId: body.eventId, roleId: body.roleId, specialistId: userId, status: "pending" },
  });
  if (existing) {
    return db.smmApplication.update({ where: { id: existing.id }, data: { message: body.message || "" } });
  }
  return db.smmApplication.create({
    data: {
      eventId: body.eventId, roleId: body.roleId, specialistId: userId, message: body.message || "",
    },
    include: {
      event: { select: { id: true, title: true } },
      role: { select: { id: true, name: true } },
      specialist: { select: { id: true, name: true, image: true } },
    },
  });
}

export async function listApplications(userId: string, box: "inbox" | "sent") {
  // inbox = applications to MY events (the customer reviews them);
  // sent = my own applications (the specialist tracks statuses)
  const where = box === "inbox" ? { event: { customerId: userId } } : { specialistId: userId };
  return db.smmApplication.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      event: { select: { id: true, title: true, summary: true, budget: true, deadline: true } },
      role: { select: { id: true, name: true, brief: true, payment: true, deadline: true } },
      specialist: { select: { id: true, name: true, image: true } },
    },
  });
}

export async function respondApplication(id: string, userId: string, action: "accept" | "decline") {
  const app = await db.smmApplication.findUnique({
    where: { id },
    select: { status: true, event: { select: { customerId: true } } },
  });
  if (!app) throw ApiError.notFound("Application not found");
  if (app.event.customerId !== userId) throw ApiError.forbidden("Not your event");
  if (app.status !== "pending") throw ApiError.badRequest("Already responded");
  return db.smmApplication.update({ where: { id }, data: { status: action === "accept" ? "accepted" : "declined" } });
}

// -------------------------------------------------------------- bookmarks --

export async function listSmmBookmarks(userId: string, targetType?: "specialist" | "event") {
  const rows = await db.smmBookmark.findMany({
    where: { userId, ...(targetType ? { targetType } : {}) },
    select: { targetType: true, targetId: true },
  });
  return { ids: rows.map(r => r.targetId), pairs: rows };
}

export async function addSmmBookmark(userId: string, targetType: "specialist" | "event", targetId: string) {
  // Validate the target exists
  if (targetType === "specialist") {
    const u = await db.user.findUnique({ where: { id: targetId }, select: { smmRole: true } });
    if (!u || u.smmRole !== "specialist") throw ApiError.notFound("Specialist not found");
  } else {
    const ev = await db.smmEvent.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!ev) throw ApiError.notFound("Event not found");
  }
  await db.smmBookmark.upsert({
    where: { userId_targetType_targetId: { userId, targetType, targetId } },
    create: { userId, targetType, targetId },
    update: {},
  });
  return { ok: true };
}

export async function removeSmmBookmark(userId: string, targetType: "specialist" | "event", targetId: string) {
  await db.smmBookmark.deleteMany({ where: { userId, targetType, targetId } });
  return { ok: true };
}

// ------------------------------------------------------------------ files --

export async function listSmmFiles(ownerType: "user" | "event", ownerId: string) {
  return db.smmFile.findMany({
    where: { ownerType, ownerId },
    orderBy: { orderNum: "asc" },
    select: { id: true, title: true, type: true, url: true, size: true, tgMessageId: true, orderNum: true, createdAt: true },
  });
}

export async function addSmmFile(userId: string, body: { ownerType: "user" | "event"; ownerId: string; title?: string; type?: string; url: string; size?: number | null; tgMessageId?: number | null }) {
  if (body.ownerType === "event") await assertEventOwner(body.ownerId, userId);
  else if (body.ownerId !== userId) throw ApiError.forbidden("Not your profile");
  const count = await db.smmFile.count({ where: { ownerType: body.ownerType, ownerId: body.ownerId } });
  return db.smmFile.create({
    data: {
      ownerType: body.ownerType,
      ownerId: body.ownerId,
      title: (body.title || "file").slice(0, 200),
      type: (body.type || "link").slice(0, 20),
      url: body.url,
      size: body.size ?? null,
      tgMessageId: body.tgMessageId ?? null,
      orderNum: count,
    },
  });
}

export async function deleteSmmFile(id: string, userId: string) {
  const f = await db.smmFile.findUnique({ where: { id } });
  if (!f) throw ApiError.notFound("File not found");
  if (f.ownerType === "event") await assertEventOwner(f.ownerId, userId);
  else if (f.ownerId !== userId) throw ApiError.forbidden("Not your file");
  await db.smmFile.delete({ where: { id } });
  return { ok: true, tgMessageId: f.tgMessageId, url: f.url };
}

// ------------------------------------------------------------------- chat --

export async function getSmmMessages(scopeType: "event" | "specialist", scopeId: string, after?: string) {
  if (scopeType === "event") {
    const ev = await db.smmEvent.findUnique({ where: { id: scopeId }, select: { id: true } });
    if (!ev) throw ApiError.notFound("Event not found");
  } else {
    const u = await db.user.findUnique({ where: { id: scopeId }, select: { id: true } });
    if (!u) throw ApiError.notFound("Specialist not found");
  }
  const rows = await db.smmChatMessage.findMany({
    where: { scopeType, scopeId, ...(after ? { createdAt: { gt: new Date(after) } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, scopeType: true, scopeId: true, userId: true, userName: true, text: true, createdAt: true },
  });
  return rows;
}

export async function sendSmmMessage(scopeType: "event" | "specialist", scopeId: string, userId: string, text: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!user) throw ApiError.unauthorized("Not authenticated");
  await getSmmMessages(scopeType, scopeId); // validates the scope exists
  return db.smmChatMessage.create({
    data: { scopeType, scopeId, userId, userName: user.name, text: text.slice(0, 2000) },
    select: { id: true, scopeType: true, scopeId: true, userId: true, userName: true, text: true, createdAt: true },
  });
}

// --------------------------------------------------------------------- AI --

/** AI chat about a SPECIALIST — the customer learns about the person from
 * their анкета: headline, resume, city/rate, attached files. The same
 * provider chain as the rest of the app (Z.ai GLM first). */
export async function chatAboutSpecialist(specialistId: string, messages: { role: "user" | "assistant"; content: string }[]) {
  const u = await db.user.findUnique({
    where: { id: specialistId },
    select: {
      name: true, smmRole: true, smmHeadline: true, smmResume: true,
      smmCity: true, smmRate: true, smmReady: true,
    },
  });
  if (!u || u.smmRole !== "specialist") throw ApiError.notFound("Specialist not found");
  const files = await db.smmFile.findMany({
    where: { ownerType: "user", ownerId: specialistId },
    orderBy: { orderNum: "asc" },
    take: 30,
    select: { title: true, type: true },
  });

  const facts: string[] = [
    `Имя специалиста: ${u.name}`,
    u.smmHeadline ? `Специализация: ${u.smmHeadline}` : "",
    u.smmCity ? `Город: ${u.smmCity}` : "",
    u.smmRate ? `Ставка/оплата: ${u.smmRate}` : "",
    `Открыт к работе: ${u.smmReady ? "да" : "нет"}`,
    u.smmResume ? `Резюме:\n${u.smmResume.slice(0, 4000)}` : "",
    files.length ? `Прикреплённые файлы (${files.length}): ${files.map(f => `${f.title} [${f.type}]`).join(", ")}` : "Файлов не прикреплено.",
  ].filter(Boolean);

  const system = [
    "Ты — помощник заказчика, который оценивает SMM-специалиста для найма.",
    "Отвечай на языке последнего сообщения пользователя. Будь конкретным, опирайся ТОЛЬКО на данные анкеты ниже; если данных не хватает — честно скажи, что уточнить у специалиста.",
    "Помоги заказчику понять: сильные стороны, релевантный опыт, вопросы, которые стоит задать на интервью, и соответствие задаче заказчика.",
    "",
    "ДАННЫЕ АНКЕТЫ:",
    ...facts,
  ].join("\n");

  const { text } = await aiChat({
    messages: [{ role: "system", content: system }, ...messages],
    temperature: 0.4,
    max_tokens: 1200,
  });
  return { response: text };
}
