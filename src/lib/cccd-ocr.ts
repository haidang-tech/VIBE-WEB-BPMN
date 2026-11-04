import {
  extractCccdCandidates,
  findCccdLabelBox,
  type CccdCandidate,
  type OcrBBox,
  type OcrLine,
} from "@/lib/cccd-ocr-parse";
import type { PSM } from "tesseract.js";

export type CccdOcrImage = HTMLCanvasElement | ImageData;

export type CccdOcrResult = {
  candidates: CccdCandidate[];
  text: string;
  /** Văn bản OCR của vùng số CCCD (nếu tìm được nhãn "Số / No."). */
  cropText?: string;
};

const FULL_TARGET_WIDTH = 2600;
const FULL_MAX_WIDTH = 3000;
const FULL_MAX_UPSCALE = 6;
const CROP_TARGET_WIDTH = 1600;
const DIGITS_WHITELIST = "0123456789";

// Giá trị của Tesseract.PSM, khai báo dạng chuỗi để không kéo thư viện
// vào bundle chính (tesseract.js được import động trong getWorker).
const PSM_SPARSE_TEXT = "11" as PSM;
const PSM_SINGLE_LINE = "7" as PSM;
const PSM_SINGLE_BLOCK = "6" as PSM;

let workerPromise: Promise<import("tesseract.js").Worker> | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function get2dContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Trình duyệt không hỗ trợ canvas để nhận diện CCCD.");
  }

  return context;
}

function imageDataToCanvas(image: ImageData): HTMLCanvasElement {
  const canvas = createCanvas(image.width, image.height);
  get2dContext(canvas).putImageData(image, 0, 0);
  return canvas;
}

/**
 * Chuyển ảnh sang xám và kéo giãn tương phản theo phân vị 2%–98%.
 *
 * Ảnh chụp thẻ thường bị lóa hoặc thiếu sáng ở một phần. Kéo giãn theo
 * phân vị giúp chữ số rõ hơn mà không bị vài điểm sáng/tối cực đoan chi phối.
 */
function grayscaleAndStretch(canvas: HTMLCanvasElement): void {
  const context = get2dContext(canvas);
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const histogram = new Uint32Array(256);
  const total = canvas.width * canvas.height;

  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(
      0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2],
    );

    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
    histogram[gray] += 1;
  }

  if (total === 0) {
    context.putImageData(imageData, 0, 0);
    return;
  }

  const lowTarget = total * 0.02;
  const highTarget = total * 0.98;
  let low = 0;
  let high = 255;
  let accumulated = 0;

  for (let value = 0; value < 256; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= lowTarget) {
      low = value;
      break;
    }
  }

  accumulated = 0;

  for (let value = 0; value < 256; value += 1) {
    accumulated += histogram[value];
    if (accumulated >= highTarget) {
      high = value;
      break;
    }
  }

  const range = high - low;

  if (range >= 8) {
    const scale = 255 / range;

    for (let i = 0; i < data.length; i += 4) {
      const value = clamp(Math.round((data[i] - low) * scale), 0, 255);
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
    }
  }

  context.putImageData(imageData, 0, 0);
}

/**
 * Chuẩn hoá ảnh trước khi OCR:
 * - phóng to ảnh nhỏ để chữ số in trên thẻ đủ lớn,
 * - thu nhỏ ảnh quá lớn để giữ tốc độ,
 * - chuyển sang ảnh xám và kéo giãn tương phản.
 */
function preprocessImage(
  image: CccdOcrImage,
  targetWidth = FULL_TARGET_WIDTH,
  maxWidth = FULL_MAX_WIDTH,
  maxUpscale = FULL_MAX_UPSCALE,
): HTMLCanvasElement {
  const source =
    image instanceof HTMLCanvasElement ? image : imageDataToCanvas(image);

  let scale = 1;

  if (source.width < targetWidth) {
    scale = Math.min(maxUpscale, targetWidth / source.width);
  } else if (source.width > maxWidth) {
    scale = maxWidth / source.width;
  }

  const canvas = createCanvas(source.width * scale, source.height * scale);
  const context = get2dContext(canvas);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  grayscaleAndStretch(canvas);
  return canvas;
}

/**
 * Crop vùng ngay sau nhãn "Số / No." rồi phóng to.
 *
 * Nhãn thường được OCR đọc khá tốt ngay cả khi cụm số bị mờ. Crop sát vùng
 * số giúp Tesseract tập trung vào 12 chữ số và tránh nhiễu từ nền thẻ.
 */
function cropAfterLabel(
  source: HTMLCanvasElement,
  label: OcrBBox,
): HTMLCanvasElement {
  const labelWidth = Math.max(1, label.x1 - label.x0);
  const labelHeight = Math.max(1, label.y1 - label.y0);

  const left = clamp(
    Math.round(label.x1 + labelWidth * 0.02),
    0,
    source.width - 1,
  );
  const top = clamp(
    Math.round(label.y0 - labelHeight * 0.5),
    0,
    source.height - 1,
  );
  const width = clamp(
    Math.round(Math.max(240, labelWidth * 6)),
    1,
    source.width - left,
  );
  const height = clamp(
    Math.round(labelHeight * 2),
    1,
    source.height - top,
  );

  const scale = Math.min(4, CROP_TARGET_WIDTH / width);
  const canvas = createCanvas(width * scale, height * scale);
  const context = get2dContext(canvas);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    left,
    top,
    width,
    height,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  grayscaleAndStretch(canvas);
  return canvas;
}

