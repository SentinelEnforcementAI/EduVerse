"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/trpc/react";

// Common document kinds. Free strings server-side, so this list can grow without
// a migration; "Other" lets the uploader type their own.
const DOC_TYPES = [
  "Letter",
  "Note",
  "Assessment",
  "Record",
  "Report",
  "Referral",
  "Chronology",
  "Policy",
  "Training",
  "Other",
];

// ~3MB of image → ~4.4M base64 chars, matching the server cap.
const MAX_BYTES = 3 * 1024 * 1024;

// Upload a document to the repository (scope ORG) or a concern's case file
// (scope CASE). An optional image file is read to a data URL in the browser; a
// typed note becomes the searchable text of record. Everything is audited and
// tenant-scoped server-side.
export function DocumentUpload({
  scope,
  schoolId,
  signalId,
  label = "Upload document",
}: {
  scope: "ORG" | "CASE";
  schoolId?: string;
  signalId?: string;
  label?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Letter");
  const [customType, setCustomType] = useState("");
  const [note, setNote] = useState("");
  const [fileDataUrl, setFileDataUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const upload = api.documents.uploadDocument.useMutation({
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  function reset() {
    setTitle("");
    setType("Letter");
    setCustomType("");
    setNote("");
    setFileDataUrl(null);
    setFileName(null);
    setFileError(null);
    upload.reset();
    if (fileRef.current) fileRef.current.value = "";
  }

  function onFile(file: File | undefined) {
    setFileError(null);
    if (!file) {
      setFileDataUrl(null);
      setFileName(null);
      return;
    }
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) {
      setFileError("Only PNG, JPEG, WEBP or GIF images can be attached.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFileError("File is too large (max 3MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFileDataUrl(typeof reader.result === "string" ? reader.result : null);
      setFileName(file.name);
    };
    reader.readAsDataURL(file);
  }

  const resolvedType = type === "Other" ? customType.trim() : type;
  const valid =
    title.trim().length >= 2 &&
    resolvedType.length >= 2 &&
    (note.trim().length > 0 || Boolean(fileDataUrl));

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Upload className="size-4" aria-hidden />
        {label}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-ink/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-[14px] border border-[var(--card-border)] bg-card shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--card-border)] px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-cobalt-tint text-cobalt">
                  <Paperclip className="size-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-sm font-[650] leading-tight">{label}</h2>
                  <p className="text-xs text-muted-foreground">
                    {scope === "CASE"
                      ? "Attach to this concern's case file"
                      : "Add to the safeguarding repository"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-muted-foreground hover:bg-paper hover:text-ink"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid && !upload.isPending) {
                  upload.mutate({
                    scope,
                    schoolId,
                    signalId,
                    title: title.trim(),
                    type: resolvedType,
                    note: note.trim() || undefined,
                    fileDataUrl: fileDataUrl ?? undefined,
                    fileName: fileName ?? undefined,
                  });
                }
              }}
              className="space-y-4 px-5 py-4"
            >
              <div>
                <Label htmlFor="du-title">Title</Label>
                <Input
                  id="du-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Letter to parents, 12 Sept"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="du-type">Type</Label>
                  <select
                    id="du-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {DOC_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                {type === "Other" ? (
                  <div>
                    <Label htmlFor="du-custom">Custom type</Label>
                    <Input
                      id="du-custom"
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      placeholder="e.g. Minutes"
                    />
                  </div>
                ) : null}
              </div>

              <div>
                <Label htmlFor="du-note">Note or content</Label>
                <textarea
                  id="du-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  placeholder="Type or paste the document content, or add a short note describing the attached file."
                  className="mt-1 w-full rounded-lg border border-[var(--card-border)] bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div>
                <Label htmlFor="du-file">Attach an image (optional)</Label>
                <input
                  ref={fileRef}
                  id="du-file"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) => onFile(e.target.files?.[0])}
                  className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-cobalt-tint file:px-3 file:py-2 file:text-sm file:font-medium file:text-cobalt hover:file:bg-cobalt-tint/70"
                />
                {fileName ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attached: <span className="text-ink">{fileName}</span>
                  </p>
                ) : null}
                {fileError ? (
                  <p className="mt-1 text-xs text-risk">{fileError}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  PDFs and Office files are supported in production storage; the
                  demo accepts images up to 3MB.
                </p>
              </div>

              {upload.error ? (
                <p className="rounded-lg bg-risk-tint px-3 py-2 text-sm text-risk">
                  {upload.error.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-paper hover:text-ink"
                >
                  Cancel
                </button>
                <Button type="submit" size="sm" disabled={!valid || upload.isPending}>
                  {upload.isPending ? "Uploading…" : "Upload"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
