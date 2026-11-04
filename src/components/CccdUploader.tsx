"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  FileImage,
  Info,
  Loader2,
  RefreshCw,
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
const MAX_CAPTURE_WIDTH = 1280;

type Props = {
  campaignId: string;
  campaignName: string;
};

type InputMode = "upload" | "camera";

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

function cameraErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "Không thể mở camera. Vui lòng kiểm tra thiết bị và thử lại.";
  }

  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Bạn đã từ chối quyền truy cập camera. Hãy cấp quyền camera trong trình duyệt rồi thử lại.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Không tìm thấy camera phù hợp trên thiết bị.";
    case "NotReadableError":
      return "Camera đang được ứng dụng khác sử dụng. Vui lòng đóng ứng dụng đó và thử lại.";
    default:
      return "Không thể mở camera. Vui lòng kiểm tra thiết bị và thử lại.";
  }
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const modeRef = useRef<InputMode>("upload");

  const [mode, setMode] = useState<InputMode>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);

  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoStartCamera, setAutoStartCamera] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
    setCameraReady(false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Dừng camera khi unmount để không giữ đèn camera sau khi rời trang.
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Gắn stream vào <video> sau khi phần tử được render (cameraActive = true).
  useEffect(() => {
    if (!cameraActive) return;

    const video = videoRef.current;
    const stream = streamRef.current;

    if (video && stream && video.srcObject !== stream) {
      video.srcObject = stream;
      void video.play().catch(() => undefined);
    }
  }, [cameraActive]);

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

  const startCamera = useCallback(async () => {
    if (cameraStarting || cameraActive) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        "Trình duyệt hoặc kết nối hiện tại không hỗ trợ camera. Hãy dùng HTTPS hoặc localhost.",
      );
      return;
    }

    setCameraStarting(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      // Người dùng có thể đã chuyển về tab "Tải ảnh" trong lúc chờ cấp quyền.
      if (modeRef.current !== "camera") {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setCameraActive(true);
    } catch (error) {
      stopCamera();
      setCameraError(cameraErrorMessage(error));
    } finally {
      setCameraStarting(false);
    }
  }, [cameraActive, cameraStarting, stopCamera]);

  // Sau khi bấm "Chụp lại", đợi preview được xoá rồi mở camera lại.
  useEffect(() => {
    if (!autoStartCamera) return;
    if (mode !== "camera" || previewUrl) return;

    setAutoStartCamera(false);
    void startCamera();
  }, [autoStartCamera, mode, previewUrl, startCamera]);

  function switchMode(next: InputMode) {
    if (next === mode) return;

    modeRef.current = next;
    setMode(next);
    setFileError(null);

    if (next === "upload") {
      stopCamera();
    }
  }

  function capturePhoto() {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera chưa sẵn sàng. Vui lòng đợi vài giây rồi thử lại.");
      return;
    }

    const scale = Math.min(1, MAX_CAPTURE_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Trình duyệt không hỗ trợ chụp ảnh từ camera.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Không chụp được ảnh. Vui lòng thử lại.");
          return;
        }

        const captured = new File(
          [blob],
          `cccd-camera-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        );

        stopCamera();
        selectFile(captured);
      },
      "image/jpeg",
      0.9,
    );
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
        stopCamera();
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

  const isCameraMode = mode === "camera";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="text-primary size-4" aria-hidden />
          Quét CCCD để check-in
        </CardTitle>
        <CardDescription>
          Chụp trực tiếp bằng camera hoặc tải ảnh mặt trước CCCD. Hệ thống sẽ đối
          chiếu và chuyển hồ sơ sang trạng thái đã check-in.
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
          role="tablist"
          aria-label="Cách nhập ảnh CCCD"
          className="bg-muted/50 grid grid-cols-2 gap-1 rounded-lg p-1"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={mode === "upload"}
            variant={mode === "upload" ? "secondary" : "ghost"}
            size="sm"
            className="w-full"
            disabled={loading}
            onClick={() => switchMode("upload")}
          >
            <UploadCloud aria-hidden />
            Tải ảnh
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={isCameraMode}
            variant={isCameraMode ? "secondary" : "ghost"}
            size="sm"
            className="w-full"
            disabled={loading}
            onClick={() => switchMode("camera")}
          >
            <Camera aria-hidden />
            Camera
          </Button>
        </div>

        {previewUrl ? (
          <div className="border-border bg-muted/20 space-y-3 rounded-xl border-2 border-dashed p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Ảnh CCCD đã chọn"
              className="mx-auto max-h-48 w-auto rounded-lg border object-contain"
            />
            <p className="text-muted-foreground mx-auto max-w-full truncate text-center text-xs">
              {file?.name}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {isCameraMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => {
                    clearFile();
                    setAutoStartCamera(true);
                  }}
                >
                  <RefreshCw aria-hidden />
                  Chụp lại
                </Button>
              ) : (
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
              )}
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
        ) : isCameraMode ? (
          <div className="space-y-3">
            {cameraActive ? (
              <div className="relative overflow-hidden rounded-xl border border-slate-800 bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-[4/3] w-full object-cover"
                  onLoadedMetadata={() => setCameraReady(true)}
                />
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.28)]"
                />
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
                  <Button
                    type="button"
                    size="sm"
                    disabled={!cameraReady || loading}
                    onClick={capturePhoto}
                  >
                    <Camera aria-hidden />
                    Chụp ảnh
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    onClick={stopCamera}
                  >
                    <CameraOff aria-hidden />
                    Tắt camera
                  </Button>
                </div>
              </div>
            ) : (
              <div className="border-border bg-muted/20 flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center">
                <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
                  <Camera className="size-6" aria-hidden />
                </div>
                <p className="mt-3 text-sm font-medium">
                  Dùng camera để quét CCCD
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Đặt CCCD trong khung hình, đủ ánh sáng và không bị lóa.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={cameraStarting || loading}
                  onClick={startCamera}
                >
                  {cameraStarting ? (
                    <Loader2 className="animate-spin" aria-hidden />
                  ) : (
                    <Camera aria-hidden />
                  )}
                  Bật camera
                </Button>
                {cameraError ? (
                  <p
                    role="alert"
                    className="text-destructive mt-3 max-w-xs text-xs leading-relaxed"
                  >
                    {cameraError}
                  </p>
                ) : null}
              </div>
            )}

            {cameraActive && cameraError ? (
              <p role="alert" className="text-destructive text-xs leading-relaxed">
                {cameraError}
              </p>
            ) : null}
          </div>
        ) : (
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
          </div>
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
