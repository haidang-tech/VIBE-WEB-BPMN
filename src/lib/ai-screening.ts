/**
 * AI hỗ trợ sàng lọc "Ghi chú thêm" của sinh viên trước khi hiến máu.
 *
 * Cách hoạt động:
 * 1. Luôn chạy bộ quy tắc an toàn nội bộ (tiếng Việt) để bắt các dấu hiệu
 *    chống chỉ định / cần hoãn hiến máu.
 * 2. Nếu cấu hình `AI_API_KEY` (API tương thích OpenAI), gửi thêm ghi chú đã
 *    ẩn thông tin nhận dạng tới mô hình để rà soát ngữ nghĩa.
 * 3. Kết hợp kết quả theo hướng thận trọng: mức rủi ro cao hơn được ưu tiên.
 *
 * Lưu ý: đây là công cụ hỗ trợ, KHÔNG thay thế kết luận của nhân viên y tế.
 */

import { z } from "zod";

export type NoteRiskLevel = "clear" | "caution" | "blocked";

export type NoteScreening = {
  level: NoteRiskLevel;
  label: string;
  summary: string;
  reasons: string[];
  advice: string;
  categories: string[];
  confidence: number;
  /** "local" = chỉ dùng quy tắc nội bộ, "hybrid" = có thêm mô hình AI. */
  provider: "local" | "hybrid";
  flagged: boolean;
  reviewedAt: string;
};

type ScreeningRule = {
  id: string;
  category: string;
  level: Exclude<NoteRiskLevel, "clear">;
  pattern: RegExp;
  reason: string;
};

