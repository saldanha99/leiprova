/** Tema do app (aluno e admin): claro ou escuro, a partir dos mesmos tokens OKLCH. */
export type ElsTheme = "light" | "dark";

/** Cookie lido no servidor para renderizar o tema certo sem piscar. */
export const THEME_COOKIE = "els_theme";
export const THEME_STORAGE_KEY = "els-theme";
/** Atributo que marca o contêiner cujo tema o botão troca. */
export const THEME_ROOT_ATTR = "data-els-theme-root";

export function parseTheme(value: string | undefined | null): ElsTheme | null {
  return value === "light" || value === "dark" ? value : null;
}

/**
 * Script da primeira visita (sem cookie): aplica a escolha guardada no aparelho ou o
 * prefers-color-scheme antes de pintar, e grava o cookie para as próximas páginas.
 */
export function themeBootScript(rootId: string) {
  return `(function(){try{var el=document.getElementById(${JSON.stringify(rootId)});if(!el)return;var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";}el.setAttribute("data-theme",t);document.cookie=${JSON.stringify(THEME_COOKIE)}+"="+t+"; path=/; max-age=31536000; samesite=lax";}catch(e){}})();`;
}
