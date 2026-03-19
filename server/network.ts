import type { RequestHandler } from "express";

export type AccessMode = "localhost" | "lan";

function normalizeRemoteAddress(address: string | undefined): string {
  if (!address) {
    return "";
  }

  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

export function isPrivateOrLocalAddress(address: string | undefined): boolean {
  const normalized = normalizeRemoteAddress(address);
  if (!normalized) {
    return false;
  }

  if (normalized === "::1" || normalized === "127.0.0.1") {
    return true;
  }

  if (normalized.startsWith("10.")) {
    return true;
  }

  if (normalized.startsWith("192.168.")) {
    return true;
  }

  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return true;
  }

  const lower = normalized.toLowerCase();
  return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:");
}

export function createAccessGuard(accessMode: AccessMode): RequestHandler {
  return (request, response, next) => {
    if (accessMode === "localhost") {
      next();
      return;
    }

    const remoteAddress = request.socket.remoteAddress;
    if (isPrivateOrLocalAddress(remoteAddress)) {
      next();
      return;
    }

    response.status(403).json({
      message: "LAN mode only allows localhost or private network clients.",
      remoteAddress
    });
  };
}
