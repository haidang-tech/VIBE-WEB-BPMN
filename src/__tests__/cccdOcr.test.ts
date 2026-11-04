import {
  extractCccdCandidates,
  findCccdLabelBox,
  hasPlausibleProvinceCode,
  normalizeCccdCandidate,
  parseCccdCandidates,
  type OcrBBox,
  type OcrLine,
} from "@/lib/cccd-ocr-parse";

function line(text: string, words: Array<[string, number]>): OcrLine {
  return {
    text,
    words: words.map(([word, confidence]) => ({ text: word, confidence })),
  };
}

function boxedLine(
  text: string,
  words: Array<{ text: string; confidence?: number; bbox: OcrBBox }>,
  bbox?: OcrBBox,
): OcrLine {
  return { text, words, bbox };
}

describe("extractCccdCandidates", () => {
  it("nhận diện số CCCD khi Tesseract trả về một từ 12 chữ số", () => {
    const candidates = extractCccdCandidates([
      line("Số / No.: 001210007890", [
        ["Số", 90],
        ["/", 80],
        ["No.:", 88],
        ["001210007890", 94],
      ]),
    ]);

    expect(candidates[0]).toMatchObject({
      cccd: "001210007890",
      source: "word",
      confidence: 94,
    });
  });

  it("ghép các nhóm số bị Tesseract tách rời trên cùng dòng", () => {
    const candidates = extractCccdCandidates([
      line("Số / No.: 001 210 007 890", [
        ["Số", 90],
        ["/", 80],
        ["No.:", 88],
        ["001", 85],
        ["210", 86],
        ["007", 84],
        ["890", 83],
      ]),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      cccd: "001210007890",
      source: "joined",
    });
  });

  it("không tạo ứng viên từ ngày sinh 8 chữ số", () => {
    const candidates = extractCccdCandidates([
      line("Ngày sinh / Date of birth: 01/01/2000", [
        ["Ngày", 95],
        ["sinh", 95],
        ["/", 90],
        ["Date", 95],
        ["of", 95],
        ["birth:", 95],
        ["01/01/2000", 92],
      ]),
    ]);

    expect(candidates).toEqual([]);
  });

  it("không cắt 12 số từ một chuỗi dài hơn", () => {
    const candidates = extractCccdCandidates([
      line("Số / No.: 0012100078901", [
        ["Số", 90],
        ["/", 80],
        ["No.:", 88],
        ["0012100078901", 90],
      ]),
    ]);

    expect(candidates).toEqual([]);
  });

  it("bỏ qua nhãn 'No.:' và số 1 chữ số khi ghép", () => {
    const candidates = extractCccdCandidates([
      line("$6 No. 001210007890", [
        ["$6", 60],
        ["No.", 70],
        ["001210007890", 96],
      ]),
    ]);

    expect(candidates.map((item) => item.cccd)).toEqual(["001210007890"]);
  });

  it("ưu tiên từ đơn có độ tin cậy cao hơn ứng viên ghép", () => {
    const candidates = extractCccdCandidates([
      line("Số / No.: 001210007890", [
        ["Số", 90],
        ["/", 80],
        ["No.:", 88],
        ["001210007890", 92],
      ]),
      line("001 210 007 890", [
        ["001", 40],
        ["210", 40],
        ["007", 40],
        ["890", 40],
      ]),
    ]);

    expect(candidates[0]).toMatchObject({
      cccd: "001210007890",
      source: "word",
    });
  });

  it("khử trùng lặp và giữ độ tin cậy cao nhất", () => {
    const candidates = extractCccdCandidates([
      line("Số / No.: 001210007890", [
        ["Số", 90],
        ["/", 80],
        ["No.:", 88],
        ["001210007890", 70],
      ]),
      line("001210007890", [["001210007890", 95]]),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].confidence).toBe(95);
  });

  it("vẫn nhận diện số CCCD khi dòng không có nhãn", () => {
    const candidates = extractCccdCandidates([
      line("001210007890", [["001210007890", 80]]),
    ]);

    expect(candidates[0].cccd).toBe("001210007890");
  });
});

describe("hasPlausibleProvinceCode", () => {
  it("chấp nhận mã tỉnh từ 001 đến 096", () => {
    expect(hasPlausibleProvinceCode("001210007890")).toBe(true);
    expect(hasPlausibleProvinceCode("096210007890")).toBe(true);
  });

  it("từ chối mã tỉnh ngoài khoảng hoặc sai độ dài", () => {
    expect(hasPlausibleProvinceCode("097210007890")).toBe(false);
    expect(hasPlausibleProvinceCode("000210007890")).toBe(false);
    expect(hasPlausibleProvinceCode("00121000789")).toBe(false);
  });
});

