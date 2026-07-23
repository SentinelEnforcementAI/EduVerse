"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

// Download a document as plain text (spec 5.10).
export function DownloadButton({
  title,
  content,
}: {
  title: string;
  content: string;
}) {
  function download() {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={download}>
      <Download className="size-4" aria-hidden />
      Download
    </Button>
  );
}
