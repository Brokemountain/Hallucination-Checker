import { NextResponse } from "next/server";

import { type ReviewDocumentFormat, type ReviewInputDocument } from "../../../../lib/legal-review/contracts";
import { LegalReviewError, toErrorResponse } from "../../../../lib/legal-review/errors";
import { createReviewSession } from "../../../../lib/legal-review/service";

export const runtime = "nodejs";

const maxFiles = 10;
const maxFileBytes = 12 * 1024 * 1024;

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function inferFormat(fileName: string): ReviewDocumentFormat {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (extension === "docx") {
    return "DOCX";
  }

  if (extension === "pdf") {
    return "PDF";
  }

  if (extension === "md" || extension === "markdown") {
    return "Markdown";
  }

  if (extension === "html" || extension === "htm") {
    return "HTML";
  }

  return "Text";
}

async function extractPdfText(buffer: Buffer) {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const result = await pdfParse(buffer);
  return result.text;
}

async function extractFileText(file: File) {
  if (file.size > maxFileBytes) {
    throw new LegalReviewError(
      "FILE_TOO_LARGE",
      `${file.name} is larger than the 12 MB upload limit.`,
      413,
    );
  }

  const format = inferFormat(file.name);

  if (format === "DOCX") {
    const mammoth = await import("mammoth");
    const result = await mammoth.default.extractRawText({
      buffer: Buffer.from(await file.arrayBuffer()),
    });
    return result.value.trim();
  }

  if (format === "PDF") {
    return (await extractPdfText(Buffer.from(await file.arrayBuffer()))).trim();
  }

  const text = await file.text();

  if (format === "HTML") {
    return stripHtml(text);
  }

  return text.trim();
}

function requireText(value: FormDataEntryValue | null, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LegalReviewError(
      "INVALID_REQUEST",
      `${fieldName} is required for a file review session.`,
    );
  }

  return value.trim();
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const matterName = requireText(formData.get("matterName"), "matterName");
    const owner = formData.get("owner");
    const notes = formData.get("notes");
    const uploadedFiles = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (uploadedFiles.length > maxFiles) {
      throw new LegalReviewError(
        "TOO_MANY_FILES",
        `Upload at most ${maxFiles} files per review session.`,
      );
    }

    const documents: ReviewInputDocument[] = [];

    for (const file of uploadedFiles) {
      let text = "";

      try {
        text = await extractFileText(file);
      } catch (error) {
        throw new LegalReviewError(
          "FILE_EXTRACTION_FAILED",
          `${file.name} could not be read. ${error instanceof Error ? error.message : "Try DOCX, TXT, Markdown, HTML, or a text-based PDF."}`,
        );
      }

      if (text.length < 20) {
        throw new LegalReviewError(
          "NO_EXTRACTABLE_TEXT",
          `${file.name} did not contain enough extractable text for citation review.`,
        );
      }

      documents.push({
        name: file.name,
        format: inferFormat(file.name),
        text,
      });
    }

    if (typeof notes === "string" && notes.trim().length > 0) {
      documents.push({
        name: "Pasted notes",
        format: "Text",
        text: notes.trim(),
      });
    }

    if (documents.length === 0) {
      throw new LegalReviewError(
        "NO_DOCUMENTS",
        "Drop at least one file or paste review text before starting.",
      );
    }

    const session = await createReviewSession({
      matterName,
      owner: typeof owner === "string" && owner.trim() ? owner.trim() : undefined,
      documents,
    });

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
