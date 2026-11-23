import { ElsLogo } from "@/components/brand/ElsLogo";

type EditalumeLogoProps = {
  compact?: boolean;
  className?: string;
};

/**
 * Logo oficial: monograma ELS (redesenho de 23/11/2026). O nome do componente foi
 * mantido para não mexer em todos os pontos que já o usam (site público e app).
 */
export function EditalumeLogo({ compact = false, className }: EditalumeLogoProps) {
  return <ElsLogo compact={compact} className={className} />;
}
