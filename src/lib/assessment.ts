import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import {
  getTicketDetails,
  downloadAttachment,
  addInternalNote,
  type Desk365Ticket,
  type Desk365Attachment,
} from "@/lib/desk365";

const MODEL = "claude-sonnet-4-5";

// ── Prompt ───────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert claims assessor for a youth care organisation.
You review damage claims submitted by youth workers when young people in residential care cause property damage.

Your role is to assess whether a claim submission is complete and accurate based on the evidence provided.
You NEVER approve or reject a claim — that decision always belongs to a human staff member.
You assess completeness and flag issues so staff can review efficiently.

For every claim you must:
1. Identify what evidence was provided (photos, quotes, invoices, incident reports).
2. Check whether mandatory fields are present and consistent.
3. Identify any discrepancies, missing documents, or concerns.
4. Recommend one of three outcomes: COMPLETE, INCOMPLETE, or REVIEW_REQUIRED.

COMPLETE — All required documents present, fields consistent, no red flags.
INCOMPLETE — One or more mandatory items missing (quote, invoice, incident report, photos).
REVIEW_REQUIRED — Documents present but discrepancies exist, amounts are unusually high, or other concerns warrant human scrutiny.

Always respond with valid JSON in the exact schema provided.`;

const ASSESSMENT_SCHEMA = {
  type: "object",
  properties: {
    recommended_outcome: {
      type: "string",
      enum: ["COMPLETE", "INCOMPLETE", "REVIEW_REQUIRED"],
      description: "Overall assessment outcome",
    },
    summary: {
      type: "string",
      description: "2-3 sentence plain-English summary for staff reviewers",
    },
    evidence_found: {
      type: "array",
      items: { type: "string" },
      description: "List of evidence types identified (e.g. 'Quote from XYZ Repairs - $450')",
    },
    validation_issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rule_id: { type: "string" },
          category: { type: "string", enum: ["MISSING", "MISMATCH", "UNCLEAR", "EXTRACTION_FAILURE"] },
          severity: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
          description: { type: "string" },
          expected_value: { type: "string" },
          observed_value: { type: "string" },
        },
        required: ["rule_id", "category", "severity", "description"],
      },
    },
    suggested_next_actions: {
      type: "array",
      items: { type: "string" },
      description: "Recommended actions for the reviewing staff member",
    },
    confidence_score: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "0–1 confidence in this assessment",
    },
  },
  required: [
    "recommended_outcome",
    "summary",
    "evidence_found",
    "validation_issues",
    "suggested_next_actions",
    "confidence_score",
  ],
} as const;

type AssessmentOutput = {
  recommended_outcome: "COMPLETE" | "INCOMPLETE" | "REVIEW_REQUIRED";
  summary: string;
  evidence_found: string[];
  validation_issues: Array<{
    rule_id: string;
    category: "MISSING" | "MISMATCH" | "UNCLEAR" | "EXTRACTION_FAILURE";
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    description: string;
    expected_value?: string;
    observed_value?: string;
  }>;
  suggested_next_actions: string[];
  confidence_score: number;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function buildClaimContext(ticket: Desk365Ticket): string {
  const cf = ticket.custom_fields ?? {};
  const lines = [
    `Ticket #${ticket.ticket_number}: ${ticket.subject}`,
    `Submitted by: ${ticket.contact_name} <${ticket.contact_email}>`,
    `Description: ${ticket.description_text ?? ticket.description ?? "(none)"}`,
    ``,
    `Custom fields:`,
    `  Young Person(s): ${cf["cf_Young Person(s) Name"] ?? "not provided"}`,
    `  Incident Date: ${cf["cf_Date_of_incident"] ?? "not provided"}`,
    `  Damage Type: ${cf["cf_Damages - Type"] ?? "not provided"}`,
    `  Placement: ${cf["cf_Placement"] ?? "not provided"}`,
    `  Youth Worker: ${cf["cf_Youth Worker Name"] ?? "not provided"}`,
    `  IR#: ${cf["cf_IR#:"] ?? "not provided"}`,
    `  Quote Uploaded: ${cf["cf_Quote Uploaded"] ? "Yes" : "No"}`,
    `  Invoice Uploaded: ${cf["cf_Invoice Uploaded"] ? "Yes" : "No"}`,
    `  IR / Email / PDF Photos: ${cf["cf_IR, Email to CSO, PDF Photos"] ? "Yes" : "No"}`,
    `  Cost (P&E + Rejected): ${cf["cf_Cost $ (P&E + Rejected)"] ?? "not provided"}`,
    `  Cost (Approved): ${cf["cf_Cost $ Approved"] ?? "not provided"}`,
    ``,
    `Attachments: ${ticket.attachments?.length ?? 0} file(s)`,
  ];
  return lines.join("\n");
}

