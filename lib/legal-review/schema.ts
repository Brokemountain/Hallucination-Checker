import { ZodError, z } from "zod";

import {
  type CreateReviewSessionInput,
  type ExportRequest,
  type ReviewDocumentFormat,
  type ScopedActionRequest,
} from "./contracts";
import { LegalReviewError } from "./errors";

const reviewDocumentFormatSchema = z.enum([
  "DOCX",
  "PDF",
  "Markdown",
  "Text",
  "HTML",
]) satisfies z.ZodType<ReviewDocumentFormat>;

const reviewInputDocumentSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    format: reviewDocumentFormatSchema,
    text: z.string().trim().min(20).max(100_000),
  })
  .strict();

export const createReviewSessionSchema = z
  .object({
    matterName: z.string().trim().min(3).max(160),
    owner: z.string().trim().min(2).max(120).optional(),
    documents: z.array(reviewInputDocumentSchema).min(1).max(10),
  })
  .strict() satisfies z.ZodType<CreateReviewSessionInput>;

export const scopedActionSchema = z
  .object({
    documentId: z.uuid().optional(),
  })
  .strict() satisfies z.ZodType<ScopedActionRequest>;

export const exportRequestSchema = scopedActionSchema
  .extend({
    format: z.enum(["html", "csv", "json"]),
  })
  .strict() satisfies z.ZodType<ExportRequest>;

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let json: unknown;

  try {
    const body = await request.text();
    json = body.trim() ? JSON.parse(body) : {};
  } catch {
    throw new LegalReviewError("INVALID_JSON", "Request body must be valid JSON.");
  }

  try {
    return schema.parse(json);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new LegalReviewError(
        "INVALID_REQUEST",
        "Request payload failed validation.",
        400,
        error.flatten(),
      );
    }

    throw error;
  }
}
