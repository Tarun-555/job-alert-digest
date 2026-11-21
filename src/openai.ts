import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatWithOpenAI(
  messages: ChatMessage[],
  model: string = "openrouter/free",
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model,
    messages,
  });
  return completion.choices[0]?.message?.content ?? "";
}

export async function streamChatWithOpenAI(
  messages: ChatMessage[],
  model: string = "openrouter/free",
  onChunk: (chunk: string) => void,
): Promise<string> {
  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  let fullContent = "";
  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content ?? "";
    if (content) {
      fullContent += content;
      onChunk(content);
    }
  }
  return fullContent;
}

// chatWithOpenAI([
//   { role: "system", content: "You are a helpful assistant." },
//   {
//     role: "user",
//     content:
//       "what are the latest job alerts for software engineers Hyderabad based on my feed?",
//   },
// ]).then((response) => {
//   console.log("OpenAI response:", response);
// });

export default openai;
