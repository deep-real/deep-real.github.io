export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export const POSITION_LABELS = { phd: "PhD", postdoc: "Postdoc", student: "UVA-Student" } as const;
export const RESEARCH_LABELS = {
  methods: "Trustworthy Machine Learning",
  applications: "Trustworthy AI in the Real World",
  both: "Both Methods and Applications",
} as const;
export type Position = keyof typeof POSITION_LABELS;
export type Application = {
  position: Position;
  name: string;
  email: string;
  bsSchool: string;
  bsMajor: string;
  bsYear: string;
  msSchool: string;
  msMajor: string;
  msYear: string;
  phdSchool: string;
  phdMajor: string;
  phdYear: string;
  start: string;
  availability: string;
  researchInterest: keyof typeof RESEARCH_LABELS;
  profileUrl: string;
  experience: string;
};
export type UploadedDocument = { field: "cv" | "supplemental"; name: string; contentType: string; bytes: Uint8Array };
export type StoredDocument = { field: "cv" | "supplemental"; name: string; key: string; size: number; contentType: string };

export class ValidationError extends Error {}

export function validateFields(form: FormData): Application {
  const value = (key: string, max: number, required = false) => {
    const item = form.get(key);
    if (item !== null && typeof item !== "string") throw new ValidationError(`Invalid ${key}.`);
    const text = (item || "").trim();
    if (required && !text) throw new ValidationError(`Missing ${key === "name" ? "name" : key}.`);
    if (text.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) throw new ValidationError(`Invalid ${key}.`);
    return text;
  };
  if (value("website", 500)) throw new ValidationError("We could not submit your application. Please try again.");
  const position = value("position", 20) as Position;
  if (!Object.hasOwn(POSITION_LABELS, position)) throw new ValidationError("Please choose a valid application type.");
  const result: Application = {
    position,
    name: value("name", 120, true),
    email: value("email", 180, true),
    bsSchool: value("bsSchool", 180, true),
    bsMajor: value("bsMajor", 120, true),
    bsYear: value("bsYear", 40, true),
    msSchool: value("msSchool", 180), msMajor: value("msMajor", 120), msYear: value("msYear", 40),
    phdSchool: position === "postdoc" ? value("phdSchool", 180, true) : "",
    phdMajor: position === "postdoc" ? value("phdMajor", 120, true) : "",
    phdYear: position === "postdoc" ? value("phdYear", 40, true) : "",
    start: value("start", 40, true),
    availability: position === "student" ? value("availability", 40, true) : "",
    researchInterest: value("researchInterest", 40, true) as Application["researchInterest"],
    profileUrl: value("profileUrl", 500),
    experience: value("experience", 1200, true),
  };
  for (const key of ["name", "bsSchool", "bsMajor", ...(position === "postdoc" ? ["phdSchool", "phdMajor"] : [])] as (keyof Application)[]) {
    if (result[key].length < 2) throw new ValidationError(`Please complete ${key}.`);
  }
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(result.email)) throw new ValidationError("Please enter a valid email address.");
  const ms = [result.msSchool, result.msMajor, result.msYear];
  if (ms.some(Boolean) && !ms.every(Boolean)) throw new ValidationError("Complete all three MS fields, or leave all three blank.");
  const starts = ["spring-2027", "fall-2027", "flexible", ...(position === "student" ? ["this-semester"] : [])];
  if (!starts.includes(result.start)) throw new ValidationError("Please select a preferred start.");
  if (position === "student" && !["under-5", "5-10", "10-15", "15-plus"].includes(result.availability)) throw new ValidationError("Please select your weekly availability.");
  if (!Object.hasOwn(RESEARCH_LABELS, result.researchInterest)) throw new ValidationError("Please select a research direction.");
  if (result.experience.length < 20) throw new ValidationError("Please provide at least 20 characters about your experience and interest.");
  if (result.experience.split(/\s+/u).filter(Boolean).length > 150) throw new ValidationError("Please shorten your response to 150 words or fewer.");
  if (result.profileUrl) {
    let url: URL;
    try { url = new URL(result.profileUrl); } catch { throw new ValidationError("Please enter a valid profile or project link."); }
    if (!["https:", "http:"].includes(url.protocol)) throw new ValidationError("Please enter an http or https profile or project link.");
  }
  return result;
}

