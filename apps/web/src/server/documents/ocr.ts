import {
  DetectDocumentTextCommand,
  TextractClient,
} from "@aws-sdk/client-textract";

// OCR for uploaded document images. Runs on AWS Textract in eu-west-2, so the
// document bytes never leave UK infrastructure (data-residency principle). The
// extracted text becomes the document's searchable, human-readable content —
// clearly labelled as machine-read, never presented as a verified transcript.
//
// Textract's synchronous DetectDocumentText accepts single-page PNG or JPEG
// images only. Anything else (WEBP, GIF, multi-page PDF) is skipped here; PDF
// and Office extraction is a later slice on Textract's async API.

const OCR_REGION = process.env.AWS_REGION ?? "eu-west-2";

// Formats Textract's synchronous API accepts. WEBP/GIF are filed as images
// without extracted text rather than sent and rejected.
const OCR_MIME = /^image\/(png|jpe?g)$/;

export type ImageBytes = { bytes: Uint8Array; mime: string };

// Decode a `data:<mime>;base64,<payload>` URL into raw bytes. Returns null for
// anything that is not a base64 data URL, so callers can fall back cleanly.
export function dataUrlToBytes(dataUrl: string): ImageBytes | null {
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1]!.toLowerCase();
  try {
    const bytes = new Uint8Array(Buffer.from(match[2]!, "base64"));
    if (bytes.length === 0) return null;
    return { bytes, mime };
  } catch {
    return null;
  }
}

// Whether an OCR attempt is worth making for this data URL: a decodable PNG or
// JPEG. Pure, so it can be unit-tested without the network.
export function isOcrCandidate(dataUrl: string): boolean {
  const decoded = dataUrlToBytes(dataUrl);
  return decoded !== null && OCR_MIME.test(decoded.mime);
}

// Join Textract's LINE blocks into readable text, preserving line order. Pure,
// so the joining logic is tested without calling AWS.
export function linesFromBlocks(
  blocks: { BlockType?: string; Text?: string }[] | undefined,
): string {
  if (!blocks) return "";
  return blocks
    .filter((b) => b.BlockType === "LINE" && typeof b.Text === "string")
    .map((b) => b.Text!.trim())
    .filter((t) => t.length > 0)
    .join("\n");
}

let client: TextractClient | null = null;
function textract(): TextractClient {
  client ??= new TextractClient({ region: OCR_REGION });
  return client;
}

// Extract text from a document image, or null if OCR is not possible (wrong
// format, no credentials, service error, or no text found). Never throws — a
// failed extraction must not fail the upload; the image is still filed.
export async function extractTextFromImage(
  dataUrl: string,
): Promise<string | null> {
  if (process.env.OCR_DISABLED === "1") return null;
  const decoded = dataUrlToBytes(dataUrl);
  if (!decoded || !OCR_MIME.test(decoded.mime)) return null;

  try {
    const out = await textract().send(
      new DetectDocumentTextCommand({
        Document: { Bytes: decoded.bytes },
      }),
    );
    const text = linesFromBlocks(out.Blocks);
    return text.length > 0 ? text : null;
  } catch {
    // No credentials (local/CI), throttling, or a service error: fall back to
    // filing the image without extracted text.
    return null;
  }
}

// Compose the stored document content from the DSL's typed note (if any) and
// any OCR-extracted text, labelling machine-read text so it is never mistaken
// for a verified transcript (explainability principle).
export function composeContent(note: string | undefined, ocr: string | null): {
  content: string;
  summary: string;
  ocrApplied: boolean;
} {
  const trimmedNote = note?.trim();
  if (ocr) {
    const label =
      "Text read from the uploaded image by OCR (machine-read — check against the original before relying on it).";
    const content = trimmedNote
      ? `${trimmedNote}\n\n--- ${label} ---\n${ocr}`
      : `${label}\n\n${ocr}`;
    const summary = (trimmedNote || ocr).replace(/\s+/g, " ").slice(0, 200);
    return { content, summary, ocrApplied: true };
  }
  return {
    content: trimmedNote ?? "",
    summary: (trimmedNote ?? "").replace(/\s+/g, " ").slice(0, 200),
    ocrApplied: false,
  };
}
