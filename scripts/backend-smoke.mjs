import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { setTimeout as sleep } from "node:timers/promises";

const host = "127.0.0.1";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, host, () => {
      const address = server.address();
      server.close(() => {
        if (address && typeof address === "object") {
          resolve(address.port);
          return;
        }

        reject(new Error("Could not reserve a smoke-test port."));
      });
    });
  });
}

function stopServer(server) {
  if (!server) {
    return;
  }

  if (!server.pid || server.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  server.kill("SIGTERM");
}

async function isLegalCheckServer(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/api/legal-review/capabilities`);

    if (!response.ok) {
      return false;
    }

    const payload = await response.json();
    return payload.toolName === "LegalCheck";
  } catch {
    return false;
  }
}

async function main() {
  const explicitBaseUrl = process.env.LEGALCHECK_SMOKE_BASE_URL;
  let baseUrl = explicitBaseUrl;
  let server;
  let serverLog = "";

  if (!baseUrl) {
    const commonPorts = [3000, 3001, 3002, 3003];

    for (const port of commonPorts) {
      const candidateBaseUrl = `http://${host}:${port}`;

      if (await isLegalCheckServer(candidateBaseUrl)) {
        baseUrl = candidateBaseUrl;
        break;
      }
    }
  }

  if (!baseUrl) {
    const port = Number(process.env.LEGALCHECK_SMOKE_PORT) || (await getFreePort());
    baseUrl = `http://${host}:${port}`;

    const serverArgs = ["run", "dev", "--", "--hostname", host, "--port", String(port)];
    server = spawn(
      process.platform === "win32" ? "cmd.exe" : "npm",
      process.platform === "win32" ? ["/d", "/s", "/c", "npm", ...serverArgs] : serverArgs,
      {
        env: {
          ...process.env,
          NEXT_TELEMETRY_DISABLED: "1",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const captureLog = (chunk) => {
      serverLog = `${serverLog}${chunk.toString()}`.slice(-12_000);
    };

    server.stdout.on("data", captureLog);
    server.stderr.on("data", captureLog);
  }

  async function requestJson(path, options = {}, expectedStatus = 200) {
    const response = await fetch(`${baseUrl}${path}`, options);
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    assert(
      response.status === expectedStatus,
      `${path} returned ${response.status}, expected ${expectedStatus}: ${text}`,
    );

    return payload;
  }

  async function waitForServer() {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 90_000) {
      if (server && server.exitCode !== null) {
        throw new Error(`Next.js dev server exited early.\n${serverLog}`);
      }

      try {
        await requestJson("/api/legal-review/capabilities");
        return;
      } catch {
        await sleep(750);
      }
    }

    throw new Error(`Timed out waiting for LegalCheck backend.\n${serverLog}`);
  }

  try {
    await waitForServer();

    const capabilities = await requestJson("/api/legal-review/capabilities");
    assert(capabilities.toolName === "LegalCheck", "Capabilities should expose LegalCheck.");
    assert(capabilities.capabilities.length >= 3, "Capabilities should describe live backend features.");

    const invalidKey = await requestJson(
      "/api/byok/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "OpenAI", apiKey: "not-a-real-key-123456" }),
      },
      401,
    );
    assert(invalidKey.valid === false, "BYOK validation should reject invalid keys clearly.");

    const demo = await requestJson("/api/review-sessions/demo");
    assert(demo.session.productName === "LegalCheck", "Demo session should use LegalCheck.");
    assert(demo.session.phase === "supported", "Demo session should run through support review.");
    assert(demo.session.metrics.totalCitations >= 8, "Demo should extract the expected citation set.");

    const createPayload = {
      matterName: "Smoke <Matter> & Citation Review",
      owner: "Smoke Tester",
      documents: [
        {
          name: "Draft <script>alert(1)</script>.txt",
          format: "Text",
          text:
            "The complaint should be dismissed under Ashcroft v. Iqbal, 556 U.S. 662 (2009), because conclusory pleading is not enough. " +
            "The same draft cites 42 U.S.C. \u00a7 1983 for state-action claims and Fed. R. Civ. P. 12(b)(6) for dismissal procedure.",
        },
      ],
    };

    const created = await requestJson(
      "/api/review-sessions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      },
      201,
    );

    const sessionId = created.session.id;
    const documentId = created.session.documents[0].id;
    assert(created.session.phase === "intake", "New sessions should start in intake.");
    assert(created.session.metrics.totalCitations === 3, "Smoke document should extract three citations.");
    assert(created.session.metrics.readinessScore < 100, "Pending citations should lower readiness.");

    const uploadForm = new FormData();
    uploadForm.append("matterName", "Uploaded citation review");
    uploadForm.append("owner", "Smoke Tester");
    uploadForm.append(
      "files",
      new File(
        [
          "The uploaded draft cites Ashcroft v. Iqbal, 556 U.S. 662 (2009), for pleading plausibility. " +
            "It also cites Fed. R. Bankr. P. 9011 for sanctions posture.",
        ],
        "uploaded-draft.txt",
        { type: "text/plain" },
      ),
    );

    const uploaded = await requestJson(
      "/api/review-sessions/upload",
      {
        method: "POST",
        body: uploadForm,
      },
      201,
    );
    assert(uploaded.session.documents[0].name === "uploaded-draft.txt", "Upload route should preserve file names.");
    assert(uploaded.session.metrics.totalCitations === 2, "Upload route should extract citations from file text.");

    const emptyForm = new FormData();
    emptyForm.append("matterName", "No citation session");
    emptyForm.append(
      "notes",
      "This file has enough words to create a review session but intentionally contains no legal references.",
    );
    const emptyUpload = await requestJson(
      "/api/review-sessions/upload",
      {
        method: "POST",
        body: emptyForm,
      },
      201,
    );
    assert(emptyUpload.session.metrics.totalCitations === 0, "No-citation uploads should be allowed for user feedback.");
    assert(emptyUpload.session.metrics.readinessScore === 0, "No-citation uploads should not be scored as ready.");

    const verified = await requestJson(`/api/review-sessions/${sessionId}/verify`, {
      method: "POST",
    });
    assert(verified.session.phase === "verified", "Verify endpoint should advance the session.");
    assert(verified.session.metrics.verifiedCount >= 2, "Verify endpoint should validate known citations.");

    const supported = await requestJson(`/api/review-sessions/${sessionId}/support`, {
      method: "POST",
    });
    assert(supported.session.phase === "supported", "Support endpoint should finish the review pass.");
    assert(
      supported.session.documents[0].citations.every((citation) => citation.status !== "pending"),
      "Support should auto-verify pending citations before support analysis.",
    );

    const htmlExport = await requestJson(`/api/review-sessions/${sessionId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "html", documentId }),
    });
    assert(htmlExport.artifact.format === "html", "HTML export should return an HTML artifact.");
    assert(!htmlExport.artifact.content.includes("<script>alert(1)</script>"), "HTML export should escape raw markup.");
    assert(htmlExport.artifact.content.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "HTML export should retain escaped document text.");

    const csvExport = await requestJson(`/api/review-sessions/${sessionId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "csv", documentId }),
    });
    assert(csvExport.artifact.content.startsWith("Document,Citation"), "CSV export should include the expected header.");

    const jsonExport = await requestJson(`/api/review-sessions/${sessionId}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format: "json", documentId }),
    });
    const exportedSession = JSON.parse(jsonExport.artifact.content);
    assert(exportedSession.documents.length === 1, "Scoped JSON export should include one document.");
    assert(!("text" in exportedSession.documents[0]), "Public exports should not leak stored raw document text.");

    const badScope = await requestJson(
      `/api/review-sessions/${sessionId}/export`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "json", documentId: randomUUID() }),
      },
      404,
    );
    assert(
      badScope.error?.code === "DOCUMENT_NOT_FOUND",
      "Scoped export should reject unknown document ids.",
    );

    console.log(`LegalCheck backend smoke passed at ${baseUrl}`);
  } finally {
    stopServer(server);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
