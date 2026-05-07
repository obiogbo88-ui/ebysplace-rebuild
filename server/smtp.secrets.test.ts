import { describe, expect, it } from "vitest";
import net from "node:net";
import tls from "node:tls";

function readSmtpResponse(socket: net.Socket | tls.TLSSocket, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => cleanup(new Error("SMTP response timed out")), timeoutMs);
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const lastLine = lines[lines.length - 1] || "";
      if (/^\d{3}\s/.test(lastLine)) cleanup(null, buffer);
    };
    const onError = (error: Error) => cleanup(error);
    const cleanup = (error: Error | null, value?: string) => {
      clearTimeout(timeout);
      socket.off("data", onData);
      socket.off("error", onError);
      if (error) reject(error);
      else resolve(value || buffer);
    };
    socket.on("data", onData);
    socket.on("error", onError);
  });
}

function writeCommand(socket: net.Socket | tls.TLSSocket, command: string) {
  socket.write(`${command}\r\n`);
}

async function connectPlain(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port }, () => resolve(socket));
    socket.setTimeout(10_000, () => {
      socket.destroy(new Error("SMTP connection timed out"));
    });
    socket.once("error", reject);
  });
}

async function startTls(socket: net.Socket, host: string): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const secureSocket = tls.connect({ socket, servername: host }, () => resolve(secureSocket));
    secureSocket.once("error", reject);
  });
}

async function connectSecure(host: string, port: number): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host }, () => resolve(socket));
    socket.setTimeout(10_000, () => {
      socket.destroy(new Error("SMTP secure connection timed out"));
    });
    socket.once("error", reject);
  });
}

function normalizeSecret(value: string | undefined) {
  return (value || "").trim().replace(/^[\s"']+|[\s"']+$/g, "");
}

async function expectSmtpCode(socket: net.Socket | tls.TLSSocket, command: string | null, expectedPrefix: string) {
  if (command) writeCommand(socket, command);
  const response = await readSmtpResponse(socket);
  expect(response.startsWith(expectedPrefix), response.replace(/AUTH\s+\S+/gi, "AUTH [redacted]")).toBe(true);
  return response;
}

const smtpUser = normalizeSecret(process.env.SMTP_USER);
const smtpPass = normalizeSecret(process.env.SMTP_PASS);

describe("Zoho SMTP secrets", () => {
  it.runIf(Boolean(smtpUser && smtpPass))("authenticates to the configured SMTP endpoint without exposing the app password", async () => {
    const host = normalizeSecret(process.env.SMTP_HOST || "smtp.zoho.eu");
    const port = Number(normalizeSecret(process.env.SMTP_PORT || "465"));
    const user = smtpUser;
    const pass = smtpPass;

    expect(host).toBe("smtp.zoho.eu");
    expect([465, 587]).toContain(port);
    expect(user).toBe("info@ebysplace.com");
    expect(pass.length >= 8, "SMTP_PASS must be a Zoho app password, not empty").toBe(true);

    if (port === 465) {
      const secureSocket = await connectSecure(host, port);
      try {
        await expectSmtpCode(secureSocket, null, "220");
        await expectSmtpCode(secureSocket, `EHLO ebysplace.com`, "250");
        await expectSmtpCode(secureSocket, "AUTH LOGIN", "334");
        await expectSmtpCode(secureSocket, Buffer.from(user).toString("base64"), "334");
        await expectSmtpCode(secureSocket, Buffer.from(pass).toString("base64"), "235");
        writeCommand(secureSocket, "QUIT");
      } finally {
        secureSocket.destroy();
      }
      return;
    }

    const socket = await connectPlain(host, port);
    try {
      await expectSmtpCode(socket, null, "220");
      await expectSmtpCode(socket, `EHLO ebysplace.com`, "250");
      await expectSmtpCode(socket, "STARTTLS", "220");
      const secureSocket = await startTls(socket, host);
      try {
        await expectSmtpCode(secureSocket, `EHLO ebysplace.com`, "250");
        await expectSmtpCode(secureSocket, "AUTH LOGIN", "334");
        await expectSmtpCode(secureSocket, Buffer.from(user).toString("base64"), "334");
        await expectSmtpCode(secureSocket, Buffer.from(pass).toString("base64"), "235");
        writeCommand(secureSocket, "QUIT");
      } finally {
        secureSocket.destroy();
      }
    } finally {
      socket.destroy();
    }
  }, 30_000);
});
