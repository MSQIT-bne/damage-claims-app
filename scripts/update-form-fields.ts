/**
 * Updates form_fields in the latest assessment for claim 3254
 * with actual dollar amounts from the invoices and quote.
 */
import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();
const CLAIM_ID = "cmwiqf78y0000ii7g40n7mhh4";

async function main() {
const assessment = await p.assessment.findFirst({
  where: { claim: { id: CLAIM_ID } },
  orderBy: { version: "desc" },
  select: { id: true, rawOutput: true, version: true },
});

if (!assessment) throw new Error("No assessment found");
console.log("Updating assessment v" + assessment.version);

const raw = (assessment.rawOutput ?? {}) as Record<string, unknown>;

// Updated form_fields with actual invoice amounts
const updatedFormFields = {
  ...(raw.form_fields as Record<string, unknown>),
  items_damaged: [
    {
      description:
        "Urgent wall repair — boarding up wall with exposed wires, living/dining area near power outlet (INV-0591, 18 Oct 2026)",
      supplier: "PKrew Enterprises Pty Ltd",
      age: "New damage (18/10/2026)",
      purchase_price: "356.40",
      amount_claimed: "356.40",
    },
    {
      description:
        "Full plasterboard repair — hallway near garage door, kitchen wall, YP hallway (1m×1.2m), dining room wall (INV-0592, 23–29 Oct 2026)",
      supplier: "PKrew Enterprises Pty Ltd",
      age: "New damage (23/10/2026)",
      purchase_price: "1,453.10",
      amount_claimed: "1,453.10",
    },
  ],
};

await p.assessment.update({
  where: { id: assessment.id },
  data: {
    rawOutput: {
      ...raw,
      form_fields: updatedFormFields,
    },
  },
});

  console.log("Updated form_fields with actual invoice amounts (incl. GST):");
  console.log("  Item 1: INV-0591 — $356.40");
  console.log("  Item 2: INV-0592 — $1,453.10");
}

main().catch(console.error).finally(() => p.$disconnect());
