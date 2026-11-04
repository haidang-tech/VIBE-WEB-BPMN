import { Skeleton } from "@/components/ui/skeleton";

export default function LoginLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="bg-card w-full max-w-md space-y-6 rounded-2xl border p-6 shadow-soft"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-3">
          <Skeleton className="size-14 rounded-2xl" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <Skeleton className="mx-auto h-4 w-44" />
      </div>
    </main>
  );
}
