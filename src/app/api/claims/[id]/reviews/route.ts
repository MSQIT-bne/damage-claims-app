import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ReviewSchema = z.object({
  decision: z.enum(["CONFIRM", "OVERRIDE", "REQUEST_EVIDENCE"]),
  reason: z.string().min(1),
  overrideOutcome: z.enum(["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = ReviewSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: body.error.flatten() }, { status: 400 });
  }

  const { decision, reason, overrideOutcome } = body.data;

  const claim = await prisma.claim.findUnique({ where: { id } });
  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newState =
    decision === "CONFIRM" || decision === "OVERRIDE" ? "FINALISED" : "AWAITING_REVIEW";
  const newOutcome =
    decision === "OVERRIDE" && overrideOutcome
      ? overrideOutcome
      : claim.assessmentOutcome;

  await prisma.$transaction([
    prisma.claim.update({
      where: { id },
      data: {
        processingState: newState,
        assessmentOutcome: newOutcome,
        reviewerId: session.user.id,
        reviewTimestamp: new Date(),
        reviewDecision: decision,
      },
    }),
    prisma.auditEvent.create({
      data: {
        claimId: id,
        actorId: session.user.id,
        action: decision,
        oldValue: { processingState: claim.processingState, outcome: claim.assessmentOutcome },
        newValue: { processingState: newState, outcome: newOutcome },
        reason,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
