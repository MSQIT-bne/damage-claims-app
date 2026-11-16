import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runAssessment } from "@/lib/assessment";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const claim = await prisma.claim.findUnique({
    where: { id },
    select: { processingState: true },
  });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Allow reanalysis from AWAITING_REVIEW or FAILED; block if already running
  if (["COLLECTING", "ANALYSING"].includes(claim.processingState)) {
    return NextResponse.json({ error: "Assessment already in progress" }, { status: 409 });
  }

  // Reset state to QUEUED so the worker picks it up
  await prisma.claim.update({
    where: { id },
    data: { processingState: "QUEUED" },
  });

  // Run inline (Vercel Functions have a 60s limit on hobby; use background for prod)
  runAssessment(id).catch((err) => {
    console.error(`Assessment failed for claim ${id}:`, err);
  });

  return NextResponse.json({ started: true });
}
