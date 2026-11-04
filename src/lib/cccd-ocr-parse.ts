/**
 * Trích xuất số CCCD 12 chữ số từ kết quả OCR.
 *
 * Tesseract trả về từng dòng/từ kèm độ tin cậy. Số CCCD trên mặt trước thẻ
 * thường nằm cùng dòng với nhãn "Số / No.:" và có thể bị tách thành nhiều
 * từ (ví dụ "001 210 007 890"). Module này gom các từ liền kề trên cùng
 * một dòng để tạo ứng viên 12 chữ số, sau đó xếp hạng theo độ tin cậy và
 * ngữ cảnh của dòng.
 *
 * File thuần, không import thư viện trình duyệt để có thể unit test.
 */

export type OcrBBox = {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
};

export type OcrWord = {
  text: string;
  confidence?: number;
  bbox?: OcrBBox;
};

export type OcrLine = {
  text: string;
  words: OcrWord[];
  bbox?: OcrBBox;
};

export type CccdCandidate = {
  cccd: string;
  confidence: number;
  source: "word" | "joined";
  lineText: string;
};

const CCCD_LENGTH = 12;
const MAX_JOIN_WORDS = 4;

/** Chỉ giữ chữ số. */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/** Chuẩn hoá một ứng viên CCCD do OCR hoặc nhập tay trả về. */
export function normalizeCccdCandidate(value: string): string | null {
  const digits = digitsOnly(value);
  return digits.length === CCCD_LENGTH ? digits : null;
}

/**
 * Đọc mảng JSON ứng viên CCCD từ form data.
 * Trả mảng đã chuẩn hoá, khử trùng lặp và giới hạn số lượng.
 */
export function parseCccdCandidates(
  raw: string | null,
  limit = 10,
): string[] {
  if (!raw || raw.trim() === "") return [];

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const unique = new Set<string>();

  for (const item of parsed) {
    if (typeof item !== "string") continue;

    const normalized = normalizeCccdCandidate(item);

    if (normalized) unique.add(normalized);
    if (unique.size >= limit) break;
  }

  return [...unique];
}

/**
 * Mã tỉnh/thành của CCCD nằm trong khoảng 001-096. Đây chỉ là điểm cộng
 * khi xếp hạng, không phải điều kiện bắt buộc, để tránh loại oan dữ liệu
 * đặc biệt.
 */
export function hasPlausibleProvinceCode(cccd: string): boolean {
  if (cccd.length !== CCCD_LENGTH) return false;

  const province = Number(cccd.slice(0, 3));
  return province >= 1 && province <= 96;
}

function isNumberLabelLine(text: string): boolean {
  return /(^|[^a-z])(s[ốo]|no\.?|cccd|identity|id\b)/i.test(text);
}

const LABEL_WORD_RE = /(?:^|[/\s])(s[ốoôóò6]|no)[:.,]*$/i;

/**
 * Tìm vị trí nhãn "Số / No." trên ảnh để crop đúng vùng số CCCD.
 *
 * Trên mặt trước thẻ, số CCCD nằm ngay sau nhãn "Số / No.:". OCR toàn ảnh
 * thường đọc được nhãn này dù cụm số bị mờ. Crop phần bên phải nhãn rồi OCR
 * lại với whitelist chữ số cho kết quả chính xác hơn nhiều.
 *
 * Có thể có nhiều từ "No" trên ảnh (ví dụ "Nơi thường trú" bị tách thành
 * "No" + "i"), nên hàm chấm điểm theo:
 * - nhãn có dấu câu (`No.` / `No:`),
 * - có cụm số ở bên phải nhãn,
 * - dòng có "/" hoặc "Số",
 * - vị trí ở nửa trên ảnh.
 */
