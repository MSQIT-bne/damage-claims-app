/**
 * Desk365 polling worker.
 * Polls for tickets with status "Claim:Actioning" and queues them for processing.
 * Filters client-side since Desk365 API does not support server-side status filtering.
 */
import { prisma } from "@/lib/prisma";
import { listTickets, getTicketDetails } from "@/lib/desk365";

const TRIGGER_STATUS = "Claim:Actioning";

export async function pollDesk365(): Promise<{ queued: number; skipped: number; errors: number }> {
  const lastSync = await prisma.claim.findFirst({
    orderBy: { syncTimestamp: "desc" },
    select: { syncTimestamp: true },
  });

  const updatedSince = lastSync?.syncTimestamp
    ? new Date(lastSync.syncTimestamp.getTime() - 60_000)
    : undefined;

  let allTickets;
  try {
    // Fetch recent tickets (no server-side status filter available)
    allTickets = await listTickets({
      updatedSince,
      count: 100,
      includeCustomFields: false,
    });
  } catch (err) {
    console.error("Desk365 poll failed:", err);
    throw err;
  }

  // Filter to trigger status client-side
  const claimTickets = allTickets.tickets.filter(
    (t) => t.status === TRIGGER_STATUS
  );

  let queued = 0;
  let skipped = 0;
  let errors = 0;

  for (const ticket of claimTickets) {
    const ticketId = String(ticket.ticket_number);

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

    try {
      // Fetch full detail including custom fields + attachments
      const detail = await getTicketDetails(ticket.ticket_number);
      const cf = detail.custom_fields ?? {};

      await prisma.claim.upsert({
        where: { desk365TicketId: ticketId },
        create: {
          desk365TicketId: ticketId,
          title: detail.subject,
          description: detail.description_text ?? detail.description,
          claimant: cf["cf_Young Person(s) Name"] as string ?? detail.contact_name,
          incidentDate: cf["cf_Date of incident"]
            ? new Date(cf["cf_Date of incident"] as string)
            : null,
          desk365Status: detail.status,
          processingState: "QUEUED",
          syncTimestamp: new Date(),
        },
        update: {
          desk365Status: detail.status,
          processingState: "QUEUED",
          syncTimestamp: new Date(),
          title: detail.subject,
          description: detail.description_text ?? detail.description,
          claimant: cf["cf_Young Person(s) Name"] as string ?? detail.contact_name,
        },
      });
      queued++;
    } catch (err) {
      console.error(`Failed to queue ticket ${ticketId}:`, err);
      errors++;
    }
  }

  return { queued, skipped, errors };
}