const RULES: ScreeningRule[] = [
  // --- Bệnh truyền nhiễm / chống chỉ định tuyệt đối ---------------------
  {
    id: "blood-borne-infection",
    category: "Bệnh truyền nhiễm",
    level: "blocked",
    pattern:
      /(?:bị|mắc|nhiễm|tiền sử|đang điều trị|đã từng bị)\s+(?:bệnh\s+)?(?:hiv|viêm gan|lao|giang mai|lậu|sùi mào gà)|hiv dương tính/i,
    reason:
      "Có thông tin về bệnh truyền nhiễm qua đường máu (HIV, viêm gan, lao, giang mai...).",
  },
  {
    id: "active-infection",
    category: "Nhiễm trùng cấp",
    level: "blocked",
    pattern:
      /đang\s+(?:bị\s+)?sốt|sốt cao|nhiễm trùng huyết|nhiễm khuẩn huyết|viêm phổi cấp/i,
    reason: "Đang có dấu hiệu nhiễm trùng cấp hoặc sốt.",
  },

  // --- Bệnh lý nặng / mạn tính ------------------------------------------
  {
    id: "severe-chronic",
    category: "Bệnh lý nặng",
    level: "blocked",
    pattern:
      /ung thư|suy tim|suy thận|chạy thận|ghép tạng|ghép tủy|xơ gan|đột quỵ|tai biến|nhồi máu cơ tim|thiếu máu nặng|rối loạn đông máu|xuất huyết nội|động kinh|bệnh tim bẩm sinh|hở van tim|hẹp van tim/i,
    reason:
      "Có tiền sử bệnh lý nặng hoặc bệnh mạn tính cần đánh giá chuyên khoa.",
  },
  {
    id: "uncontrolled-chronic",
    category: "Bệnh lý nặng",
    level: "blocked",
    pattern:
      /(?:tiểu đường|đái tháo đường|tăng huyết áp|huyết áp cao)[^,.;!?]{0,24}không (?:kiểm soát|ổn định)|không (?:kiểm soát|ổn định)[^,.;!?]{0,24}(?:tiểu đường|huyết áp)/i,
    reason:
      "Bệnh mạn tính đang không được kiểm soát (tiểu đường / huyết áp).",
  },

  // --- Thai kỳ / sinh sản -----------------------------------------------
  {
    id: "pregnancy",
    category: "Thai kỳ",
    level: "blocked",
    pattern: /mang thai|có thai|đang bầu|cho con bú|đang nuôi con nhỏ/i,
    reason: "Đang mang thai, có thai hoặc đang cho con bú.",
  },

  // --- Phẫu thuật / can thiệp gần đây ---------------------------------
  {
    id: "recent-surgery",
    category: "Can thiệp y tế",
    level: "blocked",
    pattern:
      /vừa\s+(?:mổ|phẫu thuật)|mới\s+(?:mổ|phẫu thuật)|phẫu thuật\s+(?:cách đây|trong vòng)\s+\d+\s*(?:ngày|tuần|tháng)/i,
    reason: "Vừa trải qua phẫu thuật hoặc can thiệp y tế gần đây.",
  },
  {
    id: "recent-transfusion",
    category: "Can thiệp y tế",
    level: "blocked",
    pattern: /vừa\s+truyền máu|mới\s+truyền máu|truyền máu\s+(?:cách đây|trong vòng)\s+\d+\s*(?:ngày|tuần|tháng)/i,
    reason: "Vừa được truyền máu / chế phẩm máu gần đây.",
  },

  // --- Triệu chứng cấp tính ---------------------------------------------
  {
    id: "acute-symptoms",
    category: "Triệu chứng cấp",
    level: "blocked",
    pattern:
      /khó thở|đau ngực|ngất xỉu|ngất|co giật|sốc phản vệ|chảy máu không cầm/i,
    reason:
      "Có triệu chứng cấp tính (khó thở, đau ngực, ngất, co giật...).",
  },
  {
    id: "substance-use",
    category: "Chất kích thích",
    level: "blocked",
    pattern:
      /tiêm chích ma túy|nghiện ma túy|sử dụng ma túy|say rượu|nồng độ cồn cao/i,
    reason: "Có sử dụng chất kích thích / ma túy hoặc say rượu.",
  },
  {
    id: "anticoagulant",
    category: "Thuốc",
    level: "blocked",
    pattern:
      /đang dùng\s+(?:thuốc chống đông|warfarin|heparin)|thuốc chống đông máu/i,
    reason: "Đang dùng thuốc chống đông máu.",
  },

  // --- Cần nhân viên y tế xác nhận -------------------------------------
  {
    id: "antibiotics",
    category: "Thuốc",
    level: "caution",
    pattern: /kháng sinh|đang uống thuốc|đang điều trị bệnh/i,
    reason: "Đang dùng kháng sinh hoặc thuốc điều trị bệnh.",
  },
  {
    id: "tattoo-piercing",
    category: "Thủ thuật xâm lấn",
    level: "caution",
    pattern:
      /xăm hình|phun xăm|xăm mình|xỏ khuyên|bấm lỗ|xuyên lỗ|phẫu thuật thẩm mỹ|nâng mũi|hút mỡ/i,
    reason:
      "Có xăm hình, xỏ khuyên hoặc thủ thuật xâm lấn trong thời gian cần hoãn hiến máu.",
  },
  {
    id: "menstruation",
    category: "Sức khỏe sinh sản",
    level: "caution",
    pattern: /kinh nguyệt|hành kinh|đang có kinh/i,
    reason: "Đang trong kỳ kinh nguyệt.",
  },
  {
    id: "mild-illness",
    category: "Triệu chứng nhẹ",
    level: "caution",
    pattern:
      /(?:^|\s)ho(?:\s|$)|cảm cúm|bị cảm|sổ mũi|viêm họng|đau đầu|chóng mặt|mệt mỏi|suy nhược/i,
    reason: "Có triệu chứng nhẹ (ho, cảm, đau đầu, mệt mỏi...).",
  },
  {
    id: "vaccination",
    category: "Vắc-xin",
    level: "caution",
    pattern: /tiêm phòng|tiêm vắc ?xin|tiêm vaccine|vừa tiêm/i,
    reason: "Vừa tiêm vắc-xin, cần kiểm tra thời gian chờ.",
  },
  {
    id: "blood-disorder-history",
    category: "Huyết học",
    level: "caution",
    pattern: /thiếu máu|thiếu sắt|dễ bầm|khó cầm máu/i,
    reason: "Có tiền sử thiếu máu hoặc vấn đề về đông máu.",
  },
  {
    id: "allergy",
    category: "Dị ứng",
    level: "caution",
    pattern: /dị ứng nặng|dị ứng thuốc|mẫn cảm|sốc phản vệ nhẹ/i,
    reason: "Có tiền sử dị ứng cần theo dõi.",
  },
  {
    id: "chronic-mild",
    category: "Bệnh lý mạn tính",
    level: "caution",
    pattern:
      /hen suyễn|hen phế quản|tiểu đường|đái tháo đường|tăng huyết áp|huyết áp cao|sỏi thận|sỏi mật|viêm dạ dày|viêm loét dạ dày/i,
    reason: "Có bệnh lý mạn tính cần nhân viên y tế kiểm tra thêm.",
  },
  {
    id: "fear-needle",
    category: "Phản ứng khi lấy máu",
    level: "caution",
    pattern:
      /sợ kim|sợ máu|ngất khi lấy máu|choáng khi lấy máu|từng ngất khi hiến máu/i,
    reason: "Có tiền sử ngất / choáng khi lấy máu.",
  },
  {
    id: "recent-donation",
    category: "Khoảng cách hiến máu",
    level: "caution",
    pattern: /vừa hiến máu|mới hiến máu|hiến máu gần đây/i,
    reason: "Vừa hiến máu gần đây, cần kiểm tra khoảng cách tối thiểu.",
  },
  {
    id: "travel-risk",
    category: "Dịch tễ",
    level: "caution",
    pattern: /du lịch|vùng dịch|sốt rét|malaria|trở về từ/i,
    reason: "Có yếu tố dịch tễ / du lịch vùng dịch cần khai thác thêm.",
  },
];

