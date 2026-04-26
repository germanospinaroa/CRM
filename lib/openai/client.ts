import "server-only";

import OpenAI from "openai";

let openAIClient: OpenAI | null | undefined;

export function getOpenAIClient() {
  if (openAIClient !== undefined) {
    return openAIClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    openAIClient = null;
    return openAIClient;
  }

  openAIClient = new OpenAI({
    apiKey,
  });

  return openAIClient;
}

export function getOpenAIModel() {
  return "gpt-4.1-mini";
}
