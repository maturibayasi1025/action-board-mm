import { cn } from "@/lib/utils/utils";
import Image from "next/image";

interface LoadingProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  fullScreen?: boolean;
}

const sizeMap = {
  sm: { width: 38, height: 32 },
  md: { width: 57, height: 48 },
  lg: { width: 86, height: 72 },
};

export function Loading({
  className,
  size = "md",
  fullScreen = false,
}: LoadingProps) {
  const imageSize = sizeMap[size];

  const content = (
    <div className={cn("flex flex-col items-center justify-center", className)}>
      <Image
        src="/img/MMHD_symbol.png"
        alt="Loading"
        width={imageSize.width}
        height={imageSize.height}
        className="animate-spin"
        priority
      />
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
}
