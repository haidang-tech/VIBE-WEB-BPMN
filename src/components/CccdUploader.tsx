"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  FileImage,
  Info,
  Loader2,
  ScanLine,
  UploadCloud,
  X,
} from "lucide-react";
import { processCccdOcr, type OcrResult } from "@/actions/ocr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MOCK_OCR_CCCD_MASKED,
  MOCK_OCR_DELAY_MS,
  MOCK_OCR_PROVIDER,
} from "@/lib/ocr-mock";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

type Props = {
  campaignId: string;
  campaignName: string;
};

function validateFile(file: File): string | null {
  if (file.size === 0) {
    return "Ảnh đang rỗng. Vui lòng chọn ảnh khác.";
  }

  if (file.size > MAX_FILE_BYTES) {
    return "Ảnh tối đa 5MB. Vui lòng chọn ảnh nhỏ hơn.";
  }

  if (file.type && !file.type.startsWith("image/")) {
    return "Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, HEIC).";
  }

  return null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
});

export default function CccdUploader({ campaignId, campaignName }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function selectFile(next: File) {
    const error = validateFile(next);

    if (error) {
      setFileError(error);
      return;
    }

    setFileError(null);
    setResult(null);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file || loading || !campaignId) return;

    setLoading(true);
    setResult(null);
    setFileError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);

      const response = await processCccdOcr(formData);
      setResult(response);

      if (response.success) {
        setFile(null);
        setPreviewUrl(null);
        router.refresh();
      }
    } catch {
      setResult({
        success: false,
        code: "NETWORK_ERROR",
        message:
          "Mất kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.",
      });
    } finally {
      setLoading(false);
    }
  }

  const resultVariant = result?.success
    ? "success"
    : result?.code === "ALREADY_CHECKED_IN"
      ? "info"
      : "destructive";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="text-primary size-4" aria-hidden />
          Quét CCCD để check-in
        </CardTitle>
        <CardDescription>
          Tải ảnh mặt trước CCCD của sinh viên. Hệ thống sẽ đối chiếu và chuyển
          hồ sơ sang trạng thái đã check-in.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-lg p-2.5 text-xs leading-relaxed">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Chế độ demo: {MOCK_OCR_PROVIDER} trả về CCCD mẫu{" "}
            <span className="text-foreground font-mono font-medium">
              {MOCK_OCR_CCCD_MASKED}
            </span>{" "}
            sau {MOCK_OCR_DELAY_MS / 1000} giây.
          </span>
        </p>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) selectFile(dropped);
          }}
          className={cn(
            "relative flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20",
          )}
        >
          {previewUrl ? (
            <div className="w-full space-y-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Ảnh CCCD đã chọn"
                className="mx-auto max-h-48 w-auto rounded-lg border object-contain"
              />
              <p className="text-muted-foreground mx-auto max-w-full truncate text-xs">
                {file?.name}
              </p>
              <div className="flex justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => inputRef.current?.click()}
                >
                  <FileImage aria-hidden />
                  Đổi ảnh
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  onClick={clearFile}
                >
                  <X aria-hidden />
                  Bỏ chọn
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
                <UploadCloud className="size-6" aria-hidden />
              </div>
              <p className="mt-3 text-sm font-medium">
                Kéo thả ảnh CCCD vào đây
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                JPG, PNG, WEBP, HEIC · tối đa 5MB
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => inputRef.current?.click()}
              >
                Chọn ảnh từ máy
              </Button>
            </>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) selectFile(selected);
              event.target.value = "";
            }}
          />
        </div>

        {fileError ? (
          <p role="alert" className="text-destructive text-xs">
            {fileError}
          </p>
        ) : null}

        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={handleSubmit}
          disabled={!file || loading || !campaignId}
        >
          {loading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden />
              Đang quét CCCD...
            </>
          ) : (
            <>
              <ScanLine aria-hidden />
              Check-in bằng CCCD
            </>
          )}
        </Button>

        <p className="text-muted-foreground text-center text-xs">
          Chiến dịch: <span className="text-foreground">{campaignName}</span>
        </p>

        {result ? (
          <Alert variant={resultVariant}>
            {result.success ? <CheckCircle2 /> : <AlertCircle />}
            <AlertTitle>
              {result.success
                ? "Check-in thành công"
                : result.code === "ALREADY_CHECKED_IN"
                  ? "Hồ sơ đã check-in"
                  : "Không thể check-in"}
            </AlertTitle>
            <AlertDescription>
              <p>{result.message}</p>

              {result.data ? (
                <dl className="mt-2 grid gap-1 text-xs">
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted-foreground">Sinh viên:</dt>
                    <dd className="font-medium">{result.data.studentName}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted-foreground">Email:</dt>
                    <dd>{result.data.studentEmail}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted-foreground">CCCD:</dt>
                    <dd className="font-mono">{result.data.cccdMasked}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted-foreground">Chiến dịch:</dt>
                    <dd>{result.data.campaignName}</dd>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <dt className="text-muted-foreground">Thời gian:</dt>
                    <dd>
                      {dateTimeFormatter.format(
                        new Date(result.data.checkInTime),
                      )}
                    </dd>
                  </div>
                </dl>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
