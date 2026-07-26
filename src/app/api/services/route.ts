// Services catalog API
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { handle } from "@/lib/utils/api";

export async function GET(req: NextRequest) {
  return handle(req, async () => {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || undefined;
    const activeOnly = url.searchParams.get("active") !== "false";
    const items = await db.serviceType.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { category: "asc" },
    });
    return { items };
  });
}
