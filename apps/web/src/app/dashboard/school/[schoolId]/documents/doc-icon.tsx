import {
  BookText,
  ClipboardList,
  FileCheck2,
  FileText,
  GraduationCap,
} from "lucide-react";

// A document's type sets its icon, so the vault and reader read at a glance.
// Returns the icon element directly (no component assigned in render).
export function DocTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const t = type.toLowerCase();
  if (t.includes("policy"))
    return <BookText className={className} aria-hidden />;
  if (t.includes("training"))
    return <GraduationCap className={className} aria-hidden />;
  if (t.includes("record"))
    return <ClipboardList className={className} aria-hidden />;
  if (t.includes("return"))
    return <FileCheck2 className={className} aria-hidden />;
  return <FileText className={className} aria-hidden />;
}
