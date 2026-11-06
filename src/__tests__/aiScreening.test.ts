import { screenNoteWithRules } from "@/lib/ai-screening";

describe("screenNoteWithRules", () => {
  it("trả clear khi sinh viên không nhập ghi chú", () => {
    const result = screenNoteWithRules("");

    expect(result.level).toBe("clear");
    expect(result.flagged).toBe(false);
    expect(result.provider).toBe("local");
  });

  it("đánh dấu blocked khi có tiền sử bệnh truyền nhiễm", () => {
    const result = screenNoteWithRules("Tôi bị viêm gan B từ năm 2020");

    expect(result.level).toBe("blocked");
    expect(result.flagged).toBe(true);
    expect(result.categories).toContain("Bệnh truyền nhiễm");
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it("đánh dấu blocked khi đang sốt", () => {
    const result = screenNoteWithRules("Hôm nay tôi đang sốt và mệt");

    expect(result.level).toBe("blocked");
    expect(result.reasons.join(" ")).toContain("nhiễm trùng");
  });

  it("đánh dấu blocked với bệnh lý nặng", () => {
    const result = screenNoteWithRules("Tôi có tiền sử suy tim");

    expect(result.level).toBe("blocked");
    expect(result.categories).toContain("Bệnh lý nặng");
  });

  it("đánh dấu caution khi đang dùng kháng sinh", () => {
    const result = screenNoteWithRules("Tôi đang dùng kháng sinh điều trị");

    expect(result.level).toBe("caution");
    expect(result.categories).toContain("Thuốc");
  });

  it("bỏ qua khi sinh viên phủ định dùng kháng sinh", () => {
    const result = screenNoteWithRules("Tôi không dùng kháng sinh");

    expect(result.level).toBe("clear");
    expect(result.categories).not.toContain("Thuốc");
  });

  it("ưu tiên mức blocked khi có nhiều dấu hiệu", () => {
    const result = screenNoteWithRules("Tôi bị cảm cúm và đang sốt");

    expect(result.level).toBe("blocked");
    expect(result.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("đánh dấu caution khi vừa hiến máu gần đây", () => {
    const result = screenNoteWithRules("Tôi vừa hiến máu cách đây 2 tháng");

    expect(result.level).toBe("caution");
    expect(result.categories).toContain("Khoảng cách hiến máu");
  });

  it("không gắn cờ ghi chú bình thường", () => {
    const result = screenNoteWithRules(
      "Tôi khỏe, chỉ muốn hiến máu vào buổi sáng",
    );

    expect(result.level).toBe("clear");
    expect(result.reasons).toHaveLength(0);
  });
});
