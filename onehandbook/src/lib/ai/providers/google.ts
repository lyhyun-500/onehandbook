import { GoogleGenerativeAI } from "@google/generative-ai";

type GoogleTurn = { role: "user" | "model"; content: string };

export async function completeGoogle(params: {
  model: string;
  system: string;
  user: string;
}): Promise<string> {
  return completeGoogleConversation({
    model: params.model,
    system: params.system,
    messages: [{ role: "user", content: params.user }],
  });
}

/** user/model 교차 기록 후 마지막 user 메시지로 이어서 생성(JSON 재요청 등). */
export async function completeGoogleConversation(params: {
  model: string;
  system: string;
  messages: GoogleTurn[];
}): Promise<string> {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 가 설정되지 않았습니다.");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: params.system,
  });

  const { messages } = params;
  if (messages.length === 0) {
    throw new Error("completeGoogleConversation: messages 비어 있음");
  }
  const last = messages[messages.length - 1]!;
  if (last.role !== "user") {
    throw new Error("completeGoogleConversation: 마지막 메시지는 user 여야 합니다.");
  }

  const history = messages.slice(0, -1).map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  if (history.length === 0) {
    const result = await model.generateContent(last.content);
    const text = result.response.text();
    if (!text) {
      throw new Error("Gemini 응답이 비어 있습니다.");
    }
    return text;
  }

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(last.content);
  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }
  return text;
}