describe("normalizeCccdCandidate", () => {
  it("bỏ khoảng trắng, dấu chấm, gạch nối", () => {
    expect(normalizeCccdCandidate("001 210 007 890")).toBe("001210007890");
    expect(normalizeCccdCandidate("001.210.007.890")).toBe("001210007890");
    expect(normalizeCccdCandidate("001-210-007-890")).toBe("001210007890");
  });

  it("trả null khi không đủ 12 chữ số", () => {
    expect(normalizeCccdCandidate("00121000789")).toBeNull();
    expect(normalizeCccdCandidate("0012100078901")).toBeNull();
    expect(normalizeCccdCandidate("")).toBeNull();
  });
});

describe("parseCccdCandidates", () => {
  it("đọc mảng JSON, chuẩn hoá và khử trùng lặp", () => {
    expect(
      parseCccdCandidates(
        JSON.stringify([
          "001210007890",
          "001 210 007 890",
          "001203004567",
          "không phải số",
          123,
        ]),
      ),
    ).toEqual(["001210007890", "001203004567"]);
  });

  it("trả mảng rỗng với JSON lỗi hoặc không phải mảng", () => {
    expect(parseCccdCandidates("not-json")).toEqual([]);
    expect(parseCccdCandidates(JSON.stringify({ cccd: "001210007890" }))).toEqual(
      [],
    );
    expect(parseCccdCandidates(null)).toEqual([]);
  });

  it("giới hạn số ứng viên", () => {
    const raw = JSON.stringify([
      "001210007890",
      "001203004567",
      "001204001234",
    ]);

    expect(parseCccdCandidates(raw, 2)).toEqual([
      "001210007890",
      "001203004567",
    ]);
  });
});

describe("findCccdLabelBox", () => {
  const bbox = (x0: number, y0: number, x1: number, y1: number): OcrBBox => ({
    x0,
    y0,
    x1,
    y1,
  });

  it("chọn nhãn No. trên dòng số CCCD, bỏ qua 'No' trong địa chỉ", () => {
    const lines = [
      boxedLine("Số / No.: 001210007890", [
        { text: "Số", bbox: bbox(100, 690, 130, 720) },
        { text: "/", bbox: bbox(135, 690, 145, 720) },
        { text: "No.:", bbox: bbox(150, 690, 190, 720) },
        { text: "001210007890", bbox: bbox(200, 695, 380, 715) },
      ]),
      boxedLine("Nơi thường trú / Place of residence:", [
        { text: "No", bbox: bbox(100, 990, 130, 1020) },
        { text: "i", bbox: bbox(132, 990, 140, 1020) },
        { text: "thường", bbox: bbox(145, 990, 220, 1020) },
        { text: "/", bbox: bbox(265, 990, 275, 1020) },
      ]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toEqual(bbox(150, 690, 190, 720));
  });

  it("chọn nhãn bên phải nhất trên cùng dòng", () => {
    const lines = [
      boxedLine("Số / No.: 001210007890", [
        { text: "Số", bbox: bbox(100, 690, 130, 720) },
        { text: "/", bbox: bbox(135, 690, 145, 720) },
        { text: "No.:", bbox: bbox(150, 690, 190, 720) },
        { text: "001210007890", bbox: bbox(200, 695, 380, 715) },
      ]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toEqual(bbox(150, 690, 190, 720));
  });

  it("ưu tiên dòng có cụm số bên phải nhãn", () => {
    const lines = [
      boxedLine("Số / No:", [
        { text: "Số", bbox: bbox(100, 400, 130, 430) },
        { text: "/", bbox: bbox(135, 400, 145, 430) },
        { text: "No:", bbox: bbox(150, 400, 190, 430) },
      ]),
      boxedLine("Số / No.: 001210007890", [
        { text: "Số", bbox: bbox(100, 690, 130, 720) },
        { text: "/", bbox: bbox(135, 690, 145, 720) },
        { text: "No.:", bbox: bbox(150, 690, 190, 720) },
        { text: "001210007890", bbox: bbox(200, 695, 380, 715) },
      ]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toEqual(bbox(150, 690, 190, 720));
  });

  it("khi điểm bằng nhau chọn nhãn phía trên", () => {
    const lines = [
      boxedLine("No", [{ text: "No", bbox: bbox(100, 400, 130, 430) }]),
      boxedLine("No", [{ text: "No", bbox: bbox(100, 300, 130, 330) }]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toEqual(bbox(100, 300, 130, 330));
  });

  it("nhận nhãn bị dính với ký tự đứng trước (88/No.:)", () => {
    const lines = [
      boxedLine("88/No.: worz100078%0", [
        { text: "88/No.:", bbox: bbox(100, 690, 190, 720) },
        { text: "worz100078%0", bbox: bbox(200, 695, 380, 715) },
      ]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toEqual(bbox(100, 690, 190, 720));
  });

  it("trả null khi không có nhãn Số / No.", () => {
    const lines = [
      boxedLine("Họ và tên / Full name:", [
        { text: "Họ", bbox: bbox(100, 690, 130, 720) },
        { text: "và", bbox: bbox(135, 690, 160, 720) },
      ]),
    ];

    expect(findCccdLabelBox(lines, 1463)).toBeNull();
  });
});
