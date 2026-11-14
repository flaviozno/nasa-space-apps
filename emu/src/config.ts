import { HttpError } from "./contracts/errors.ts";
export interface Config {
  enabled: boolean;
  token: string;
  maxRecords: number;
  version: 1;
}

export function getConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const enabled = env.SIMULATOR_ENABLED ?? "true";
  const max = env.MAX_RECORDS_PER_SYNC ?? "100";
  if (
    !["true", "false"].includes(enabled) ||
    !/^[1-9][0-9]*$/.test(max) ||
    Number(max) > 100 ||
    (env.SIMULATOR_VERSION ?? "1") !== "1"
  ) {
    throw new HttpError(
      503,
      "CONFIGURATION_ERROR",
      "Configuração do emulador inválida.",
    );
  }
  return {
    enabled: enabled === "true",
    token: env.SIMULATOR_TOKEN ?? "",
    maxRecords: Number(max),
    version: 1,
  };
}
