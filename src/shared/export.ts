// Clipboard and file-download helpers for exporting reports.

/**
 * Copy text to the system clipboard.
 * Returns true on success, false if the Clipboard API is unavailable.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger a file download in the browser.
 *
 * Creates a temporary Blob URL, clicks a hidden `<a>` element, then
 * revokes the URL to free memory.
 */
export function downloadFile(
  filename: string,
  content: string,
  mimeType = "text/markdown",
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Sanitize a string for use in a filename.
 * Replaces whitespace runs with hyphens and strips non-alphanumeric chars.
 */
export function toFilename(name: string, ext = ".md"): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "") + ext
  );
}
