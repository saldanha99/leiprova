import Image from "next/image";

import { cn } from "@/lib/utils";

type EditalumeLogoProps = {
  compact?: boolean;
  eager?: boolean;
  className?: string;
};

export function EditalumeLogo({
  compact = false,
  eager = false,
  className,
}: EditalumeLogoProps) {
  return (
    <span
      className={cn("editalume-logo", compact && "editalume-logo--compact", className)}
      aria-hidden="true"
    >
      <Image
        src="/brand/editalume-logo.png"
        alt=""
        width={1774}
        height={887}
        sizes={compact ? "42px" : "216px"}
        className="editalume-logo__image"
        fetchPriority={eager ? "high" : undefined}
        loading={eager ? "eager" : undefined}
      />
    </span>
  );
}