const LEVEL_ORDER: Record<NoteRiskLevel, number> = {
  clear: 0,
  caution: 1,
  blocked: 2,
};

const LEVEL_META: Record<
  NoteRiskLevel,
  { label: string; summary: string; advice: string; confidence: number }
> = {
  clear: {
    label: "Có thể tiếp tục",
    summary:
      "AI chưa phát hiện dấu hiệu cần hoãn hiến máu trong ghi chú của bạn.",
    advice:
      "Bạn có thể tiếp tục đăng ký. Nhân viên y tế vẫn sẽ kiểm tra trực tiếp trước khi hiến.",
    confidence: 0.72,
  },
  caution: {
    label: "Cần y tế xác nhận",
    summary:
      "AI phát hiện thông tin sức khỏe cần được nhân viên y tế xác nhận thêm.",
    advice:
      "Hãy trao đổi với nhân viên y tế tại quầy khám trước khi hiến. Hồ sơ của bạn vẫn có thể được xem xét.",
    confidence: 0.86,
  },
  blocked: {
    label: "Chưa thể hiến hôm nay",
    summary:
      "AI phát hiện thông tin có thể khiến bạn chưa đủ điều kiện hiến máu hôm nay.",
    advice:
      "Vui lòng liên hệ ban tổ chức hoặc nhân viên y tế để được tư vấn. Không tự ý hiến khi đang có vấn đề sức khỏe.",
    confidence: 0.92,
  },
};

export const EMPTY_NOTE_SCREENING: NoteScreening = {
  level: "clear",
  label: LEVEL_META.clear.label,
  summary: "Chưa có ghi chú thêm để rà soát.",
  reasons: [],
  advice: LEVEL_META.clear.advice,
  categories: [],
  confidence: 0.6,
  provider: "local",
  flagged: false,
  reviewedAt: new Date(0).toISOString(),
};

function normalize(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

/**
 * Kiểm tra phủ định trong cùng một mệnh đề.
 * Ví dụ "không dùng kháng sinh" sẽ không bị gắn cờ kháng sinh.
 */
function isNegated(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 64), index).toLowerCase();
  const clause = before.split(/[,;.!?]/).pop() ?? before;
  const hasContrast = /(?:nhưng|tuy nhiên|song|mà)\s*$/.test(clause);

  if (hasContrast) return false;

  return /(?:^|\s)(?:không|chưa|chẳng|chưa từng|không hề|không phải|đã tiêm phòng|đã tiêm vắc ?xin|đã tiêm vaccine)\b/.test(
    clause,
  );
}

export function screenNoteWithRules(note: string | null | undefined): NoteScreening {
  const normalized = normalize(note ?? "");
  const reviewedAt = new Date().toISOString();

  if (!normalized) {
    return {
      ...EMPTY_NOTE_SCREENING,
      reviewedAt,
    };
  }

  const matched: ScreeningRule[] = [];

  for (const rule of RULES) {
    const match = rule.pattern.exec(normalized);

    if (!match || match.index === undefined) continue;
    if (isNegated(normalized, match.index)) continue;

    matched.push(rule);
  }

  if (matched.length === 0) {
    return {
      level: "clear",
      label: LEVEL_META.clear.label,
      summary: LEVEL_META.clear.summary,
      reasons: [],
      advice: LEVEL_META.clear.advice,
      categories: [],
      confidence: LEVEL_META.clear.confidence,
      provider: "local",
      flagged: false,
      reviewedAt,
    };
  }

  const level = matched.reduce<NoteRiskLevel>((current, rule) => {
    return LEVEL_ORDER[rule.level] > LEVEL_ORDER[current] ? rule.level : current;
  }, "clear");
  const meta = LEVEL_META[level];

  const reasons = [...new Set(matched.map((rule) => rule.reason))].slice(0, 6);
  const categories = [...new Set(matched.map((rule) => rule.category))];

  return {
    level,
    label: meta.label,
    summary: meta.summary,
    reasons,
    advice: meta.advice,
    categories,
    confidence: meta.confidence,
    provider: "local",
    flagged: true,
    reviewedAt,
  };
}

