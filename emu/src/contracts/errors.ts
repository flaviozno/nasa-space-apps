export interface ErrorResponse {
  version: 1;
  error: { code: string; message: string };
}
export class HttpError extends Error {
  public readonly status: number;
  public readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "HttpError";
  }
}
