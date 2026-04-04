import { GoogleGenerativeAI } from "@google/generative-ai";

export async function completeGoogle(params: {
  model: string;
  system: string;
  user: string;
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

  const result = await model.generateContent(params.user);
  const text = result.response.text();
  if (!text) {
    throw new Error("Gemini 응답이 비어 있습니다.");
  }
  return text;
}
