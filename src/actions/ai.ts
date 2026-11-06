"use server";

/**
 * Server Action cho sinh viên nhờ AI rà soát "Ghi chú thêm" trước khi gửi
 * hồ sơ. Việc rà soát luôn chạy bộ quy tắc y tế nội bộ; nếu quản trị viên đã
 * cấu hình `AI_API_KEY` thì gọi thêm mô hình ngôn ngữ để đọc hiểu ngữ nghĩa.
 */

import { z } from "zod";
import { getSession } from "@/lib/auth";
import { screenDonationNote, type NoteScreening } from "@/lib/ai-screening";

export type NoteScreeningResult = {
  success: boolean;
  code?: string;
  message: string;
  data?: NoteScreening;
};

const noteSchema = z
  .string()
  .trim()
  .max(500, "Ghi chú tối đa 500 ký tự");

export async function screenNoteForStudent(
  note: string,
): Promise<NoteScreeningResult> {
  try {
    const session = await getSession();

    if (!session) {
      return {
        success: false,
        code: "UNAUTHENTICATED",
        message: "Bạn cần đăng nhập để rà soát ghi chú sức khỏe.",
      };
    }

    if (session.role !== "STUDENT") {
      return {
        success: false,
        code: "FORBIDDEN",
        message: "Chỉ sinh viên mới có thể rà soát ghi chú sức khỏe.",
      };
    }

    const parsed = noteSchema.safeParse(note ?? "");

    if (!parsed.success) {
      return {
        success: false,
        code: "INVALID_INPUT",
        message: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.",
      };
    }

    if (parsed.data === "") {
      return {
        success: false,
        code: "EMPTY_NOTE",
        message: "Hãy nhập ghi chú sức khỏe trước khi nhờ AI rà soát.",
      };
    }

    const data = await screenDonationNote(parsed.data, { useExternal: true });

    return {
      success: true,
      code: "SCREENED",
      message: "Đã rà soát ghi chú sức khỏe.",
      data,
    };
  } catch (error) {
    console.error("[screenNoteForStudent] Lỗi:", error);

    return {
      success: false,
      code: "INTERNAL_ERROR",
      message: "Không thể rà soát ghi chú lúc này. Vui lòng thử lại sau.",
    };
  }
}
