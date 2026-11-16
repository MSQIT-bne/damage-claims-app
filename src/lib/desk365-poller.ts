/**
 * Desk365 polling worker — run via a cron job or Next.js cron route.
 * Polls for tickets with status "Claim:Actioning" and queues them for processing.
 */
import { prisma } from "@/lib/prisma";
import { getTicketsByStatus, getTicket, getTicketAttachments } from "@/lib/desk365";

const TRIGGER_STATUS = "Claim:Actioning";

export async function pollDesk365(): Promise<{ queued: number; skipped: number }> {
  // Find the last sync time to avoid re-processing old tickets
  const lastSync = await prisma.claim.findFirst({
    orderBy: { syncTimestamp: "desc" },
    select: { syncTimestamp: true },
  });

  const updatedSince = lastSync?.syncTimestamp
    ? new Date(lastSync.syncTimestamp.getTime() - 60_000) // 1 min overlap
    : undefined;

  let tickets;
  try {
    tickets = await getTicketsByStatus(TRIGGER_STATUS, updatedSince);
  } catch (err) {
    console.error("Desk365 poll failed:", err);
    throw err;
  }

  let queued = 0;
  let skipped = 0;

  for (const ticket of tickets) {
    const ticketId = String(ticket.id ?? ticket.ticket_number);

    // Idempotency: skip if already in a terminal or in-progress state
    const existing = await prisma.claim.findUnique({
      where: { desk365TicketId: ticketId },
      select: { processingState: true, syncTimestamp: true },
    });

    if (
      existing &&
      ["COLLECTING", "ANALYSING", "AWAITING_REVIEW", "FINALISED"].includes(
        existing.processingState
      )
    ) {
      skipped++;
      continue;
    }

    await prisma.claim.upsert({
      where: { desk365TicketId: ticketId },
      create: {
        desk365TicketId: ticketId,
        title: ticket.subject,
        description: ticket.description,
        claimant: ticket.requester_name,
        desk365Status: ticket.status,
        processingState: "QUEUED",
        syncTimestamp: new Date(),
      },
      update: {
        desk365Status: ticket.status,
        processingState: "QUEUED",
        syncTimestamp: new Date(),
        title: ticket.subject,
        description: ticket.description,
        claimant: ticket.requester_name,
      },
    });

    queued++;
  }

  return { queued, skipped };
}