function collectLines(
  blocks: Array<{
    paragraphs?: Array<{
      lines?: Array<{
        text?: string;
        bbox?: OcrBBox;
        words?: Array<{
          text?: string;
          confidence?: number;
          bbox?: OcrBBox;
        }>;
      }>;
    }>;
  }>,
): OcrLine[] {
  const lines: OcrLine[] = [];

  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        lines.push({
          text: line.text ?? "",
          bbox: line.bbox,
          words: (line.words ?? []).map((word) => ({
            text: word.text ?? "",
            confidence: word.confidence ?? 0,
            bbox: word.bbox,
          })),
        });
      }
    }
  }

  return lines;
}

async function getWorker(): Promise<import("tesseract.js").Worker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");

    // Bộ nhận diện được phục vụ từ /public/tesseract để chạy offline,
    // không phụ thuộc CDN. Worker và core đều cùng origin.
    return createWorker("eng", 1, {
      workerPath: "/tesseract/worker.min.js",
      corePath: "/tesseract",
      langPath: "/tesseract",
      gzip: true,
      workerBlobURL: false,
    });
  })().catch((error) => {
    // Cho phép thử khởi tạo lại ở lần quét sau nếu tải worker thất bại.
    workerPromise = null;
    throw error;
  });

  return workerPromise;
}

/**
 * Chạy một lượt OCR với tham số tường minh.
 *
 * Luôn đặt lại `tessedit_char_whitelist` (kể cả về chuỗi rỗng) vì Tesseract
 * giữ nguyên tham số giữa các lần gọi; nếu không, whitelist chữ số của lượt
 * crop trước sẽ làm hỏng lượt quét toàn ảnh tiếp theo.
 */
async function recognizeWithParams(
  canvas: HTMLCanvasElement,
  psm: PSM,
  whitelist = "",
): Promise<{ lines: OcrLine[]; text: string }> {
  const worker = await getWorker();

  await worker.setParameters({
    tessedit_pageseg_mode: psm,
    preserve_interword_spaces: "1",
    tessedit_char_whitelist: whitelist,
  });

  const { data } = await worker.recognize(
    canvas,
    {},
    { text: true, blocks: true },
  );

  return {
    lines: collectLines(data.blocks ?? []),
    text: data.text ?? "",
  };
}

function mergeCandidates(
  primary: CccdCandidate[],
  secondary: CccdCandidate[],
): CccdCandidate[] {
  const seen = new Set<string>();
  const merged: CccdCandidate[] = [];

  for (const candidate of [...primary, ...secondary]) {
    if (seen.has(candidate.cccd)) continue;

    seen.add(candidate.cccd);
    merged.push(candidate);
  }

  return merged;
}

/** Tải trước worker/core/ngôn ngữ để lần quét đầu không bị chậm. */
export async function warmUpCccdOcr(): Promise<void> {
  try {
    await getWorker();
  } catch {
    // Lỗi sẽ được báo khi người dùng thực sự quét ảnh.
  }
}

/** Nhận diện số CCCD từ canvas hoặc ImageData của camera/ảnh tải lên. */
export async function recognizeCccdNumber(
  image: CccdOcrImage,
): Promise<CccdOcrResult> {
  const fullCanvas = preprocessImage(image);
  const full = await recognizeWithParams(fullCanvas, PSM_SPARSE_TEXT);
  const fullCandidates = extractCccdCandidates(full.lines);

  let cropCandidates: CccdCandidate[] = [];
  let cropText: string | undefined;

  // Nếu đọc được nhãn "Số / No.", crop đúng vùng số và OCR lại với whitelist
  // chữ số. Đây là bước quyết định khi ảnh camera nhỏ hoặc hơi mờ.
  const label = findCccdLabelBox(full.lines, fullCanvas.height);

  if (label) {
    const crop = cropAfterLabel(fullCanvas, label);
    const lineResult = await recognizeWithParams(
      crop,
      PSM_SINGLE_LINE,
      DIGITS_WHITELIST,
    );

    cropCandidates = extractCccdCandidates(lineResult.lines);
    cropText = lineResult.text;

    if (cropCandidates.length === 0) {
      const blockResult = await recognizeWithParams(
        crop,
        PSM_SINGLE_BLOCK,
        DIGITS_WHITELIST,
      );

      cropCandidates = extractCccdCandidates(blockResult.lines);
      cropText = blockResult.text || cropText;
    }
  }

  return {
    // Ứng viên từ vùng số đáng tin hơn nên đứng trước.
    candidates: mergeCandidates(cropCandidates, fullCandidates),
    text: full.text,
    cropText,
  };
}

/** Nhận diện số CCCD từ file ảnh người dùng chọn. */
export async function recognizeCccdNumberFromFile(
  file: File,
): Promise<CccdOcrResult> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = url;
    await image.decode();

    const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
    get2dContext(canvas).drawImage(image, 0, 0);

    return await recognizeCccdNumber(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Giải phóng worker khi rời trang để không giữ bộ nhớ WASM. */
export async function terminateCccdOcrWorker(): Promise<void> {
  const pending = workerPromise;
  workerPromise = null;

  if (!pending) return;

  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Worker đã lỗi hoặc chưa khởi tạo xong: không cần xử lý thêm.
  }
}
