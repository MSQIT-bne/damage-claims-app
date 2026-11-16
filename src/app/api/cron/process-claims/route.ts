import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAssessment } from "@/lib/assessment";

// Called by Vercel Cron or an external scheduler. Protected by CRON_SECRET.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pick up to 5 queued claims per run to stay within function timeout
  const queued = await prisma.claim.findMany({
    where: { processingState: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: 5,
    select: { id: true },
  });

  if (queued.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // Process sequentially to avoid hammering APIs
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];
  for (const claim of queued) {
    try {
      await runAssessment(claim.id);
      results.push({ id: claim.id, ok: true });
    } catch (err) {
      results.push({ id: claim.id, ok: false, error: String(err) });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