export function findCccdLabelBox(
  lines: OcrLine[],
  imageHeight?: number,
): OcrBBox | null {
  let best: { box: OcrBBox; score: number; y: number } | null = null;

  for (const line of lines) {
    const words = line.words ?? [];
    let labelIndex = -1;

    // Chọn nhãn nằm bên phải nhất trên dòng: với "Số / No.:" thì "No."
    // đứng ngay trước cụm số, crop từ đây sẽ sạch hơn.
    for (let i = 0; i < words.length; i += 1) {
      if (LABEL_WORD_RE.test((words[i].text ?? "").trim())) {
        labelIndex = i;
      }
    }

    if (labelIndex === -1) continue;

    const label = words[labelIndex];
    if (!label.bbox) continue;

    const labelText = (label.text ?? "").trim();
    const rightWords = words.slice(labelIndex + 1);

    let score = 0;
    if (/[:.,]$/.test(labelText)) score += 3;
    if (rightWords.some((word) => digitsOnly(word.text ?? "").length >= 6)) {
      score += 3;
    }
    if ((line.text ?? "").includes("/")) score += 1;
    if (/s[ốo]/i.test(line.text ?? "")) score += 2;

    const y = label.bbox.y0;
    if (imageHeight && imageHeight > 0 && y / imageHeight < 0.6) {
      score += 1;
    }

    if (!best || score > best.score || (score === best.score && y < best.y)) {
      best = { box: label.bbox, score, y };
    }
  }

  return best?.box ?? null;
}

function normalizeCandidate(
  digits: string,
  confidence: number,
  source: CccdCandidate["source"],
  lineText: string,
): CccdCandidate | null {
  if (digits.length !== CCCD_LENGTH) return null;

  return {
    cccd: digits,
    confidence: Math.max(0, Math.min(100, confidence)),
    source,
    lineText,
  };
}

/**
 * Trích xuất và xếp hạng các ứng viên CCCD từ các dòng OCR.
 *
 * Ứng viên đến từ hai nguồn:
 * - "word": một từ đã đúng 12 chữ số.
 * - "joined": nhiều từ liền kề trên cùng dòng ghép lại đủ 12 chữ số.
 *
 * Ưu tiên từ đơn, dòng có nhãn "Số / No.", mã tỉnh hợp lệ và độ tin cậy cao.
 */
export function extractCccdCandidates(lines: OcrLine[]): CccdCandidate[] {
  const byCccd = new Map<string, CccdCandidate>();

  const add = (candidate: CccdCandidate | null) => {
    if (!candidate) return;

    const existing = byCccd.get(candidate.cccd);
    if (!existing) {
      byCccd.set(candidate.cccd, candidate);
      return;
    }

    // Giữ nguồn "word" (một từ duy nhất) và độ tin cậy cao hơn.
    const better =
      candidate.source === "word" && existing.source !== "word"
        ? candidate
        : candidate.confidence > existing.confidence
          ? candidate
          : existing;

    byCccd.set(candidate.cccd, better);
  };

  for (const line of lines) {
    const lineText = line.text ?? "";
    const words = line.words ?? [];

    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      const wordDigits = digitsOnly(word.text ?? "");
      const wordConfidence = word.confidence ?? 0;

      add(normalizeCandidate(wordDigits, wordConfidence, "word", lineText));

      // Ghép các nhóm số liền kề khi OCR tách số thành nhiều từ.
      // Bỏ qua nhóm 1 chữ số (thường là dấu câu/nhãn bị đọc nhầm) để
      // tránh tạo ứng viên sai từ nhãn "Số / No.:".
      if (wordDigits.length < 2) continue;

      let joined = wordDigits;
      for (
        let j = i + 1;
        j < words.length && j <= i + MAX_JOIN_WORDS;
        j += 1
      ) {
        const nextDigits = digitsOnly(words[j].text ?? "");
        if (nextDigits.length < 2) continue;

        joined += nextDigits;
        if (joined.length > CCCD_LENGTH) break;

        if (joined.length === CCCD_LENGTH) {
          add(
            normalizeCandidate(
              joined,
              Math.min(wordConfidence, words[j].confidence ?? 0),
              "joined",
              lineText,
            ),
          );
          break;
        }
      }
    }
  }

  return [...byCccd.values()]
    .map((candidate) => ({
      candidate,
      score:
        candidate.confidence +
        (candidate.source === "word" ? 30 : 0) +
        (isNumberLabelLine(candidate.lineText) ? 20 : 0) +
        (hasPlausibleProvinceCode(candidate.cccd) ? 10 : 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score || b.candidate.confidence - a.candidate.confidence,
    )
    .map(({ candidate }) => candidate);
}
