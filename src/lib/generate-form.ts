import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  PageOrientation,
  convertInchesToTwip,
} from "docx";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FormFields {
  // Claimant (always Kaizer staff)
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

  // Items
  items_damaged: Array<{
    description: string;
    supplier: string;
    age: string;
    purchase_price: string;
    amount_claimed: string;
  }>;
  total_amount_claimed: string;

  // Meta
  organisation_name: string;
  generated_date: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const GRAY = "D9D9D9";
const BORDER = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDERS = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function labelCell(text: string, widthPct = 30): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: GRAY },
    borders: ALL_BORDERS,
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20, font: "Arial" })],
      }),
    ],
  });
}

function valueCell(text: string, widthPct = 70): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: ALL_BORDERS,
    children: [
      new Paragraph({
        children: [new TextRun({ text: text || " ", size: 20, font: "Arial" })],
      }),
    ],
  });
}

function row2(label: string, value: string): TableRow {
  return new TableRow({ children: [labelCell(label), valueCell(value)] });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22,
        font: "Arial",
        color: "FFFFFF",
      }),
    ],
    shading: { type: ShadingType.CLEAR, fill: "1F3864" },
    spacing: { before: 200, after: 100 },
    indent: { left: 100 },
  });
}

function para(text: string, opts?: { bold?: boolean; size?: number; italic?: boolean }): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: opts?.size ?? 20,
        bold: opts?.bold,
        italics: opts?.italic,
      }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

function checkbox(label: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: "☐  ", font: "Arial", size: 20 }),
      new TextRun({ text: label, font: "Arial", size: 20 }),
    ],
    spacing: { before: 60, after: 60 },
  });
}

// ── Main generator ────────────────────────────────────────────────────────────

