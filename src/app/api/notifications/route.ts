// Notifications API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionFromHeaders } from "@/lib/auth";
import { handle, unauthorized, parseJson } from "@/lib/utils/api";
import { z } from "zod";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const items = await db.notification.findMany({
      where: { userId: session.sub },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return { items };
  });
}

const markReadSchema = z.object({ id: z.string() });

export async function POST(req: NextRequest) {
  return handle(req, async () => {
    const session = await getSessionFromHeaders(req.headers);
    if (!session) throw unauthorized();
    const body = await parseJson(req, markReadSchema);
    const notif = await db.notification.update({
      where: { id: body.id, userId: session.sub },
      data: { readAt: new Date() },
    });
    return { notification: notif };
  });
}