const externalScreeningSchema = z.object({
  level: z.enum(["clear", "caution", "blocked"]),
  summary: z.string().trim().min(1).max(400),
  reasons: z.array(z.string().trim().min(1).max(240)).max(6).default([]),
  advice: z.string().trim().max(400).default(""),
  categories: z.array(z.string().trim().min(1).max(80)).max(6).default([]),
  confidence: z.number().min(0).max(1).default(0.75),
});

/** Ẩn email / số điện thoại / CCCD trước khi gửi ra dịch vụ AI bên ngoài. */
function redactSensitive(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b\d{9,12}\b/g, "[số]");
}

async function screenWithExternalAi(
  note: string,
): Promise<NoteScreening | null> {
  const apiKey = process.env.AI_API_KEY;

  if (!apiKey) return null;

  const baseUrl = (
    process.env.AI_BASE_URL ?? "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 4000);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 4000,
  );

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý sàng lọc an toàn hiến máu cho sinh viên Việt Nam. " +
              "Đọc ghi chú sức khỏe và phân loại: clear (không có dấu hiệu cần hoãn), " +
              "caution (cần nhân viên y tế xác nhận), blocked (có chống chỉ định rõ ràng, chưa nên hiến hôm nay). " +
              "Chỉ trả về JSON hợp lệ gồm: level, summary, reasons (mảng tối đa 6), advice, categories, confidence (0-1). " +
              "Không chẩn đoán bệnh, không đưa lời khuyên thay thế bác sĩ. Nếu ghi chú mơ hồ, chọn caution.",
          },
          {
            role: "user",
            content: `Ghi chú của sinh viên: ${redactSensitive(note)}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const payload: unknown = await response.json();
    const content = (payload as {
      choices?: Array<{ message?: { content?: unknown } }>;
    })?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim() === "") return null;

    const parsedJson: unknown = JSON.parse(content);
    const parsed = externalScreeningSchema.safeParse(parsedJson);

    if (!parsed.success) return null;

    const meta = LEVEL_META[parsed.data.level];

    return {
      level: parsed.data.level,
      label: meta.label,
      summary: parsed.data.summary,
      reasons: parsed.data.reasons,
      advice: parsed.data.advice || meta.advice,
      categories: parsed.data.categories,
      confidence: parsed.data.confidence,
      provider: "hybrid",
      flagged: parsed.data.level !== "clear",
      reviewedAt: new Date().toISOString(),
    };
  } catch {
    // Mất mạng / timeout / API lỗi: quay về bộ quy tắc nội bộ.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function mergeScreening(
  local: NoteScreening,
  external: NoteScreening,
): NoteScreening {
  const level =
    LEVEL_ORDER[external.level] > LEVEL_ORDER[local.level]
      ? external.level
      : local.level;
  const meta = LEVEL_META[level];
  const primary = level === external.level ? external : local;

  return {
    level,
    label: meta.label,
    summary:
      level === "clear"
        ? local.summary
        : primary.summary || meta.summary,
    reasons: [...new Set([...local.reasons, ...external.reasons])].slice(0, 6),
    advice: primary.advice || meta.advice,
    categories: [
      ...new Set([...local.categories, ...external.categories]),
    ].slice(0, 6),
    confidence: Math.max(local.confidence, external.confidence),
    provider: "hybrid",
    flagged: level !== "clear",
    reviewedAt: new Date().toISOString(),
  };
}

/**
 * Sàng lọc ghi chú. Mặc định dùng cả AI bên ngoài nếu được cấu hình.
 * `useExternal: false` hữu ích cho các trang chỉ cần hiển thị nhanh.
 */
export async function screenDonationNote(
  note: string | null | undefined,
  options: { useExternal?: boolean } = {},
): Promise<NoteScreening> {
  const normalized = normalize(note ?? "");
  const local = screenNoteWithRules(normalized);

  if (!normalized || options.useExternal === false) {
    return local;
  }

  const external = await screenWithExternalAi(normalized);

  return external ? mergeScreening(local, external) : local;
}
