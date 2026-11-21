// Сваля всички листове (.sheet) от страницата като един PDF: всеки лист е отделна страница A4,
// с правилната ориентация (вертикален или хоризонтален лист). Не зависи от прозореца за печат.
// html-to-image рисува листа със самия браузър (през SVG), затова шрифтовете, линиите и
// разстоянията излизат точно като на екрана. Библиотеките се зареждат при първото натискане.
const PDF_LIBS = [
  ["htmlToImage", "https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.js"],
  ["jspdf", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"],
];

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("не се зареди " + src));
    document.head.appendChild(s);
  });
}

async function downloadPdf(btn, filename) {
  const label = btn.textContent;
  btn.disabled = true;
  try {
    for (const [name, src] of PDF_LIBS) if (!window[name]) await loadScript(src);
    await document.fonts.ready;
    const sheets = [...document.querySelectorAll(".sheet")].filter((s) => s.offsetParent !== null);
    if (!sheets.length) throw new Error("няма листове за сваляне");

    btn.textContent = "PDF: подготвям шрифтовете…";
    // Шрифтовете се вграждат веднъж, а не за всеки лист.
    const fontEmbedCSS = await window.htmlToImage.getFontEmbedCSS(sheets[0]);
    const { jsPDF } = window.jspdf;
    let pdf = null;
    for (const [i, sheet] of sheets.entries()) {
      btn.textContent = `PDF: ${i + 1} от ${sheets.length}…`;
      const land = sheet.offsetWidth > sheet.offsetHeight;
      const orientation = land ? "landscape" : "portrait";
      // Около 200 dpi: остро на печат, а файлът остава разумно голям.
      const img = await window.htmlToImage.toJpeg(sheet, {
        pixelRatio: 2.2, quality: 0.9, backgroundColor: "#ffffff", fontEmbedCSS,
        style: { margin: "0" },
      });
      if (!pdf) pdf = new jsPDF({ orientation, unit: "mm", format: "a4", compress: true });
      else pdf.addPage("a4", orientation);
      const [w, h] = land ? [297, 210] : [210, 297];
      pdf.addImage(img, "JPEG", 0, 0, w, h, undefined, "FAST");
    }
    pdf.save(filename);
  } catch (e) {
    alert("Не успях да направя PDF: " + (e?.message || e));
  } finally {
    btn.disabled = false;
    btn.textContent = label;
  }
}
