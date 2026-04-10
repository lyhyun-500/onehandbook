import type { SupabaseClient } from "@supabase/supabase-js";

export type TrainingLogInsert = {
  userMessage: string;
  assistantMessage: string;
  /** 모델명, 라우트, 작품 id 등 메타(선택) */
  context?: Record<string, unknown>;
};

const MAX_LEN = 200_000;

/**
 * 로그인 세션 기준으로 `training_logs`에 질문·답변 쌍을 넣습니다.
 * AI 응답이 나온 직후 같은 요청 흐름에서 호출하세요.
 */
export async function insertTrainingLogPair(
  supabase: SupabaseClient,
  appUserId: number,
  input: TrainingLogInsert
): Promise<{ id: string }> {
  const userMessage = input.userMessage.trim();
  const assistantMessage = input.assistantMessage.trim();
  if (!userMessage || !assistantMessage) {
    throw new Error("insertTrainingLogPair: userMessage·assistantMessage가 비어 있습니다.");
  }
  if (userMessage.length > MAX_LEN || assistantMessage.length > MAX_LEN) {
    throw new Error("insertTrainingLogPair: 메시지가 너무 깁니다.");
  }

  const { data, error } = await supabase
    .from("training_logs")
    .insert({
      app_user_id: appUserId,
      user_message: userMessage,
      assistant_message: assistantMessage,
      context: input.context ?? {},
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "training_logs 삽입에 실패했습니다.");
  }

  return { id: data.id as string };
}
