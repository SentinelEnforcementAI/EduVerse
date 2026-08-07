import { describe, expect, it } from "vitest";

import {
  composeContent,
  dataUrlToBytes,
  isOcrCandidate,
  linesFromBlocks,
} from "./ocr";

// A 1x1 PNG as a base64 data URL — enough to exercise the decoder.
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

describe("dataUrlToBytes", () => {
  it("decodes a base64 image data URL to bytes", () => {
    const decoded = dataUrlToBytes(PNG_1x1);
    expect(decoded).not.toBeNull();
    expect(decoded!.mime).toBe("image/png");
    expect(decoded!.bytes.length).toBeGreaterThan(0);
  });

  it("returns null for a non-data-URL string", () => {
    expect(dataUrlToBytes("https://example.com/x.png")).toBeNull();
    expect(dataUrlToBytes("not a url")).toBeNull();
  });
});

describe("isOcrCandidate", () => {
  it("accepts PNG and JPEG only", () => {
    expect(isOcrCandidate(PNG_1x1)).toBe(true);
    expect(isOcrCandidate("data:image/jpeg;base64,/9j/4AAQSkZJRg==")).toBe(true);
    // WEBP and GIF are filed as images but not sent to Textract.
    expect(isOcrCandidate("data:image/webp;base64,UklGRg==")).toBe(false);
    expect(isOcrCandidate("data:image/gif;base64,R0lGODlh")).toBe(false);
  });
});

describe("linesFromBlocks", () => {
  it("joins LINE blocks in order and ignores non-LINE blocks", () => {
    const text = linesFromBlocks([
      { BlockType: "PAGE" },
      { BlockType: "LINE", Text: "Dear parent," },
      { BlockType: "WORD", Text: "Dear" },
      { BlockType: "LINE", Text: "We are writing to you about attendance." },
      { BlockType: "LINE", Text: "   " },
    ]);
    expect(text).toBe(
      "Dear parent,\nWe are writing to you about attendance.",
    );
  });

  it("returns an empty string when there are no blocks", () => {
    expect(linesFromBlocks(undefined)).toBe("");
    expect(linesFromBlocks([])).toBe("");
  });
});

describe("composeContent", () => {
  it("labels OCR text as machine-read and keeps the note", () => {
    const { content, summary, ocrApplied } = composeContent(
      "Filed by the DSL.",
      "Line one\nLine two",
    );
    expect(ocrApplied).toBe(true);
    expect(content).toContain("Filed by the DSL.");
    expect(content).toContain("OCR");
    expect(content).toContain("Line one");
    expect(summary).toBe("Filed by the DSL.");
  });

  it("uses the OCR text as content when there is no note", () => {
    const { content, summary, ocrApplied } = composeContent(
      undefined,
      "Scanned body text",
    );
    expect(ocrApplied).toBe(true);
    expect(content).toContain("Scanned body text");
    expect(summary).toBe("Scanned body text");
  });

  it("is note-only when there is no OCR text", () => {
    const { content, summary, ocrApplied } = composeContent("Just a note", null);
    expect(ocrApplied).toBe(false);
    expect(content).toBe("Just a note");
    expect(summary).toBe("Just a note");
  });
});