export async function generateClaimsForm(fields: FormFields): Promise<Buffer> {
  // ── Title block ─────────────────────────────────────────────────────────────
  const titleBlock = [
    new Paragraph({
      children: [new TextRun({ text: "South East Region", font: "Arial", size: 20 })],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Child Related Costs – Individual Placement Support (IPS)",
          font: "Arial",
          size: 20,
          bold: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: "CONTINGENCY - PROPERTY DAMAGE APPLICATION FORM",
          font: "Arial",
          size: 28,
          bold: true,
          color: "1F3864",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
    }),
  ];

  // ── Privacy statement ────────────────────────────────────────────────────────
  const privacyBlock = [
    para(
      "Privacy Statement: The department is collecting your personal information for the purposes of administering the " +
        "'Contingency – Property Damage' claim process. Your personal information will be handled in accordance with the " +
        "Information Privacy Act 2009 (Qld).",
      { italic: true, size: 18 }
    ),
  ];

  // ── Claimant details ─────────────────────────────────────────────────────────
  const claimantTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2800, 6600],
    rows: [
      row2("Full Name:", fields.claimant_name),
      row2("Position:", fields.claimant_position),
      row2("Full Address:", fields.claimant_address),
      row2("Landline:", fields.claimant_phone),
      row2("Email:", fields.claimant_email),
    ],
  });

  // ── Disclaimer ───────────────────────────────────────────────────────────────
  const disclaimerBlock = [
    para(
      "The issue of this form DOES NOT constitute an admission of liability.\n" +
        "All other avenues for compensation (e.g. insurance) must be exhausted before submitting an application.\n" +
        "Where proof or evidence is required, please attach to this claim. Failure to provide may result in a reduced " +
        "settlement amount or rejection of the claim. The department reserves the right to request additional information " +
        "from the claimant to assist in the assessment of the claim.",
      { size: 18, italic: true }
    ),
  ];

  // ── Incident details ─────────────────────────────────────────────────────────
  const incidentTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2800, 6600],
    rows: [
      row2("Date and Time of incident:", fields.incident_datetime),
      row2("Place where the incident occurred:", fields.incident_location),
      new TableRow({
        children: [
          labelCell("Details of the incident (how loss or damage occurred):", 30),
          new TableCell({
            width: { size: 70, type: WidthType.PERCENTAGE },
            borders: ALL_BORDERS,
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: fields.incident_description || " ", size: 20, font: "Arial" }),
                ],
              }),
            ],
          }),
        ],
      }),
      row2("What security was in place at the time?", fields.security_in_place || "Not stated"),
      row2("Name and contact details of any witnesses:", fields.witnesses || "None stated"),
      row2("Has anyone admitted responsibility?", "YES – Young Person"),
      row2("Name of person(s) who caused the damage:", fields.person_responsible),
    ],
  });

  const attachPhotoNote = [checkbox("Please attach evidence of the damage to this application form")];

  // ── Ownership section ────────────────────────────────────────────────────────
  const ownershipTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2800, 6600],
    rows: [
      row2("Do you own the property that was damaged?", "No"),
      row2("If no, provide details of the owner:", fields.property_owner || "Not stated"),
      row2("Any insurance policies covering the damaged property?", "No"),
      row2("Entitled to compensation from any other source?", "No"),
      row2("Actions taken to prevent reoccurrence of this damage:", fields.reoccurrence_prevention || "Not stated"),
    ],
  });

  const attachOwnerNote = [checkbox("Please attach proof of ownership of the property to this application form")];

  // ── Items damaged table ──────────────────────────────────────────────────────
  const itemHeaderRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 5, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Item No.", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 25, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Description of item", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Original Supplier", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 10, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Age", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Purchase Price", bold: true, size: 18, font: "Arial" })] })],
      }),
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        borders: ALL_BORDERS,
        children: [new Paragraph({ children: [new TextRun({ text: "Amount Claimed", bold: true, size: 18, font: "Arial" })] })],
      }),
    ],
  });

  // Pad items to 5 rows
  const paddedItems = [...fields.items_damaged];
  while (paddedItems.length < 5) {
    paddedItems.push({ description: "", supplier: "", age: "", purchase_price: "", amount_claimed: "" });
  }

  const itemRows = paddedItems.slice(0, 5).map((item, i) =>
    new TableRow({
      children: [
        new TableCell({
          width: { size: 5, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: String(i + 1), size: 18, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: item.description || "", size: 18, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: item.supplier || "", size: 18, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 10, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: item.age || "", size: 18, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: item.purchase_price || "", size: 18, font: "Arial" })] })],
        }),
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          borders: ALL_BORDERS,
          children: [new Paragraph({ children: [new TextRun({ text: item.amount_claimed || "", size: 18, font: "Arial" })] })],
        }),
      ],
    })
  );

  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 5,
        borders: ALL_BORDERS,
        shading: { type: ShadingType.CLEAR, fill: GRAY },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "TOTAL AMOUNT CLAIMED:", bold: true, size: 20, font: "Arial" })],
          }),
        ],
      }),
      new TableCell({
        borders: ALL_BORDERS,
        children: [
          new Paragraph({
            children: [new TextRun({ text: fields.total_amount_claimed || "", bold: true, size: 20, font: "Arial" })],
          }),
        ],
      }),
    ],
  });

  const itemsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [475, 2375, 1900, 950, 1900, 1900],
    rows: [itemHeaderRow, ...itemRows, totalRow],
  });

  const attachItemsNote = [
    para(
      "Please attach evidence to support the amount of your claim. Written quotes from 2 different suppliers is preferred. " +
        "Emails, catalogues or internet searches are acceptable for claims under $1000 where the item is common and easily sourced. " +
        "To repair damage, quotes with a breakdown of cost and details of repair is required.",
      { size: 18, italic: true }
    ),
  ];

  // ── NGO section ──────────────────────────────────────────────────────────────
  const ngoBlock = [
    row2("Name of Organisation:", fields.organisation_name),
  ];
  const ngoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [2800, 6600],
    rows: [row2("Name of Organisation:", fields.organisation_name)],
  });

  const ngoNotes = [
    para("The following evidence must be attached to a claim from an NGO:", { bold: true }),
    checkbox("Proof that all other avenues of compensation have been exhausted."),
    checkbox("Details (including date, amount) of any previous special payment claim/s made against the department."),
    checkbox("Reasons why the cost of the damage or loss cannot be met by your organisation/business."),
  ];

  // ── Declaration ──────────────────────────────────────────────────────────────
  const declarationBlock = [
    para(
      "I/We declare that the foregoing details are correct and not misrepresented in any way. " +
        "I/We declare that the application shown above does not include any profit or advantage of any kind and that I/we have not " +
        "wilfully caused the damage or sought unjustly to benefit thereby. " +
        "I am/We are not entitled to compensation for this damage from any other source. " +
        "I/We agree that any settlement of my/our application by the department will be ex-gratia without an admission of liability.",
      { size: 18, italic: true }
    ),
  ];

  const signatureTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [5700, 3700],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: ALL_BORDERS,
            children: [
              new Paragraph({ children: [new TextRun({ text: "Signature of Claimant(s):", bold: true, font: "Arial", size: 20 })] }),
              new Paragraph({ children: [new TextRun({ text: " ", font: "Arial", size: 40 })] }),
            ],
          }),
          new TableCell({
            borders: ALL_BORDERS,
            children: [
              new Paragraph({ children: [new TextRun({ text: `Date: ${fields.generated_date}`, bold: true, font: "Arial", size: 20 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  // ── Checklist ────────────────────────────────────────────────────────────────
  const checklistBlock = [
    para("Checklist – Have you attached?", { bold: true }),
    checkbox("Proof of the damage that has occurred"),
    checkbox("Proof of ownership of the item(s) damaged"),
    checkbox("Proof to substantiate the amount being claimed"),
    checkbox("Proof that other avenues of compensation were rejected (e.g. rejected insurance claim)"),
    para(
      "Please send completed application and supporting documentation (evidence) to the relevant contact at the " +
        "Child Safety Service Centre that the young person is attached to.",
      { size: 18, italic: true }
    ),
  ];

  // ── AI-generated note ─────────────────────────────────────────────────────────
  const aiNote = [
    para(
      `This form was pre-filled by the Claims Portal AI on ${fields.generated_date}. ` +
        "Please verify all details before submission.",
      { size: 16, italic: true }
    ),
  ];

  // ── Assemble document ────────────────────────────────────────────────────────
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 20 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.75),
              bottom: convertInchesToTwip(0.75),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        children: [
          ...titleBlock,
          ...privacyBlock,
          heading("CLAIMANT DETAILS"),
          claimantTable,
          new Paragraph({ spacing: { before: 120, after: 120 }, children: [] }),
          ...disclaimerBlock,
          heading("DETAILS OF INCIDENT THAT LED TO THE PROPERTY DAMAGE"),
          incidentTable,
          ...attachPhotoNote,
          heading("OWNERSHIP OF THE PROPERTY DAMAGED"),
          ownershipTable,
          ...attachOwnerNote,
          heading("LIST OF ITEMS DAMAGED OR DESTROYED"),
          itemsTable,
          ...attachItemsNote,
          heading("TO BE COMPLETED BY NON-GOVERNMENT ORGANISATION (NGO)"),
          ngoTable,
          ...ngoNotes,
          heading("DECLARATION AND SIGNATURE OF CLAIMANT"),
          ...declarationBlock,
          signatureTable,
          ...checklistBlock,
          new Paragraph({ spacing: { before: 200, after: 60 }, children: [] }),
          ...aiNote,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