// ── Core worker ───────────────────────────────────────────────────────────────

export async function runAssessment(claimId: string): Promise<void> {
  // Mark as COLLECTING
  await prisma.claim.update({
    where: { id: claimId },
    data: { processingState: "COLLECTING" },
  });

  const claim = await prisma.claim.findUnique({ where: { id: claimId } });
  if (!claim) throw new Error(`Claim ${claimId} not found`);

  let ticket: Desk365Ticket;
  try {
    ticket = await getTicketDetails(claim.desk365TicketId);
  } catch (err) {
    await failClaim(claimId, `Failed to fetch Desk365 ticket: ${String(err)}`);
    throw err;
  }

  // Sync ticket fields to claim
  const cf = ticket.custom_fields ?? {};
  const incidentDate = cf["cf_Date_of_incident"]
    ? new Date(cf["cf_Date_of_incident"] as string)
    : null;
  const claimedAmount = (cf["cf_Cost $ (P&E + Rejected)"] as string | undefined)?.replace(/[^0-9.]/g, "") ?? null;

  await prisma.claim.update({
    where: { id: claimId },
    data: {
      title: ticket.subject,
      description: ticket.description_text ?? ticket.description ?? null,
      claimant: (cf["cf_Young Person(s) Name"] as string | undefined) ?? null,
      incidentDate: incidentDate && !isNaN(incidentDate.getTime()) ? incidentDate : null,
      claimedAmount: claimedAmount ? parseFloat(claimedAmount) : null,
      desk365Status: ticket.status,
      syncTimestamp: new Date(),
    },
  });

  // Download & store attachments
  const attachments = ticket.attachments ?? [];
  const evidenceInputs: Array<{ type: "image"; source: { type: "base64"; media_type: string; data: string }; filename: string } |
    { type: "text"; text: string; filename: string }> = [];

  for (const att of attachments) {
    try {
      const buf = await downloadAttachment(att.attachment_url);
      const hash = sha256(buf);
      const isImage = att.file_type.startsWith("image/");
      const isPdf = att.file_type === "application/pdf";

      // Store evidence file record (storageKey is placeholder until SharePoint is set up)
      const existing = await prisma.evidenceFile.findFirst({
        where: { claimId, sourceAttachmentId: att.file_name },
      });
      if (existing) {
        await prisma.evidenceFile.update({
          where: { id: existing.id },
          data: { fileSize: buf.length, sha256: hash, uploadTimestamp: new Date(att.created_on) },
        });
      } else {
        await prisma.evidenceFile.create({
          data: {
            claimId,
            originalFilename: att.file_name,
            mimeType: att.file_type,
            fileSize: buf.length,
            sha256: hash,
            sourceAttachmentId: att.file_name,
            storageKey: `pending/${claimId}/${att.file_name}`,
            uploadTimestamp: new Date(att.created_on),
          },
        });
      }

      if (isImage) {
        evidenceInputs.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.file_type as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: buf.toString("base64"),
          },
          filename: att.file_name,
        });
      } else if (isPdf) {
        // Send PDF filename as text note — vision for PDFs not yet supported in this integration
        evidenceInputs.push({
          type: "text",
          text: `[PDF attached: ${att.file_name}, ${(buf.length / 1024).toFixed(0)} KB]`,
          filename: att.file_name,
        });
      } else {
        evidenceInputs.push({
          type: "text",
          text: `[File attached: ${att.file_name}, type: ${att.file_type}, ${(buf.length / 1024).toFixed(0)} KB]`,
          filename: att.file_name,
        });
      }
    } catch (err) {
      // Don't fail the whole assessment for one bad attachment
      console.error(`Failed to process attachment ${att.file_name}:`, err);
      evidenceInputs.push({
        type: "text",
        text: `[Failed to retrieve: ${att.file_name}]`,
        filename: att.file_name,
      });
    }
  }

  // Mark as ANALYSING
  await prisma.claim.update({
    where: { id: claimId },
    data: { processingState: "ANALYSING" },
  });

  // Build Claude message content
  const claimContext = buildClaimContext(ticket);
  const userContent: Anthropic.MessageParam["content"] = [
    {
      type: "text",
      text: `Please assess the following youth care damage claim submission.\n\n${claimContext}\n\nAttachments (${evidenceInputs.length}):`,
    },
    // Add image content blocks
    ...evidenceInputs.flatMap((e) => {
      if (e.type === "image") {
        return [
          { type: "text" as const, text: `\nFile: ${e.filename}` },
          {
            type: "image" as const,
            source: e.source as Anthropic.Base64ImageSource,
          },
        ];
      }
      return [{ type: "text" as const, text: `\n${e.text}` }];
    }),
    {
      type: "text",
      text: `\nRespond with a JSON object matching this schema:\n${JSON.stringify(ASSESSMENT_SCHEMA, null, 2)}`,
    },
  ];

  // Call Claude
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawResponse: string;
  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });
    rawResponse = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as Anthropic.TextBlock).text)
      .join("");
  } catch (err) {
    await failClaim(claimId, `Claude API error: ${String(err)}`);
    throw err;
  }

  // Parse JSON — Claude sometimes wraps in ```json
  let output: AssessmentOutput;
  try {
    const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)```/) ??
      rawResponse.match(/(\{[\s\S]*\})/);
    output = JSON.parse(jsonMatch ? jsonMatch[1] : rawResponse) as AssessmentOutput;
  } catch {
    await failClaim(claimId, `Failed to parse Claude response: ${rawResponse.slice(0, 200)}`);
    throw new Error("Invalid JSON from Claude");
  }

  // Get current version number
  const currentClaim = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { assessmentVersion: true },
  });
  const nextVersion = (currentClaim?.assessmentVersion ?? 0) + 1;

  // Persist assessment + issues in a transaction
  await prisma.$transaction(async (tx) => {
    // Create assessment record
    await tx.assessment.create({
      data: {
        claimId,
        version: nextVersion,
        recommendedOutcome: output.recommended_outcome,
        summary: output.summary,
        rawOutput: output as object,
        modelVersion: MODEL,
      },
    });

    // Clear old open issues and write fresh ones
    await tx.validationIssue.deleteMany({
      where: { claimId, resolutionStatus: "OPEN" },
    });

    if (output.validation_issues.length > 0) {
      await tx.validationIssue.createMany({
        data: output.validation_issues.map((issue) => ({
          claimId,
          ruleId: issue.rule_id,
          category: issue.category,
          severity: issue.severity,
          description: issue.description,
          expectedValue: issue.expected_value ?? null,
          observedValue: issue.observed_value ?? null,
        })),
      });
    }

    // Update claim state
    await tx.claim.update({
      where: { id: claimId },
      data: {
        processingState: "AWAITING_REVIEW",
        assessmentOutcome: output.recommended_outcome,
        assessmentVersion: nextVersion,
      },
    });

    // Audit event
    await tx.auditEvent.create({
      data: {
        claimId,
        action: "AI_ASSESSMENT_COMPLETE",
        newValue: {
          version: nextVersion,
          outcome: output.recommended_outcome,
          issueCount: output.validation_issues.length,
        },
      },
    });
  });

  // Add internal note to Desk365 ticket
  const noteLines = [
    `📋 AI Assessment Complete (v${nextVersion})`,
    `Outcome: ${output.recommended_outcome}`,
    ``,
    output.summary,
    ``,
    output.validation_issues.length > 0
      ? `Issues found (${output.validation_issues.length}):\n` +
        output.validation_issues.map((i) => `• [${i.severity}] ${i.description}`).join("\n")
      : "No issues found.",
    ``,
    `Review at: ${process.env.NEXTAUTH_URL}/dashboard/claims/${claimId}`,
  ];

  try {
    await addInternalNote(ticket.ticket_number, noteLines.join("\n"));
  } catch {
    // Don't fail the whole assessment if the note fails
    console.warn(`Failed to add Desk365 note for ticket ${ticket.ticket_number}`);
  }
}

async function failClaim(claimId: string, reason: string): Promise<void> {
  await prisma.$transaction([
    prisma.claim.update({
      where: { id: claimId },
      data: { processingState: "FAILED" },
    }),
    prisma.auditEvent.create({
      data: {
        claimId,
        action: "AI_ASSESSMENT_FAILED",
        reason,
      },
    }),
  ]);
}
