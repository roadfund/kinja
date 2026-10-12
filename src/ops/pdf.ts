// A minimal PDF writer for text tables (exports and monthly reports), so no PDF
// library is needed. A4 landscape, Helvetica, ASCII text.
const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;
const MARGIN = 36;
const LINE = 14;

function ascii(text: string): string {
  return text.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e]/g, "-");
}

function escape(text: string): string {
  return ascii(text).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function fit(text: string, width: number, size: number): string {
  const maxChars = Math.max(3, Math.floor(width / (size * 0.5)));
  const clean = ascii(text);
  return clean.length > maxChars ? `${clean.slice(0, maxChars - 1)}~` : clean;
}

export type PdfSection = { heading?: string; lines?: string[]; table?: { headers: string[]; rows: string[][] } };

export function buildPdf(title: string, subtitle: string, sections: PdfSection[]): Uint8Array {
  const pages: string[][] = [[]];
  let y = PAGE_HEIGHT - MARGIN;
  const page = () => pages[pages.length - 1];
  const text = (x: number, size: number, value: string, bold = false) => page().push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`);
  const advance = (lines = 1) => {
    y -= LINE * lines;
    if (y < MARGIN) { pages.push([]); y = PAGE_HEIGHT - MARGIN; }
  };

  text(MARGIN, 18, title, true); advance(1.5);
  text(MARGIN, 10, subtitle); advance(2);

  for (const section of sections) {
    if (section.heading) { if (y < MARGIN + LINE * 4) { pages.push([]); y = PAGE_HEIGHT - MARGIN; } text(MARGIN, 13, section.heading, true); advance(1.4); }
    for (const line of section.lines ?? []) { text(MARGIN, 10, line); advance(); }
    if (section.table) {
      const { headers, rows } = section.table;
      const width = (PAGE_WIDTH - MARGIN * 2) / headers.length;
      const header = () => { headers.forEach((cell, index) => text(MARGIN + index * width, 9, fit(cell, width - 6, 9), true)); advance(1.2); };
      header();
      for (const row of rows) {
        const startPage = pages.length;
        row.forEach((cell, index) => text(MARGIN + index * width, 9, fit(cell, width - 6, 9)));
        advance();
        if (pages.length !== startPage) header();
      }
      if (rows.length === 0) { text(MARGIN, 9, "No records."); advance(); }
    }
    advance(0.8);
  }

  // Assemble objects: catalog, pages, two fonts, then a content stream and page per page.
  const objects: string[] = [];
  const add = (body: string) => objects.push(body);
  add("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds = pages.map((_, index) => 5 + index * 2 + 1);
  add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  pages.forEach((commands, index) => {
    // White page first, so dark-mode PDF viewers still show dark text on white.
    const stream = `1 1 1 rg 0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT} re f\n0 0 0 rg\n${commands.join("\n")}\nBT /F1 8 Tf ${PAGE_WIDTH - MARGIN - 60} ${MARGIN / 2} Td (Page ${index + 1} of ${pages.length}) Tj ET`;
    add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length} 0 R >>`);
  });

  let output = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = output.length;
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(output);
}

export function toCsv(headers: string[], rows: string[][]): string {
  const cell = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\n");
}
