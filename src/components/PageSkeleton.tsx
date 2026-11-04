import { Skeleton } from "@/components/ui/skeleton";

type PageSkeletonProps = {
  /** Số thẻ thống kê ở hàng đầu. */
  stats?: number;
  /** Hiển thị cột phụ bên phải. */
  aside?: boolean;
};

/** Skeleton dùng chung cho các trang role, đồng bộ hình dáng content. */
export default function PageSkeleton({
  stats = 4,
  aside = true,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6" aria-hidden>
      <div className="space-y-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      {stats > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: stats }, (_, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl border p-4"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
      ) : null}

      <div
        className={
          aside
            ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
            : "space-y-4"
        }
      >
        <div className="bg-card space-y-4 rounded-2xl border p-5">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-7 w-20 rounded-full" />
            </div>
          ))}
        </div>

        {aside ? (
          <div className="space-y-4">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-56 rounded-2xl" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
