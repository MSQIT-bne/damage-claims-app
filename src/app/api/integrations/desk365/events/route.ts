import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/desk365";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("x-desk365-signature") ?? "";
  const rawBody = await req.text();

  if (process.env.DESK365_WEBHOOK_SECRET) {
    const valid = verifyWebhookSignature(
      rawBody,
      signature,
      process.env.DESK365_WEBHOOK_SECRET
    );
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: { ticket_id?: string; status?: string; event?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { ticket_id, status } = payload;

  if (!ticket_id || status !== "Claims - actioning") {
    return NextResponse.json({ received: true });
  }

  // Upsert claim and queue for processing
  await prisma.claim.upsert({
    where: { desk365TicketId: ticket_id },
    create: {
      desk365TicketId: ticket_id,
      desk365Status: status,
      processingState: "QUEUED",
      syncTimestamp: new Date(),
    },
    update: {
      desk365Status: status,
      processingState: "QUEUED",
      syncTimestamp: new Date(),
    },
  });

  return NextResponse.json({ received: true, queued: ticket_id });
}
