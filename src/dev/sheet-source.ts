import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Reads every tab of a shared Google Sheet as CSV (dev tools only). Tabs are fetched through
// the sheet's public export, and cached under .data/ (git-ignored) so a demo works offline.

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index++; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(cell); cell = ""; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export function sheetIdFrom(urlOrId: string): string {
  const match = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(urlOrId);
  const id = match ? match[1] : urlOrId.trim();
  if (!/^[a-zA-Z0-9_-]{20,}$/.test(id)) throw new Error("Paste a Google Sheets link or ID");
  return id;
}

const cacheDir = (sheetId: string) => join(process.cwd(), ".data", "import", sheetId);

// Downloads all tabs (refreshing the cache); falls back to the cache when offline.
export async function loadSheetTabs(sheetId: string): Promise<{ tabs: string[][][]; fromCache: boolean }> {
  const dir = cacheDir(sheetId);
  try {
    const page = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/htmlview`);
    if (!page.ok) throw new Error(`Google Sheets answered ${page.status}. Is the sheet shared as "Anyone with the link"?`);
    const gids = [...new Set([...(await page.text()).matchAll(/gid=(\d+)/g)].map((match) => match[1]))];
    if (gids.length === 0) throw new Error("No tabs found in that sheet");
    mkdirSync(dir, { recursive: true });
    const tabs: string[][][] = [];
    for (const gid of gids) {
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`);
      if (!response.ok) continue;
      const text = await response.text();
      writeFileSync(join(dir, `tab-${gid}.csv`), text);
      tabs.push(parseCsv(text));
    }
    return { tabs, fromCache: false };
  } catch (error) {
    if (!existsSync(dir)) throw error;
    return { tabs: readdirSync(dir).filter((file) => file.endsWith(".csv")).map((file) => parseCsv(readFileSync(join(dir, file), "utf8"))), fromCache: true };
  }
}
