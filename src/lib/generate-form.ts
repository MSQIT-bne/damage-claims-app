/**
 * Fills the original government "Contingency Property Damage Application Form"
 * DOCX by directly replacing SDT (content control) values in the XML.
 *
 * The original form has 52 SDT blocks; the ones below are editable fields.
 * Fixed SDTs (checkboxes, YES/No responses) are left untouched.
 */
import PizZip from "pizzip";
import fs from "fs";
import path from "path";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormFields {
  // Claimant
  claimant_name: string;
  claimant_position: string;
  claimant_address: string;
  claimant_phone: string;
  claimant_email: string;

  // Incident
  incident_datetime: string;
  incident_location: string;
  incident_description: string;
  security_in_place: string;
  witnesses: string;
  person_responsible: string;

  // Property
  property_owner: string;
  reoccurrence_prevention: string;

  // Items (up to 5)
  items_damaged: Array<{
    description: string;
    supplier: string;
    age: string;
    purchase_price: string;
    amount_claimed: string;
  }>;

  // Meta
  organisation_name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Strip leading `$` / `$ ` so values sit after the form's existing `$ ` prefix */
function stripDollar(s: string): string {
  return (s || "").replace(/^\$\s*/, "").trim();
}

/**
 * Replace text runs inside the nth `<w:sdtContent>` block (0-based).
 * Puts `text` in the first <w:t>, clears all subsequent <w:t> in the same block.
 * If no <w:t> exists (empty SDT), injects a new run.
 */
function replaceSdtText(xml: string, idx: number, text: string): string {
  let n = 0;
  const e = esc(text);
  return xml.replace(
    /(<w:sdtContent>)([\s\S]*?)(<\/w:sdtContent>)/g,
    (m, open, content, close) => {
      if (n++ !== idx) return m;
      let first = true;
      const newContent = content.replace(
        /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g,
        () => {
          if (first) {
            first = false;
            return `<w:t xml:space="preserve">${e}</w:t>`;
          }
          return `<w:t></w:t>`;
        }
      );
      if (first) {
        // No <w:t> found — inject a bare run (empty SDTs like the total field)
        return `${open}<w:r><w:t xml:space="preserve">${e}</w:t></w:r>${close}`;
      }
      return `${open}${newContent}${close}`;
    }
  );
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateClaimsForm(fields: FormFields): Promise<Buffer> {
  const templatePath = path.resolve(
    process.cwd(),
    "src/assets/claims-form-template.docx"
  );
  const templateBytes = fs.readFileSync(templatePath);
  const zip = new PizZip(templateBytes as unknown as string);

  let xml = zip.file("word/document.xml")!.asText();

  // ── Fix page margins: template tables are ~10,919 twips wide but the
  //    original margins (left=567, right=567) only give 10,772 twips of content
  //    width, causing overflow. Set left=454, right=454 → content=10,998 twips.
  xml = xml.replace(
    /<w:pgMar([^>]*)w:left="[^"]*"([^>]*)w:right="[^"]*"([^>]*)\/?>/,
    (m) => m.replace(/w:left="[^"]*"/, 'w:left="454"').replace(/w:right="[^"]*"/, 'w:right="454"')
  );

  // ── Global cleanup: remove placeholder indicators ─────────────────────────
  xml = xml.replace(/<w:showingPlcHdr\/>/g, "");
  xml = xml.replace(/<w:rStyle w:val="PlaceholderText"\/>/g, "");

  // ── SDT 0: Claimant name ──────────────────────────────────────────────────
  xml = replaceSdtText(xml, 0, fields.claimant_name);

  // ── SDT 1: Position ───────────────────────────────────────────────────────
  xml = replaceSdtText(xml, 1, fields.claimant_position);

  // ── SDT 2: Address ────────────────────────────────────────────────────────
  xml = replaceSdtText(xml, 2, fields.claimant_address);

  // ── SDT 3: Phone ──────────────────────────────────────────────────────────
  xml = replaceSdtText(xml, 3, fields.claimant_phone);

  // ── SDT 4: Email (3 runs: "Sui-jean" | "@kaizer." | "com.au") ────────────
  xml = replaceSdtText(xml, 4, fields.claimant_email);

  // ── SDT 5: Date and time of incident ─────────────────────────────────────
  xml = replaceSdtText(xml, 5, fields.incident_datetime);

  // ── SDT 6: Place where incident occurred ─────────────────────────────────
  xml = replaceSdtText(xml, 6, fields.incident_location);

  // ── SDT 7: Details of incident (table-cell SDT) ───────────────────────────
  xml = replaceSdtText(xml, 7, fields.incident_description);

  // ── SDT 8: Security in place ──────────────────────────────────────────────
  xml = replaceSdtText(xml, 8, fields.security_in_place);

  // ── SDT 9: Witnesses ──────────────────────────────────────────────────────
  xml = replaceSdtText(xml, 9, fields.witnesses);

  // SDT 10: "YES" (fixed — has anyone admitted responsibility)
  // SDT 11: "Young Person(s)" (fixed)

  // ── SDT 12: Person responsible ───────────────────────────────────────────
  xml = replaceSdtText(xml, 12, fields.person_responsible);

  // SDT 13: ☐ (fixed checkbox)
  // SDT 14: " No" (fixed — do you own the property)

  // ── SDT 15: Property owner ────────────────────────────────────────────────
  xml = replaceSdtText(xml, 15, fields.property_owner);

  // SDT 16: "No" (fixed — insurance)
  // SDT 17: "N/A" (fixed)
  // SDT 18: "No" (fixed — other compensation)

  // ── SDT 19: Reoccurrence prevention ──────────────────────────────────────
  xml = replaceSdtText(xml, 19, fields.reoccurrence_prevention);

  // SDT 20: ☐ (fixed checkbox)

  // ── Items (SDTs 21–45, 5 items × 5 fields each) ──────────────────────────
  const itemBase = 21; // SDT 21 = item 1 description
  for (let i = 0; i < 5; i++) {
    const item = fields.items_damaged[i] ?? {
      description: "",
      supplier: "",
      age: "",
      purchase_price: "",
      amount_claimed: "",
    };
    const base = itemBase + i * 5;
    xml = replaceSdtText(xml, base + 0, item.description);
    xml = replaceSdtText(xml, base + 1, item.supplier);
    xml = replaceSdtText(xml, base + 2, item.age);
    xml = replaceSdtText(xml, base + 3, stripDollar(item.purchase_price));
    xml = replaceSdtText(xml, base + 4, stripDollar(item.amount_claimed));
  }

  // ── Total amount: computed sum of amount_claimed column ──────────────────
  // The total SDT uses self-closing <w:sdtContent/> so the index-based
  // replaceSdtText won't reach it. Replace it directly.
  const parseAmount = (s: string): number =>
    parseFloat((s || "0").replace(/[^0-9.]/g, "")) || 0;
  const totalComputed = fields.items_damaged.reduce(
    (sum, item) => sum + parseAmount(item.amount_claimed),
    0
  );
  const totalStr = totalComputed
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  xml = xml.replace(
    /<w:sdtContent\/>/g,
    `<w:sdtContent><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(totalStr)}</w:t></w:r></w:sdtContent>`
  );

  // SDT 46: ☐ (fixed checkbox — please attach evidence)

  // ── SDT 47: Organisation name ─────────────────────────────────────────────
  xml = replaceSdtText(xml, 47, fields.organisation_name);

  // SDT 49–52: ☐ (fixed checkboxes — NGO evidence checklist)

  // ── Write back and pack ───────────────────────────────────────────────────
  zip.file("word/document.xml", xml);

  const output = zip.generate({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return output as Buffer;
}
