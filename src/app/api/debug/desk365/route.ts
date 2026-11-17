import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTickets } from "@/lib/desk365";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await listTickets({ count: 20, includeCustomFields: false });
  return NextResponse.json({
    count: result.count,
    tickets: result.tickets.map((t) => ({
      ticket_number: t.ticket_number,
      subject: t.subject,
      status: t.status,
      updated_on: t.updated_on,
    })),
  });
}
