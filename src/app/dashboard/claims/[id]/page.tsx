export const instant = false;

import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ClaimDetailClient } from "@/components/claim-detail-client";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const { id } = await params;

  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
      evidenceFiles: { orderBy: { uploadTimestamp: "asc" } },
      validationIssues: { orderBy: [{ severity: "desc" }] },
      assessments: { orderBy: { version: "desc" }, take: 5 },
      auditEvents: {
        orderBy: { timestamp: "desc" },
        take: 20,
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });

  if (!claim) notFound();

  return (
    <ClaimDetailClient
      claim={JSON.parse(JSON.stringify(claim))}
      currentUser={session!.user}
    />
  );
}
