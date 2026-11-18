import { test } from "node:test";
import assert from "node:assert/strict";
import { createCsvRow, createDeliveryPayload, createDeliveryStream, validateDocuments, validateFields, createApplicationId } from "../src/applications.ts";

function validForm(position = "phd") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ position, name: "System Test", email: "naq5rd@virginia.edu", bsSchool: "University of Virginia", bsMajor: "Computer Science", bsYear: "2027", start: "fall-2027", researchInterest: "both", experience: "This is a system test of the DeepREAL application intake and document delivery.", website: "" })) form.set(key, value);
  return form;
}

test("each position retains its required education and availability fields", () => {
  assert.equal(validateFields(validForm()).position, "phd");
  assert.throws(() => validateFields(validForm("postdoc")), /phdSchool/);
  assert.throws(() => validateFields(validForm("student")), /availability/);
  const postdoc = validForm("postdoc");
  postdoc.set("phdSchool", "University of Virginia"); postdoc.set("phdMajor", "Computer Science"); postdoc.set("phdYear", "2027");
  assert.equal(validateFields(postdoc).phdYear, "2027");
  const student = validForm("student"); student.set("availability", "5-10"); student.set("start", "this-semester");
  assert.equal(validateFields(student).start, "this-semester");
});

test("partial MS entries, oversized responses, honeypots and unsafe profile URLs are rejected", () => {
  const partial = validForm(); partial.set("msSchool", "Example University");
  assert.throws(() => validateFields(partial), /all three MS/);
  const long = validForm(); long.set("experience", "word ".repeat(151));
  assert.throws(() => validateFields(long), /150 words/);
  const honeypot = validForm(); honeypot.set("website", "spam.example");
  assert.throws(() => validateFields(honeypot), /could not submit/);
  const url = validForm(); url.set("profileUrl", "javascript:alert(1)");
  assert.throws(() => validateFields(url), /http or https/);
});

test("PDF validation checks file content and the 10 MB bound", async () => {
  const form = validForm();
  form.set("cv", new File(["pretending to be a PDF"], "test.pdf", { type: "application/pdf" }));
  await assert.rejects(validateDocuments(form), /valid PDF/);
  form.set("cv", new File(["%PDF-1.4\n%%EOF"], "System Test.pdf", { type: "application/pdf" }));
  const documents = await validateDocuments(form);
  assert.equal(documents[0].name, "cv-System-Test.pdf");
  form.set("supplemental", new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }));
  await assert.rejects(validateDocuments(form), /10 MB/);
});

test("CSV and workflow payload preserve the existing delivery contract", () => {
  const form = validForm(); form.set("name", 'System, "Test"'); form.set("bsSchool", "=dangerous()");
  const a = validateFields(form);
  const id = "DR-PHD-20261118-AABBCCDD";
  const documents = [{ field: "cv" as const, name: "cv-test.pdf", contentType: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.4\n%%EOF") }];
  const csv = createCsvRow(a, id, "2026-11-18T00:00:00.000Z", documents);
  assert.match(csv, /"System, ""Test"""/);
  assert.match(csv, /"'=dangerous\(\)"/);
  assert.match(csv, /"Both Methods and Applications"/);
  assert.ok(csv.endsWith(`"${id}-cv-test.pdf",""\r\n`));
  const payload = createDeliveryPayload(a, id, "2026-11-18T00:00:00.000Z", csv, documents);
  assert.equal(payload.positionLabel, "PhD"); assert.equal(payload.msSchool, null); assert.equal(payload.preferredStart, "fall-2027");
  assert.equal(payload.files[0].name, "cv-test.pdf");
  assert.equal(atob(payload.files[0].contentBase64), "%PDF-1.4\n%%EOF");
  assert.equal(payload.csvRow, csv);
  assert.match(createApplicationId("student", new Date("2026-11-18T00:00:00Z")), /^DR-STUDENT-20261118-[A-F0-9]{8}$/);
});

test("streaming documents preserves the exact JSON payload across base64 chunk boundaries", async () => {
  const a = validateFields(validForm());
  const bytes = Uint8Array.from({ length: 25001 }, (_, i) => i % 256);
  const documents = [{ field: "cv" as const, name: "cv-test.pdf", contentType: "application/pdf", bytes }, { field: "supplemental" as const, name: "supplemental-test.pdf", contentType: "application/pdf", bytes: bytes.subarray(0, 12289) }];
  const id = "DR-PHD-20261118-ABCDEF01", date = "2026-11-18T00:00:00Z";
  const row = createCsvRow(a, id, date, documents);
  assert.deepEqual(await new Response(createDeliveryStream(a, id, date, row, documents)).json(), createDeliveryPayload(a, id, date, row, documents));
});
