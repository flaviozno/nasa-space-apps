export interface ReceiptAck {
  version: 1;
  transferId: string;
  requestId: string;
  receivedAtMs: number;
  acceptedSampleIds: string[];
}
