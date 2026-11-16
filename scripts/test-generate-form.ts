import { PrismaClient } from "@prisma/client";
import { generateClaimsForm, type FormFields } from "../src/lib/generate-form";
import * as fs from "fs";
import * as path from "path";

const p = new PrismaClient();

async function main() {
  const claimId = "cmwiqf78y0000ii7g40n7mhh4";

  const claim = await p.claim.findUnique({
    where: { id: claimId },
    include: { assessments: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!claim) throw new Error("Claim not found");

  const assessment = claim.assessments[0];
  if (!assessment) throw new Error("No assessment found");

  const rawOutput = (assessment.rawOutput ?? {}) as Record<string, unknown>;
  const ff = (rawOutput.form_fields ?? {}) as Record<string, unknown>;

  const fields: FormFields = {
    claimant_name: "Sui-Jean Fuimaono",
    claimant_position: "Accounts Officer",
    claimant_address: "106 City Road, Beenleigh QLD 4207",
    claimant_phone: "1800 317 464",
    claimant_email: "sui-jean@kaizer.com.au",

    incident_datetime: (ff.incident_datetime as string) || "Not stated",
    incident_location: (ff.incident_location as string) || "Not stated",
    incident_description: (ff.incident_description as string) || "Not stated",
    security_in_place: (ff.security_in_place as string) || "Not stated",
    witnesses: (ff.witnesses as string) || "None stated",
    person_responsible: (ff.person_responsible as string) || "Not stated",

    property_owner: (ff.property_owner as string) || "Not stated",
    reoccurrence_prevention: (ff.reoccurrence_prevention as string) || "Not stated",

    items_damaged: Array.isArray(ff.items_damaged)
      ? (ff.items_damaged as FormFields["items_damaged"])
      : [],
    organisation_name: "KAIZER Community",
  };

  console.log("Generating form…");
  const buffer = await generateClaimsForm(fields);

  const date = new Date().toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\//g, "-");
  const outPath = path.resolve(__dirname, `../Damage-Claim-HD3254-template-${Date.now()}.docx`);
  fs.writeFileSync(outPath, buffer);
  console.log(`Written to: ${outPath}`);
  console.log(`Size: ${buffer.length} bytes`);
}

main().catch(console.error).finally(() => p.$disconnect());
