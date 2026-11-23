import type { LucideIcon } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <header className="flex items-start gap-4">
      <span className="mt-1 grid size-11 shrink-0 place-items-center rounded-2xl border border-els-amber/15 bg-els-amber/8 text-els-amber">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[.16em] text-els-green">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-els-fg-3">{description}</p>
      </div>
    </header>
  );
}
