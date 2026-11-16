const BASE_URL = process.env.DESK365_BASE_URL!;
const API_KEY = process.env.DESK365_API_KEY!;

function headers() {
  return {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), { headers: headers() });
  if (!res.ok) {
    throw new Error(`Desk365 API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export interface Desk365Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  description: string;
  status: string;
  requester_name: string;
  requester_email: string;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<string, unknown>;
  attachments?: Desk365Attachment[];
}

export interface Desk365Attachment {
  id: string;
  name: string;
  content_type: string;
  size: number;
  url: string;
}

export interface TicketListResponse {
  tickets: Desk365Ticket[];
  total: number;
  page: number;
  per_page: number;
}

export async function getTicketsByStatus(
  status: string,
  updatedSince?: Date
): Promise<Desk365Ticket[]> {
  const params: Record<string, string> = {
    status,
    per_page: "50",
    page: "1",
    sort_by: "updated_at",
    sort_order: "desc",
  };
  if (updatedSince) {
    params.updated_since = updatedSince.toISOString();
  }
  const data = await get<TicketListResponse>("/tickets", params);
  return data.tickets ?? [];
}

export async function getTicket(ticketId: string): Promise<Desk365Ticket> {
  return get<Desk365Ticket>(`/tickets/${ticketId}`);
}

export async function getTicketAttachments(ticketId: string): Promise<Desk365Attachment[]> {
  const ticket = await getTicket(ticketId);
  return ticket.attachments ?? [];
}

export async function downloadAttachment(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    throw new Error(`Failed to download attachment: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

export async function addInternalNote(ticketId: string, note: string): Promise<void> {
  const url = `${BASE_URL}/tickets/${ticketId}/reply`;
  await fetch(url, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ body: note, private: true }),
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const crypto = require("crypto");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signature, "hex")
  );
}
