/**
 * ブラウザ上でのCSVダウンロード。Excel が UTF-8 と判定できるよう BOM を付ける。
 */

export function downloadUtf8Csv(filename: string, rows: string[]): void {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
  const blob = new Blob([bom, rows.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
