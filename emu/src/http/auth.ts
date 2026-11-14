import { createHash, timingSafeEqual } from "node:crypto";
import { HttpError } from "../contracts/errors.ts";
import type { Config } from "../config.ts";
export function authenticate(
  authorization: string | string[] | undefined,
  config: Config,
): void {
  if (!config.enabled)
    throw new HttpError(503, "SIMULATOR_DISABLED", "Emulador desabilitado.");
  if (!config.token || config.token === "change-me")
    throw new HttpError(
      503,
      "CONFIGURATION_ERROR",
      "Defina um token privado para habilitar os endpoints protegidos.",
    );
  const match =
    typeof authorization === "string"
      ? /^Bearer ([^\s]+)$/i.exec(authorization)
      : null;
  const provided = match?.[1] ?? "";
  const digest = (text: string) => createHash("sha256").update(text).digest();
  if (!match || !timingSafeEqual(digest(provided), digest(config.token)))
    throw new HttpError(401, "UNAUTHORIZED", "Token ausente ou inválido.");
}
