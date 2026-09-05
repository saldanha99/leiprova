import { ArrowUpRight, Menu } from "lucide-react";
import Link from "next/link";

import { BrandMark } from "@/components/brand/BrandMark";
import { LOGIN_HREF, primaryCta } from "@/lib/funnel";

const NAV_ITEMS = [
  { href: "/concursos", label: "Concursos" },
  { href: "/metodologia", label: "Método" },
  { href: "#laboratorio", label: "Laboratório" },
  { href: "#recursos", label: "Recursos" },
  { href: "/fontes-e-atualizacao", label: "Fontes" },
  { href: "#planos", label: "Planos" },
] as const;

export function LandingHeader({ commerceOpen }: { commerceOpen: boolean }) {
  const { href: primaryHref, label: primaryLabel } = primaryCta(commerceOpen, "Começar agora", {
    fromHome: true,
    closedLabel: "Ver planos",
  });

  return (
    <header className="landing-header">
      <div className="site-container landing-header__inner">
        <BrandMark />

        <nav className="landing-header__nav" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="landing-header__actions">
          <Link className="header-login" href={LOGIN_HREF}>
            Entrar
          </Link>
          <Link className="button button--small button--amber" href={primaryHref}>
            {primaryLabel}
            <ArrowUpRight aria-hidden="true" size={16} />
          </Link>
        </div>

        <details className="mobile-menu">
          <summary aria-label="Abrir navegação">
            <Menu aria-hidden="true" size={22} />
            <span className="sr-only">Menu</span>
          </summary>
          <div className="mobile-menu__panel">
            <nav aria-label="Navegação móvel">
              {NAV_ITEMS.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mobile-menu__actions">
              <Link href={LOGIN_HREF}>Entrar</Link>
              <Link className="button button--amber" href={primaryHref}>
                {primaryLabel}
              </Link>
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