export async function validateDocuments(form: FormData): Promise<UploadedDocument[]> {
  const documents: UploadedDocument[] = [];
  for (const field of ["cv", "supplemental"] as const) {
    const file = form.get(field);
    if (!file || typeof file === "string" || file.size === 0) {
      if (field === "cv") throw new ValidationError("Please upload your CV or résumé as a PDF.");
      continue;
    }
    if (file.size > MAX_PDF_BYTES) throw new ValidationError("Each uploaded PDF must be 10 MB or smaller.");
    if (!/\.pdf$/iu.test(file.name) || (file.type && file.type !== "application/pdf" && file.type !== "application/octet-stream")) throw new ValidationError("Please upload PDF files only.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") throw new ValidationError("Please upload valid PDF documents.");
    const basename = file.name.split(/[\\/]/u).pop() || "document.pdf";
    const safeName = basename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/gu, "-").replace(/^[.-]+/u, "").slice(-180) || "document.pdf";
    documents.push({ field, name: `${field}-${safeName}`, contentType: "application/pdf", bytes });
  }
  return documents;
}

export function createApplicationId(position: Position, date = new Date()) {
  const day = date.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `DR-${position.toUpperCase()}-${day}-${suffix}`;
}

function csvCell(value: string) {
  const safe = /^[=+@\t\r]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function createCsvRow(application: Application, id: string, submittedAt: string, documents: { field: string; name: string }[]) {
  const a = application;
  const filename = (field: string) => {
    const document = documents.find(d => d.field === field);
    return document ? `${id}-${document.name}` : "";
  };
  return [id, submittedAt, POSITION_LABELS[a.position], a.name, a.email, a.bsSchool, a.bsMajor, a.bsYear,
    a.msSchool, a.msMajor, a.msYear, a.phdSchool, a.phdMajor, a.phdYear, a.start, a.availability,
    RESEARCH_LABELS[a.researchInterest], a.profileUrl, a.experience, filename("cv"), filename("supplemental")].map(csvCell).join(",") + "\r\n";
}

export function base64(bytes: Uint8Array) {
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += 16384) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 16384)));
  return btoa(chunks.join(""));
}

const html = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");

export function createDeliveryPayload(a: Application, id: string, submittedAt: string, csvRow: string, documents: UploadedDocument[]) {
  return {
    applicationId: id, submittedAt, position: a.position, positionLabel: POSITION_LABELS[a.position],
    fullName: html(a.name), email: html(a.email),
    bsSchool: html(a.bsSchool), bsMajor: html(a.bsMajor), bsYear: html(a.bsYear),
    msSchool: a.msSchool ? html(a.msSchool) : null, msMajor: a.msMajor ? html(a.msMajor) : null, msYear: a.msYear ? html(a.msYear) : null,
    phdSchool: a.phdSchool ? html(a.phdSchool) : null, phdMajor: a.phdMajor ? html(a.phdMajor) : null, phdYear: a.phdYear ? html(a.phdYear) : null,
    preferredStart: a.start, availability: a.availability || null,
    researchInterest: a.researchInterest, researchInterestLabel: RESEARCH_LABELS[a.researchInterest],
    profileUrl: a.profileUrl ? html(a.profileUrl) : null, experience: a.experience, csvRow,
    files: documents.map(document => ({ name: document.name, contentType: document.contentType, contentBase64: base64(document.bytes) })),
  };
}

export function createDeliveryStream(a: Application, id: string, submittedAt: string, csvRow: string, documents: UploadedDocument[]) {
  const { files: _files, ...metadata } = createDeliveryPayload(a, id, submittedAt, csvRow, []);
  const encoder = new TextEncoder();
  // Encode PDFs in aligned chunks so two 10 MB files do not create several
  // complete base64/JSON copies in the Worker's limited memory.
  function* chunks() {
    yield encoder.encode(JSON.stringify(metadata).slice(0, -1) + ',"files":[');
    for (let n = 0; n < documents.length; n++) {
      const document = documents[n];
      if (n) yield encoder.encode(",");
      yield encoder.encode(JSON.stringify({ name: document.name, contentType: document.contentType }).slice(0, -1) + ',"contentBase64":"');
      for (let i = 0; i < document.bytes.length; i += 12288) yield encoder.encode(base64(document.bytes.subarray(i, i + 12288)));
      yield encoder.encode('"}');
    }
    yield encoder.encode("]}");
  }
  const iterator = chunks();
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = iterator.next();
      if (next.done) controller.close(); else controller.enqueue(next.value);
    },
  });
}

export async function fingerprint(a: Application, documents: UploadedDocument[]) {
  const documentDigests = [];
  for (const document of documents) {
    const digest = await crypto.subtle.digest("SHA-256", document.bytes as BufferSource);
    documentDigests.push([document.name, Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("")]);
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([a, documentDigests])));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
