import { api } from "@/api/client";
import type { CopilotMessage } from "@/api/types";

export function sendMessage(threadId: string, content: string) {
  return api.post<CopilotMessage>(
    `/copilot/threads/${threadId}/messages`,
    { content },
  );
}
