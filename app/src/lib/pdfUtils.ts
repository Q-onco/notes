export async function extractPdfText(url: string, maxPages = 25): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).href;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const limit = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];

  for (let i = 1; i <= limit; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) parts.push(`[Page ${i}]\n${pageText}`);
  }

  const full = parts.join('\n\n');
  return pdf.numPages > limit
    ? full + `\n\n[Note: ${pdf.numPages - limit} additional pages not shown]`
    : full;
}
