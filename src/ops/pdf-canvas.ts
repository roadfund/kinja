// A small drawing surface for designed documents (invoices, receipts): text, boxes and lines
// on A4 portrait, measured from the top-left. Helvetica only, so no fonts are embedded.

export const A4 = { width: 595, height: 842 };
type Rgb = [number, number, number];
export type TextOptions = { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right" | "center"; maxWidth?: number };

// Standard Helvetica glyph widths (per 1000 units) for characters 32-126.
const REGULAR = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const BOLD = [278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584];

// WinAnsi covers plain ASCII plus the middle dot; anything else is simplified ("é" -> "e", "—" -> "-").
export function pdfText(value: string): string {
  return value.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, "...").replace(/[  ]/g, " ").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7e·]/g, "");
}

export function textWidth(value: string, size: number, bold = false): number {
  const widths = bold ? BOLD : REGULAR;
  let total = 0;
  for (const char of pdfText(value)) total += char === "·" ? 278 : widths[char.charCodeAt(0) - 32] ?? 556;
  return (total * size) / 1000;
}

const escape = (value: string) => pdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/·/g, "\\267");
const rgb = ([r, g, b]: Rgb) => `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`;
export const hex = (value: string): Rgb => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)];

export class PdfCanvas {
  private pages: string[][] = [[]];

  private get ops() { return this.pages[this.pages.length - 1]; }
  private y(top: number) { return A4.height - top; }

  get pageCount() { return this.pages.length; }

  newPage() { this.pages.push([]); }

  // Shortens text with "..." until it fits the width.
  fit(value: string, width: number, size: number, bold = false): string {
    let text = pdfText(value);
    if (textWidth(text, size, bold) <= width) return text;
    while (text.length > 1 && textWidth(`${text}...`, size, bold) > width) text = text.slice(0, -1);
    return `${text.trimEnd()}...`;
  }

  text(x: number, top: number, value: string, { size = 10, bold = false, color = [52, 78, 65], align = "left", maxWidth }: TextOptions = {}) {
    const content = maxWidth ? this.fit(value, maxWidth, size, bold) : pdfText(value);
    const width = textWidth(content, size, bold);
    const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
    // `top` is the top of the line box; the baseline sits about 0.8 of the size below it.
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${rgb(color)} rg ${left.toFixed(2)} ${this.y(top + size * 0.8).toFixed(2)} Td (${escape(content)}) Tj ET`);
  }

  rect(x: number, top: number, width: number, height: number, { fill, stroke, lineWidth = 0.75 }: { fill?: Rgb; stroke?: Rgb; lineWidth?: number }) {
    const path = `${x.toFixed(2)} ${this.y(top + height).toFixed(2)} ${width.toFixed(2)} ${height.toFixed(2)} re`;
    if (fill && stroke) this.ops.push(`${rgb(fill)} rg ${rgb(stroke)} RG ${lineWidth} w ${path} B`);
    else if (fill) this.ops.push(`${rgb(fill)} rg ${path} f`);
    else if (stroke) this.ops.push(`${rgb(stroke)} RG ${lineWidth} w ${path} S`);
  }

  line(x1: number, top1: number, x2: number, top2: number, color: Rgb, lineWidth = 0.75) {
    this.ops.push(`${rgb(color)} RG ${lineWidth} w ${x1.toFixed(2)} ${this.y(top1).toFixed(2)} m ${x2.toFixed(2)} ${this.y(top2).toFixed(2)} l S`);
  }

  // A stamp-like label rotated across the page (e.g. "PAID").
  stamp(x: number, top: number, value: string, color: Rgb, size = 44, angle = 18) {
    const radians = (angle * Math.PI) / 180;
    const [cos, sin] = [Math.cos(radians).toFixed(4), Math.sin(radians).toFixed(4)];
    const width = textWidth(value, size, true);
    this.ops.push(`q ${rgb(color)} RG 2.5 w 1 0 0 1 ${x.toFixed(2)} ${this.y(top).toFixed(2)} cm ${cos} ${sin} ${-sin} ${cos} 0 0 cm -10 -12 ${(width + 20).toFixed(2)} ${(size + 6).toFixed(2)} re S BT /F2 ${size} Tf ${rgb(color)} rg 0 0 Td (${escape(value)}) Tj ET Q`);
  }

  toBytes(footer?: (page: number, count: number) => string): Uint8Array {
    const objects: string[] = [];
    const add = (body: string) => objects.push(body);
    add("<< /Type /Catalog /Pages 2 0 R >>");
    const pageIds = this.pages.map((_, index) => 5 + index * 2 + 1);
    add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    this.pages.forEach((commands, index) => {
      const footerText = footer?.(index + 1, this.pages.length);
      // Paint the page white first: without it, dark-mode PDF viewers show a dark page and hide dark text.
      const stream = [`1 1 1 rg 0 0 ${A4.width} ${A4.height} re f`, ...commands, ...(footerText ? [`BT /F1 8 Tf 0.443 0.502 0.455 rg 40 22 Td (${escape(footerText)}) Tj ET`] : [])].join("\n");
      add(`<< /Length ${new TextEncoder().encode(stream).length} >>\nstream\n${stream}\nendstream`);
      add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objects.length} 0 R >>`);
    });
    let output = "%PDF-1.4\n";
    const offsets: number[] = [];
    objects.forEach((body, index) => { offsets.push(output.length); output += `${index + 1} 0 obj\n${body}\nendobj\n`; });
    const xref = output.length;
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`;
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new TextEncoder().encode(output);
  }
}
