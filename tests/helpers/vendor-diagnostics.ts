/** PDF.js ships this upstream graphics-capability diagnostic in its executable
 * runtime. It is not unfinished site copy. Exempt only the exact diagnostic in
 * the PDF.js chunk; all other strings and all privacy checks remain in scope. */
export function withoutPdfDiagnostic(text: string, file: string): string {
  return /(?:^|\/)pdf\.[\w-]+\.js$/.test(file)
    ? text.replaceAll('TODO: Fully support non-isolated non-knockout groups.', 'PDF.js non-isolated non-knockout group diagnostic')
    : text;
}
