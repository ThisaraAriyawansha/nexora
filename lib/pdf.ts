function findSafeBreakRow(
  ctx: CanvasRenderingContext2D,
  width: number,
  idealY: number,
  searchRangePx: number,
  canvasHeight: number
): number | null {
  const bgThreshold = 250;
  const minWhiteRatio = 0.985;
  const maxOffset = Math.round(searchRangePx);

  for (let offset = 0; offset <= maxOffset; offset++) {
    for (const y of [idealY - offset, idealY + offset]) {
      if (y <= 0 || y >= canvasHeight) continue;
      const row = ctx.getImageData(0, y, width, 1).data;
      let white = 0;
      for (let i = 0; i < row.length; i += 4) {
        if (row[i] >= bgThreshold && row[i + 1] >= bgThreshold && row[i + 2] >= bgThreshold) white++;
      }
      if (white / width >= minWhiteRatio) return y;
    }
  }
  return null;
}

// Shared by downloadElementAsPdf (saves to disk) and getElementPdfBase64
// (attaches to an email) so the two paths can never drift in how they
// paginate/render the element.
async function renderElementToPdf(element: HTMLElement) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
  const ctx = canvas.getContext("2d")!;

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidthMm = pdf.internal.pageSize.getWidth();
  const pageHeightMm = pdf.internal.pageSize.getHeight();

  const pxPerMm = canvas.width / pageWidthMm;
  const pageHeightPx = pageHeightMm * pxPerMm;
  const overflowTolerancePx = 2 * pxPerMm;
  const searchRangePx = 8 * pxPerMm;

  // The captured element already has its own top/bottom padding baked in, so
  // page 1 needs no extra margin. A page break lands wherever content happens
  // to fit though, so continuation pages get an explicit top gap instead of
  // starting flush against the page edge.
  const continuationTopMarginMm = 12;
  const continuationTopMarginPx = continuationTopMarginMm * pxPerMm;

  let currentY = 0;
  let firstPage = true;

  while (canvas.height - currentY > overflowTolerancePx) {
    const topMarginPx = firstPage ? 0 : continuationTopMarginPx;
    const availableHeightPx = pageHeightPx - topMarginPx;
    const idealBreak = Math.min(canvas.height, currentY + availableHeightPx);
    let sliceEnd = idealBreak;

    if (idealBreak < canvas.height) {
      const safeY = findSafeBreakRow(ctx, canvas.width, Math.round(idealBreak), searchRangePx, canvas.height);
      if (safeY !== null && safeY > currentY) sliceEnd = safeY;
    }

    const sliceHeightPx = sliceEnd - currentY;
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeightPx;
    const pageCtx = pageCanvas.getContext("2d")!;
    pageCtx.fillStyle = "#ffffff";
    pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    pageCtx.drawImage(canvas, 0, currentY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);

    const sliceImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
    const sliceHeightMm = sliceHeightPx / pxPerMm;
    const topMarginMm = firstPage ? 0 : continuationTopMarginMm;

    if (!firstPage) pdf.addPage();
    pdf.addImage(sliceImgData, "JPEG", 0, topMarginMm, pageWidthMm, sliceHeightMm);

    currentY = sliceEnd;
    firstPage = false;
  }

  return pdf;
}

export async function downloadElementAsPdf(element: HTMLElement, fileName: string) {
  const pdf = await renderElementToPdf(element);
  pdf.save(fileName);
}

// Raw base64 (no "data:application/pdf;base64," prefix) — ready to hand
// straight to nodemailer's attachment `content` field.
export async function getElementPdfBase64(element: HTMLElement): Promise<string> {
  const pdf = await renderElementToPdf(element);
  const dataUri = pdf.output("datauristring") as string;
  return dataUri.slice(dataUri.indexOf(",") + 1);
}
