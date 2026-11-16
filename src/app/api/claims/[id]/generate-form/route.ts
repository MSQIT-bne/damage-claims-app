import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateClaimsForm, type FormFields } from "@/lib/generate-form";

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
      assessments: { orderBy: { version: "desc" }, take: 1 },
    },
  });

  if (!claim) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assessment = claim.assessments[0];
  if (!assessment) {
    return NextResponse.json(
      { error: "No assessment found. Run the AI assessment first." },
      { status: 422 }
    );
  }

  // Extract form_fields from assessment rawOutput
  let rawOutput: Record<string, unknown> = {};
  try {
    rawOutput =
      typeof assessment.rawOutput === "string"
        ? JSON.parse(assessment.rawOutput)
        : (assessment.rawOutput as Record<string, unknown>) ?? {};
  } catch {
    // rawOutput stays empty
  }

  const ff = (rawOutput.form_fields ?? {}) as Record<string, unknown>;

  const generatedDate = new Date().toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const fields: FormFields = {
    // Claimant — Kaizer staff defaults; actual submitter name from session
    claimant_name: (session.user.name as string) || "Kaizer Community Staff",
    claimant_position: "Support Worker",
    claimant_address: "106 City Road, Beenleigh QLD 4207",
    claimant_phone: "1800 317 464",
    claimant_email: (session.user.email as string) || "admin@kaizer.com.au",

    // Incident fields from AI assessment
    incident_datetime: (ff.incident_datetime as string) || "Not stated",
    incident_location: (ff.incident_location as string) || "Not stated",
    incident_description: (ff.incident_description as string) || "Not stated",
    security_in_place: (ff.security_in_place as string) || "Not stated",
    witnesses: (ff.witnesses as string) || "None stated",
    person_responsible: (ff.person_responsible as string) || "Not stated",

    // Property
    property_owner: (ff.property_owner as string) || "Not stated",
    reoccurrence_prevention: (ff.reoccurrence_prevention as string) || "Not stated",

    // Items
    items_damaged: Array.isArray(ff.items_damaged)
      ? (ff.items_damaged as FormFields["items_damaged"])
      : [],

    // Meta
    organisation_name: "KAIZER Community",
  };

  const buffer = await generateClaimsForm(fields);

  const filename = `Damage-Claim-${claim.desk365TicketId || id}-${generatedDate.replace(/\//g, "-")}.docx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
