import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
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
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
      evidenceFiles: { orderBy: { uploadTimestamp: "asc" } },
      validationIssues: {
        orderBy: [{ severity: "desc" }, { createdAt: "asc" } as never],
      },
      assessments: { orderBy: { version: "desc" }, take: 5 },
      auditEvents: {
        orderBy: { timestamp: "desc" },
        take: 20,
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(claim);
}
