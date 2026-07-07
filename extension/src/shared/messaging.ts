export interface PrViewedMessage {
  type: "PR_VIEWED";
  owner: string;
  repo: string;
  number: number;
}

export type ExtensionMessage = PrViewedMessage;

export function sendMessage<TResponse = unknown>(message: ExtensionMessage): Promise<TResponse> {
  return chrome.runtime.sendMessage(message);
}
