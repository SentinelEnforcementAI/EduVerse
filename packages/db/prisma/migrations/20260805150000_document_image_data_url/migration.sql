-- Optional rendered image (data: URL) for a document. Demo case documents carry
-- a styled, sealed image shown in the reader alongside the searchable text.
-- Nullable, so existing documents are unaffected and RLS policies are inherited
-- from the documents table.
ALTER TABLE "documents" ADD COLUMN "image_data_url" TEXT;
