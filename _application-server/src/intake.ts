import { env } from "cloudflare:workers";
import { createApplicationId, createCsvRow, createDeliveryStream, fingerprint, validateDocuments, validateFields, ValidationError, type StoredDocument } from "./applications";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "This form must be submitted from the application website." }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 22 * 1024 * 1024) return Response.json({ error: "Each uploaded PDF must be 10 MB or smaller." }, { status: 413 });
  if (!env.DB || !env.BUCKET || !env.APPLICATION_WEBHOOK_URL) return Response.json({ error: "Applications are temporarily unavailable. Please try again shortly." }, { status: 503 });
  let storedId: string | undefined;
  try {
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new ValidationError("Please submit the application form with PDF documents.");
    let bodySize = 0;
    const boundedBody = request.body?.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bodySize += chunk.byteLength;
        if (bodySize > 22 * 1024 * 1024) throw new ValidationError("Each uploaded PDF must be 10 MB or smaller.");
        controller.enqueue(chunk);
      },
    }));
    const form = await new Response(boundedBody, { headers: { "Content-Type": request.headers.get("content-type")! } }).formData();
    const application = validateFields(form);
    const documents = await validateDocuments(form);
    const key = request.headers.get("idempotency-key") || crypto.randomUUID();
    if (!/^[a-zA-Z0-9-]{16,100}$/u.test(key)) throw new ValidationError("Invalid submission. Please reload the form and try again.");
    const digest = await fingerprint(application, documents);
    const previous = await env.DB.prepare("SELECT id, fingerprint FROM applications WHERE request_key = ?").bind(key).first<{ id: string; fingerprint: string }>();
    if (previous) {
      if (previous.fingerprint !== digest) return Response.json({ error: "The form changed during submission. Reload the form and try again." }, { status: 409 });
      return Response.json({ applicationId: previous.id });
    }
    const submittedAt = new Date().toISOString();
    const id = createApplicationId(application.position, new Date(submittedAt));
    const csvRow = createCsvRow(application, id, submittedAt, documents);
    const files: StoredDocument[] = documents.map(document => ({ field: document.field, name: `${id}-${document.name}`, key: `applications/${id}/${document.name}`, size: document.bytes.length, contentType: document.contentType }));
    // Keep an independent private copy before accepting the submission.
    const saved: string[] = [];
    try {
      for (let i = 0; i < documents.length; i++) {
        await env.BUCKET.put(files[i].key, documents[i].bytes as unknown as ArrayBuffer, { httpMetadata: { contentType: "application/pdf" } });
        saved.push(files[i].key);
      }
      await env.DB.prepare("INSERT INTO applications (id, request_key, fingerprint, submitted_at, position, record_json, csv_row, files_json, delivery_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(id, key, digest, submittedAt, application.position, JSON.stringify(application), csvRow, JSON.stringify(files), "pending").run();
      storedId = id;
    } catch (error) {
      await Promise.allSettled(saved.map(file => env.BUCKET!.delete(file)));
      // A repeated request can race the first one; only the first sends email.
      const raced = await env.DB.prepare("SELECT id, fingerprint FROM applications WHERE request_key = ?").bind(key).first<{ id: string; fingerprint: string }>();
      if (raced?.fingerprint === digest) return Response.json({ applicationId: raced.id });
      throw error;
    }
    try {
      const response = await fetch(env.APPLICATION_WEBHOOK_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: createDeliveryStream(application, id, submittedAt, csvRow, documents),
        signal: AbortSignal.timeout(25000),
      });
      const deliveryStatus = response.ok ? "accepted" : "failed";
      await response.body?.cancel();
      await env.DB.prepare("UPDATE applications SET delivery_status = ?, delivery_http_status = ?, delivery_error = ? WHERE id = ?")
        .bind(deliveryStatus, response.status, response.ok ? null : "The delivery workflow rejected this request.", id).run();
      if (!response.ok) console.error("Application delivery needs recovery", { applicationId: id, status: response.status });
    } catch {
      await env.DB.prepare("UPDATE applications SET delivery_status = ?, delivery_error = ? WHERE id = ?")
        .bind("unknown", "Delivery confirmation was unavailable. Check flow history before replaying.", id).run();
      console.error("Application delivery confirmation unavailable", { applicationId: id });
    }
    return Response.json({ applicationId: id }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (storedId) return Response.json({ applicationId: storedId }, { status: 201 });
    if (error instanceof ValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Application submission failed before acceptance", { errorType: error instanceof Error ? error.name : "unknown" });
    return Response.json({ error: "We could not submit your application. Please try again." }, { status: 500 });
  }
}
