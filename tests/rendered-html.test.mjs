import assert from "node:assert/strict";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("builds the complete SignalLayer workflow shell", async () => {
  const { readFile } = await import("node:fs/promises");
  const [page, product, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/signal-layer-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /SignalLayer — LinkedIn content intelligence/);
  assert.match(page, /SignalLayerApp/);
  assert.match(product, /Approval queue/);
  assert.match(product, /Qualified contacts/);
  assert.match(product, /Idea approval/);
  assert.match(product, /Brand & claims QA/);
  assert.match(product, /Connect LinkedIn/);
  assert.match(product, /Workspace onboarding/);
  assert.match(product, /Export XLSX/);
  assert.match(product, /Activity log/);
  assert.match(product, /Revise with AI/);
  assert.match(product, /Restore this version/);
  assert.match(product, /linkedin-connected/);
  assert.doesNotMatch(page + product + layout, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("packages the platform persistence declarations", async () => {
  const [{ readFile }, { access }] = await Promise.all([import("node:fs/promises"), import("node:fs/promises")]);
  const hosting = JSON.parse(await readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"));
  assert.equal(hosting.d1, "DB");
  assert.equal(hosting.r2, "FILES");
  await access(new URL("../drizzle/0000_smooth_plazm.sql", import.meta.url));
  await access(new URL("../drizzle/0001_noisy_wendigo.sql", import.meta.url));
  assert.ok(templateRoot);
});

test("includes production agent and LinkedIn integration routes", async () => {
  const { readFile } = await import("node:fs/promises");
  const [agent, oauth, publisher, crypto] = await Promise.all([
    readFile(new URL("../app/api/agents/generate/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/linkedin/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/integrations/linkedin/publish/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/token-crypto.ts", import.meta.url), "utf8"),
  ]);
  assert.match(agent, /api\.openai\.com\/v1\/responses/);
  assert.match(agent, /Built-in fallback/);
  assert.match(oauth, /oauth\/v2\/accessToken/);
  assert.match(publisher, /Only approved and scheduled posts can publish/);
  assert.match(crypto, /AES-GCM/);
});
