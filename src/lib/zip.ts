/** Store-only ZIP so the Apps Script kit downloads without extra deps. */
function crc32(buf: Uint8Array) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function u16(n: number) {
  return new Uint8Array([n & 255, (n >>> 8) & 255]);
}
function u32(n: number) {
  return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
}

export function zipStore(files: { name: string; data: Uint8Array }[]) {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    const local = new Uint8Array([
      ...[0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ...u32(crc),
      ...u32(file.data.length),
      ...u32(file.data.length),
      ...u16(name.length),
      ...u16(0),
    ]);
    chunks.push(local, name, file.data);
    const hdr = new Uint8Array([
      ...[0x50, 0x4b, 0x01, 0x02, 0x14, 0, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ...u32(crc),
      ...u32(file.data.length),
      ...u32(file.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ]);
    central.push(hdr, name);
    offset += local.length + name.length + file.data.length;
  }
  const centralSize = central.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array([
    ...[0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0],
    ...u16(files.length),
    ...u16(files.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);
  const total = offset + centralSize + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of [...chunks, ...central, end]) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}

export async function downloadScriptZip() {
  const [gs, manifest, readme] = await Promise.all([
    fetch("/canopy/Code.gs").then((r) => r.arrayBuffer()),
    fetch("/canopy/appsscript.json").then((r) => r.arrayBuffer()),
    Promise.resolve(
      new TextEncoder().encode(`Canopy — Mangools × Google Sheets
Author: MAZ//ID (Maziyar)
Brand: MΛZ

Install
1. New Google Sheet → Extensions → Apps Script
2. Paste Code.gs (replace the stub)
3. Project Settings → Show appsscript.json → paste the manifest
4. Save, reload the sheet, open Canopy → Setup workbook
5. Canopy → Save API key (mangools.com/api-token)

Agents
Deploy → New deployment → Web app.
POST JSON { secret, action, payload } with WEBHOOK_SECRET from Settings.

Actions: quota | read | write | related | bulk | competitor | gap | track | agent | setting

M•Z
`),
    ),
  ]);
  const zip = zipStore([
    { name: "canopy-sheets/Code.gs", data: new Uint8Array(gs) },
    { name: "canopy-sheets/appsscript.json", data: new Uint8Array(manifest) },
    { name: "canopy-sheets/README.txt", data: readme },
  ]);
  const blob = new Blob([zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) as ArrayBuffer], {
    type: "application/zip",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "canopy-sheets.zip";
  a.click();
  URL.revokeObjectURL(url);
}
