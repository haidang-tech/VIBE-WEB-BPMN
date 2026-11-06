"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Camera,
  CameraOff,
  CheckCircle2,
  FileImage,
  Keyboard,
  RefreshCw,
  ScanLine,
  UploadCloud,
  X,
} from "lucide-react";
import {
  lookupCccdForMedical,
  lookupCccdForMedicalManual,
  manualCheckIn,
  processCccdOcr,
  type MedicalLookupResult,
  type OcrResult,
} from "@/actions/ocr";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfoTooltip } from "@/components/ui/tooltip";
import {
  recognizeCccdNumber,
  recognizeCccdNumberFromFile,
  terminateCccdOcrWorker,
  warmUpCccdOcr,
} from "@/lib/cccd-ocr";
import { cn } from "@/lib/utils";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_CAPTURE_WIDTH = 1920;

type Props = {
  campaignId: string;
  campaignName: string;
  /**
   * "checkin": quét CCCD để check-in (Ban tổ chức).
   * "medical": quét CCCD để mở hồ sơ nhập chỉ số khám (không check-in).
   */
  intent?: "checkin" | "medical";
};

type UploaderResult = OcrResult | MedicalLookupResult;

type InputMode = "upload" | "camera" | "manual";

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

export default function CccdUploader({
  campaignId,
  intent = "checkin",
}: Props) {
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
  const [result, setResult] = useState<UploaderResult | null>(null);

  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [autoStartCamera, setAutoStartCamera] = useState(false);

  // Tự động nhận diện CCCD khi camera đang bật.
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [scanPaused, setScanPaused] = useState(false);
  const [autoScanning, setAutoScanning] = useState(false);
  const autoScanInFlightRef = useRef(false);
  const autoScanMissesRef = useRef(0);
  const [manualCccd, setManualCccd] = useState("");

  const isMedical = intent === "medical";

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

  // Giải phóng worker OCR khi rời trang để không giữ bộ nhớ WASM.
  useEffect(() => {
    return () => {
      void terminateCccdOcrWorker();
    };
  }, []);

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

    // Tải trước bộ nhận diện để lần quét đầu không phải chờ worker.
    void warmUpCccdOcr();

    // Ở chế độ tải ảnh, chọn ảnh mới thì xoá số CCCD cũ để tránh đối chiếu nhầm.
    if (mode === "upload") {
      setManualCccd("");
    }

    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  }

  function clearFile() {
    setFile(null);
    setPreviewUrl(null);
    setFileError(null);
    setManualCccd("");
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

    // Tải bộ nhận diện song song với lúc xin quyền camera.
    void warmUpCccdOcr();

    setCameraStarting(true);
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
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
      setScanPaused(false);
      autoScanMissesRef.current = 0;
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
    setResult(null);

    if (next === "camera") {
      void warmUpCccdOcr();
    } else {
      stopCamera();
    }
  }

  const captureFrame = useCallback(async (): Promise<{
    file: File;
    imageData: ImageData;
  } | null> => {
    const video = videoRef.current;

    if (!video || !video.videoWidth || !video.videoHeight) {
      return null;
    }

    const scale = Math.min(1, MAX_CAPTURE_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    try {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (!blob) return null;

      return {
        file: new File([blob], `cccd-camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        }),
        imageData,
      };
    } catch {
      return null;
    }
  }, []);

  async function capturePhoto() {
    const captured = await captureFrame();

    if (!captured) {
      setCameraError(
        "Camera chưa sẵn sàng hoặc không chụp được ảnh. Vui lòng thử lại.",
      );
      return;
    }

    stopCamera();
    selectFile(captured.file);
  }

  /**
   * Tự động chụp frame hiện tại, nhận diện số CCCD in trên thẻ bằng OCR
   * rồi gửi các ứng viên lên server để đối chiếu hồ sơ.
   *
   * Nếu không nhận diện được số nào, tuyệt đối không check-in hộ hồ sơ khác.
   */
  const runAutoScan = useCallback(async () => {
    if (autoScanInFlightRef.current || loading) return;
    if (!campaignId || !cameraReady) return;

    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    autoScanInFlightRef.current = true;
    setAutoScanning(true);

    try {
      const captured = await captureFrame();
      if (!captured) return;

      let candidates: string[];

      try {
        const ocr = await recognizeCccdNumber(captured.imageData);
        candidates = ocr.candidates.slice(0, 5).map((item) => item.cccd);
      } catch {
        setResult({
          success: false,
          code: "OCR_ERROR",
          message:
            "Không tải được bộ nhận diện CCCD. Vui lòng nhập tay 12 số in trên thẻ.",
        });
        setScanPaused(true);
        return;
      }

      if (candidates.length === 0) {
        // Chưa thấy số CCCD trong khung hình: tiếp tục quét.
        return;
      }

      // Autofill số nhận diện được để người dùng thấy hệ thống đang đối chiếu đúng thẻ.
      setManualCccd(candidates[0]);

      const formData = new FormData();
      formData.append("file", captured.file);
      formData.append("campaignId", campaignId);
      formData.append("cccdCandidates", JSON.stringify(candidates));
      formData.append("source", "CAMERA_AUTO");

      let response: UploaderResult;

      try {
        response = isMedical
          ? await lookupCccdForMedical(formData)
          : await processCccdOcr(formData);
      } catch {
        // Lỗi mạng: xoá autofill để vòng quét tiếp tục thử lại.
        setManualCccd("");
        return;
      }

      if (response.success) {
        autoScanMissesRef.current = 0;
        setManualCccd("");

        if (isMedical && response.data) {
          setResult(response);
          setScanPaused(true);
          router.push(
            `/medical/health-check?campaignId=${encodeURIComponent(
              campaignId,
            )}&registrationId=${encodeURIComponent(
              response.data.registrationId,
            )}`,
          );
          return;
        }

        setResult(response);
        setScanPaused(true);
        router.refresh();
        return;
      }

      // Ảnh camera có thể lệch nét ở frame này nhưng rõ hơn ở frame sau.
      // Với lỗi "không khớp / mơ hồ", thử thêm vài frame trước khi dừng quét
      // và báo lỗi, tránh việc một lần đọc sai làm gián đoạn trải nghiệm.
      if (
        response.code === "CCCD_NOT_FOUND" ||
        response.code === "AMBIGUOUS_CCCD"
      ) {
        autoScanMissesRef.current += 1;

        if (autoScanMissesRef.current < 3) {
          setManualCccd("");
          return;
        }

        autoScanMissesRef.current = 0;
        setResult(response);
        setScanPaused(true);
        return;
      }

      // Lỗi tạm thời: xoá autofill để vòng quét tiếp tục thử lại.
      if (
        response.code === "CONFLICT" ||
        response.code === "INTERNAL_ERROR" ||
        response.code === "NETWORK_ERROR"
      ) {
        setManualCccd("");
        return;
      }

      // Các lỗi còn lại cần người dùng xử lý (CCCD không khớp, hồ sơ chưa
      // duyệt, đã check-in...): dừng quét và hiển thị kết quả.
      setResult(response);
      setScanPaused(true);
    } finally {
      autoScanInFlightRef.current = false;
      setAutoScanning(false);
    }
  }, [campaignId, cameraReady, captureFrame, isMedical, loading, router]);

  // Quét tự động mỗi ~2,6 giây khi camera đang bật và chưa có kết quả.
  useEffect(() => {
    if (!cameraActive || !autoScanEnabled || scanPaused || previewUrl) return;
    if (manualCccd.trim() !== "") return;

    const kickoff = window.setTimeout(() => {
      void runAutoScan();
    }, 800);
    const interval = window.setInterval(() => {
      void runAutoScan();
    }, 2600);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(interval);
    };
  }, [
    autoScanEnabled,
    cameraActive,
    manualCccd,
    previewUrl,
    runAutoScan,
    scanPaused,
  ]);

  async function handleSubmit() {
    if (loading || !campaignId) return;

    // Check-in thủ công: không cần ảnh, chỉ cần đúng 12 số CCCD.
    if (mode === "manual") {
      const trimmedCccd = manualCccd.trim();

      if (!/^\d{12}$/.test(trimmedCccd)) {
        setFileError("Số CCCD phải gồm đúng 12 chữ số.");
        return;
      }

      setLoading(true);
      setResult(null);
      setFileError(null);

      try {
        if (isMedical) {
          const response = await lookupCccdForMedicalManual({
            campaignId,
            cccd: trimmedCccd,
          });
          setResult(response);

          if (response.success && response.data) {
            setManualCccd("");
            router.push(
              `/medical/health-check?campaignId=${encodeURIComponent(
                campaignId,
              )}&registrationId=${encodeURIComponent(
                response.data.registrationId,
              )}`,
            );
          }
        } else {
          const response = await manualCheckIn({
            campaignId,
            cccd: trimmedCccd,
          });
          setResult(response);

          if (response.success) {
            setManualCccd("");
            router.refresh();
          }
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

      return;
    }

    if (!file) return;

    const trimmedCccd = manualCccd.trim();

    if (trimmedCccd !== "" && !/^\d{12}$/.test(trimmedCccd)) {
      setFileError("Số CCCD phải gồm đúng 12 chữ số.");
      return;
    }

    setLoading(true);
    setResult(null);
    setFileError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignId", campaignId);
      formData.append("source", mode === "camera" ? "CAMERA_MANUAL" : "UPLOAD");

      if (trimmedCccd !== "") {
        formData.append("cccd", trimmedCccd);
      } else {
        let candidates: string[];

        try {
          const ocr = await recognizeCccdNumberFromFile(file);
          candidates = ocr.candidates.slice(0, 5).map((item) => item.cccd);
        } catch {
          setFileError(
            "Không tải được bộ nhận diện CCCD. Vui lòng nhập tay 12 số in trên thẻ.",
          );
          return;
        }

        if (candidates.length === 0) {
          setFileError(
            "Không nhận diện được số CCCD trên ảnh. Vui lòng nhập tay 12 số in trên thẻ hoặc chụp lại ảnh rõ hơn.",
          );
          return;
        }

        setManualCccd(candidates[0]);
        formData.append("cccdCandidates", JSON.stringify(candidates));
      }

      const response = isMedical
        ? await lookupCccdForMedical(formData)
        : await processCccdOcr(formData);
      setResult(response);

      if (response.success) {
        setFile(null);
        setPreviewUrl(null);
        setManualCccd("");
        stopCamera();

        if (isMedical && response.data) {
          router.push(
            `/medical/health-check?campaignId=${encodeURIComponent(
              campaignId,
            )}&registrationId=${encodeURIComponent(
              response.data.registrationId,
            )}`,
          );
          return;
        }

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
  const isManualMode = mode === "manual";
  const canManualSubmit = /^\d{12}$/.test(manualCccd.trim());
  const showSuccessStatus = Boolean(result?.success) && scanPaused;
  const successLabel = isMedical
    ? "Đã tìm thấy hồ sơ khám"
    : "Check-in thành công";
  const cameraStatusLabel = !cameraReady
    ? "Đang khởi động camera..."
    : autoScanning
      ? "Đang nhận diện số CCCD..."
      : scanPaused
        ? result?.success
          ? successLabel
          : result
            ? "Cần xử lý kết quả"
            : "Đã tạm dừng quét"
        : autoScanEnabled
          ? "Đưa mặt trước CCCD vào khung hình"
          : "Tự động quét đang tắt";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ScanLine className="text-primary size-4" aria-hidden />
          {isMedical
            ? "Quét CCCD để nhập chỉ số khám"
            : "Quét CCCD để check-in"}
          <InfoTooltip
            label={`OCR đọc vùng số trên mặt trước thẻ rồi đối chiếu hồ sơ ${
              isMedical ? "trong chiến dịch đang chọn" : "đã duyệt"
            }. Ảnh mờ thì nhập tay 12 số in trên thẻ.`}
            side="top"
          />
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div
          role="tablist"
          aria-label="Cách nhập ảnh CCCD"
          className="bg-muted/50 grid grid-cols-3 gap-1 rounded-lg p-1"
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
          <Button
            type="button"
            role="tab"
            aria-selected={isManualMode}
            variant={isManualMode ? "secondary" : "ghost"}
            size="sm"
            className="w-full"
            disabled={loading}
            onClick={() => switchMode("manual")}
          >
            <Keyboard aria-hidden />
            Nhập tay
          </Button>
        </div>

        {previewUrl && !isManualMode ? (
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
              <div className="relative overflow-hidden rounded-xl border border-border bg-black">
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
                <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
                  <span
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
                      autoScanning
                        ? "bg-primary/90 text-primary-foreground"
                        : showSuccessStatus
                          ? "bg-success/90 text-success-foreground"
                          : scanPaused
                            ? "bg-amber-500/90 text-white"
                            : "bg-black/60 text-white",
                    )}
                  >
                    {!cameraReady || autoScanning ? (
                      <ScanLine className="size-3.5 animate-pulse" aria-hidden />
                    ) : showSuccessStatus ? (
                      <CheckCircle2 className="size-3.5" aria-hidden />
                    ) : scanPaused ? (
                      <AlertCircle className="size-3.5" aria-hidden />
                    ) : (
                      <ScanLine className="size-3.5" aria-hidden />
                    )}
                    {cameraStatusLabel}
                  </span>
                </div>
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
                  Dùng camera để nhận diện số CCCD
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Đặt mặt trước CCCD trong khung hình, để phần số CCCD rõ nét và
                  đủ ánh sáng.
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
                    <Camera className="animate-pulse" aria-hidden />
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

            {cameraActive ? (
              <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-start gap-2">
                  <ScanLine
                    className="text-primary mt-0.5 size-4 shrink-0"
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Tự động nhận diện CCCD
                    </p>
                    <p className="text-muted-foreground text-xs">
                      Tự nhận diện số CCCD khi thẻ nằm trong khung hình.
                    </p>
                  </div>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium">
                  <input
                    type="checkbox"
                    className="accent-primary size-4"
                    checked={autoScanEnabled}
                    disabled={loading}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      setAutoScanEnabled(enabled);
                      if (enabled) setScanPaused(false);
                    }}
                  />
                  {autoScanEnabled ? "Đang bật" : "Đang tắt"}
                </label>
              </div>
            ) : null}
          </div>
        ) : isManualMode ? (
          <div className="border-border bg-primary/5 flex min-h-52 flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center">
            <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-full">
              <Keyboard className="size-6" aria-hidden />
            </div>
            <p className="mt-3 text-sm font-medium">
              {isMedical
                ? "Tra cứu hồ sơ khám khi camera gặp sự cố"
                : "Check-in thủ công khi camera gặp sự cố"}
            </p>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
              Nhập đúng 12 số CCCD in trên thẻ. Hệ thống chỉ mở đúng hồ sơ
              khớp duy nhất trong chiến dịch đang chọn.
            </p>
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

        <div className="space-y-1.5">
          <Label htmlFor="manual-cccd" className="flex items-center gap-1 text-xs">
            {isManualMode
              ? isMedical
                ? "Nhập số CCCD để mở hồ sơ khám"
                : "Nhập số CCCD để check-in"
              : "Số CCCD (12 chữ số)"}
            <InfoTooltip
              label={
                isManualMode
                  ? "Nhập đúng 12 số in trên thẻ CCCD. Phương án này dùng khi camera hoặc OCR không hoạt động."
                  : "Hệ thống tự điền 12 số nhận diện được. Nếu ảnh mờ, nhập tay rồi bấm Check-in."
              }
              side="top"
            />
          </Label>
          <Input
            id="manual-cccd"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ví dụ: 001203004567"
            value={manualCccd}
            maxLength={12}
            disabled={loading}
            onChange={(event) => {
              setManualCccd(
                event.target.value.replace(/\D/g, "").slice(0, 12),
              );
              setFileError(null);
              setScanPaused(false);
            }}
          />
        </div>

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
          disabled={
            loading ||
            !campaignId ||
            (isManualMode ? !canManualSubmit : !file)
          }
        >
          {loading ? (
            <>
              <ScanLine className="animate-pulse" aria-hidden />
              {isManualMode
                ? isMedical
                  ? "Đang mở hồ sơ..."
                  : "Đang check-in..."
                : "Đang quét CCCD..."}
            </>
          ) : (
            <>
              {isManualMode ? (
                <Keyboard aria-hidden />
              ) : (
                <ScanLine aria-hidden />
              )}
              {isManualMode
                ? isMedical
                  ? "Mở hồ sơ khám"
                  : "Check-in thủ công"
                : isMedical
                  ? "Mở hồ sơ khám"
                  : "Check-in bằng CCCD"}
            </>
          )}
        </Button>

        {result ? (
          <Alert variant={resultVariant}>
            {result.success ? <CheckCircle2 /> : <AlertCircle />}
            <AlertTitle>
              {result.success
                ? isMedical
                  ? "Đã mở hồ sơ khám"
                  : "Check-in thành công"
                : result.code === "ALREADY_CHECKED_IN"
                  ? "Hồ sơ đã check-in"
                  : isMedical
                    ? "Không thể mở hồ sơ khám"
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
                  {isMedical ? (
                    <div className="flex flex-wrap gap-1">
                      <dt className="text-muted-foreground">Trạng thái:</dt>
                      <dd>{result.data.status}</dd>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      <dt className="text-muted-foreground">Thời gian:</dt>
                      <dd>
                        {result.data.checkInTime
                          ? dateTimeFormatter.format(
                              new Date(result.data.checkInTime),
                            )
                          : "—"}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : null}

              {isCameraMode && cameraActive && scanPaused ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    setResult(null);
                    setScanPaused(false);
                    setManualCccd("");
                    autoScanMissesRef.current = 0;
                  }}
                >
                  <RefreshCw aria-hidden />
                  Quét tiếp
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
