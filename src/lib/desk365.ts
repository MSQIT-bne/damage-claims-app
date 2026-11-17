const BASE_URL = process.env.DESK365_BASE_URL!; // https://kaizer.desk365.io/apis/v3
const API_KEY = process.env.DESK365_API_KEY!;

// Auth: raw key in Authorization header, no Bearer prefix
function headers(): Record<string, string> {
  return {
    Authorization: API_KEY,
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

async function post<T>(path: string, params: Record<string, string>, body?: unknown): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Desk365 API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function put<T>(path: string, params: Record<string, string>, body?: unknown): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Desk365 API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// --- Types ---

export interface Desk365Attachment {
  file_name: string;
  file_size: number;
  file_type: string;
  created_on: string;
  attachment_url: string; // pre-signed S3 URL, expires in 24h
}

export interface Desk365CustomFields {
  cf_Date_of_incident?: string;
  "cf_Young Person(s) Name"?: string;
  "cf_Youth Worker Name"?: string;
  "cf_Damages - Type"?: string;
  "cf_Placement"?: string;
  "cf_IR#:"?: string;
  "cf_Cost $ (P&E + Rejected)"?: string;
  "cf_Cost $ Approved"?: string;
  "cf_Reviewed by Claims"?: boolean;
  "cf_Quote Uploaded"?: boolean;
  "cf_Invoice Uploaded"?: boolean;
  "cf_IR, Email to CSO, PDF Photos"?: boolean;
  [key: string]: unknown;
}

export interface Desk365Ticket {
  ticket_number: number;
  contact_email: string;
  contact_name: string;
  subject: string;
  description?: string;
  description_text?: string;
  status: string;
  priority: number;
  form_name: string;
  assigned_to: string;
  company_name: string;
  created_on: string;
  updated_on: string;
  custom_fields?: Desk365CustomFields;
  attachments?: Desk365Attachment[];
  conversation_count: number;
}

export interface Desk365TicketList {
  count: number;
  tickets: Desk365Ticket[];
}

export interface Desk365Conversation {
  id: number;
  ticket_number: number;
  created_by: string;
  creator_name: string;
  type: string; // "reply" | "note" | "forward"
  sender_type: string; // "agent" | "contact"
  public_note: boolean | null;
  body_text?: string;
  attachments_count: number;
  attachments?: Desk365Attachment[];
  created_on: string;
}

export interface Desk365ConversationList {
  count: number;
  conversations: Desk365Conversation[];
}

// --- API methods ---

export async function listTickets(opts?: {
  updatedSince?: Date;
  offset?: number;
  count?: number;
  includeCustomFields?: boolean;
  includeDescription?: boolean;
}): Promise<Desk365TicketList> {
  const count = opts?.count ?? 50;
  // API only accepts 30, 50, or 100
  const validCount = count >= 100 ? 100 : count >= 50 ? 50 : 30;
  const params: Record<string, string> = {
    ticket_count: String(validCount),
    order_by: "updated_time",
    order_type: "desc",
  };
  if (opts?.updatedSince) {
    params.updated_since = opts.updatedSince.toISOString().replace("T", " ").slice(0, 19);
  }
  if (opts?.includeCustomFields) params.include_custom_fields = "true";
  if (opts?.includeDescription) params.include_description = "true";
  return get<Desk365TicketList>("/tickets", params);
}

export async function getTicketDetails(ticketNumber: number | string): Promise<Desk365Ticket> {
  return get<Desk365Ticket>("/tickets/details", {
    ticket_number: String(ticketNumber),
    include_custom_fields: "true",
  });
}

export async function getTicketConversations(
  ticketNumber: number | string
): Promise<Desk365ConversationList> {
  return get<Desk365ConversationList>("/tickets/conversations", {
    ticket_number: String(ticketNumber),
  });
}

export async function downloadAttachment(url: string, timeoutMs = 30_000): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Failed to download attachment: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

export async function addInternalNote(ticketNumber: number | string, note: string): Promise<void> {
  await post("/tickets/add_note", { ticket_number: String(ticketNumber) }, {
    body: note,
    private: true,
  });
}

export async function updateTicketStatus(
  ticketNumber: number | string,
  status: string
): Promise<void> {
  await put("/tickets/update", { ticket_number: String(ticketNumber) }, { status });
}

export async function updateTicketCustomField(
  ticketNumber: number | string,
  fields: Record<string, unknown>
): Promise<void> {
  await put("/tickets/update", { ticket_number: String(ticketNumber) }, {
    custom_fields: fields,
  });
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature.replace(/^sha256=/, ""), "hex")
    );
  } catch {
    return false;
  }
}
