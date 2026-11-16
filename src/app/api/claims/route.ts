import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { AssessmentOutcome, ProcessingState } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const outcome = searchParams.get("outcome") as AssessmentOutcome | null;
  const state = searchParams.get("state") as ProcessingState | null;
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = 20;

  const where = {
    ...(outcome ? { assessmentOutcome: outcome } : {}),
    ...(state ? { processingState: state } : {}),
  };

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        reviewer: { select: { name: true, email: true } },
        _count: { select: { evidenceFiles: true, validationIssues: true } },
      },
    }),
    prisma.claim.count({ where }),
  ]);

  return NextResponse.json({ claims, total, page, limit });
}
