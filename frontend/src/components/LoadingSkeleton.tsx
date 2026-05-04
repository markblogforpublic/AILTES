"use client";

interface Props {
  type?: "card" | "chart" | "table" | "text";
  count?: number;
}

export function LoadingSkeleton({ type = "card", count = 1 }: Props) {
  if (type === "text") {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-4 w-3/4 rounded-full bg-gray-200" />
        <div className="h-4 w-1/2 rounded-full bg-gray-200" />
        <div className="h-4 w-5/6 rounded-full bg-gray-200" />
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-4 h-4 w-24 rounded-full bg-gray-200" />
        <div className="h-[200px] rounded-lg bg-gray-100" />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex gap-4 border-b border-gray-100 px-4 py-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-3 flex-1 rounded-full bg-gray-200" />
          ))}
        </div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-gray-50 px-4 py-3">
            {[...Array(5)].map((_, j) => (
              <div key={j} className="h-3 flex-1 rounded-full bg-gray-100" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // card
  return (
    <div className="animate-pulse space-y-4">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-3 h-4 w-20 rounded-full bg-gray-200" />
          <div className="mb-2 h-8 w-16 rounded-full bg-gray-200" />
          <div className="h-2 w-full rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
