/**
 * Tiny synthetic PDF builders for tests. No real notes, no large binaries.
 *
 * `makeSyntheticPdf()` produces a minimal but genuinely parseable multi-page
 * PDF (valid header, xref table, trailer) that PDF.js opens and reports the
 * correct page count for. The other helpers return deliberately broken inputs.
 */

/** A minimal, valid, N-page PDF. `label` goes in the document Info title. */
export function makeSyntheticPdf(pageCount = 1, label = 'Synthetic test document'): Buffer {
  if (!Number.isInteger(pageCount) || pageCount < 1) {
    throw new Error('pageCount must be a positive integer');
  }

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');

  const kids: string[] = [];
  for (let i = 0; i < pageCount; i += 1) kids.push(`${3 + i} 0 R`);
  objects.push(`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`);

  for (let i = 0; i < pageCount; i += 1) {
    objects.push(
      '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] ' +
        '/Resources << /Font << /F1 ' +
        `${3 + pageCount} 0 R >> >> /Contents ${4 + pageCount + i} 0 R >>`,
    );
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (let i = 0; i < pageCount; i += 1) {
    const stream = `BT /F1 18 Tf 40 340 Td (Page ${i + 1}) Tj ET`;
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }

  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n`;
  body += '0000000000 65535 f \n';
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R ` +
    `/Info << /Title (${label}) >> >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(body, 'latin1');
}

/** Bytes that are not a PDF at all (no `%PDF-` header). */
export function makeNonPdf(): Buffer {
  return Buffer.from('This is a plain text file pretending to be a PDF.\n', 'utf8');
}

/** Has the header but the structure is broken — PDF.js fails to parse it. */
export function makeCorruptPdf(): Buffer {
  return Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n1 0 obj\n<< /Type /Catalog', 'latin1');
}

/** Zero bytes. */
export function makeEmptyPdf(): Buffer {
  return Buffer.alloc(0);
}

/**
 * A structurally valid PDF whose page tree has `/Count 0` and no kids.
 * PDF.js opens it but reports zero pages.
 */
export function makeZeroPagePdf(): Buffer {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [] /Count 0 >>'];
  let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets: number[] = [];
  objects.forEach((obj, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
