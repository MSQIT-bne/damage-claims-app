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

  // No state guard — allow force re-run on stuck COLLECTING/ANALYSING claims too

  // Reset state to QUEUED
  await prisma.claim.update({
    where: { id },
    data: { processingState: "QUEUED" },
  });

  // Run synchronously — fire-and-forget is killed by Vercel before it completes
  try {
    await runAssessment(id);
  } catch (err) {
    console.error(`Assessment failed for claim ${id}:`, err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }

  return NextResponse.json({ started: true });
}
