declare module "pdf-parse" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;

  export = pdfParse;
}

declare module "pdf-parse/lib/pdf-parse.js" {
  type PdfParseResult = {
    text: string;
    numpages: number;
    numrender: number;
    info?: unknown;
    metadata?: unknown;
    version?: string;
  };

  function pdfParse(dataBuffer: Buffer): Promise<PdfParseResult>;

  export = pdfParse;
}
