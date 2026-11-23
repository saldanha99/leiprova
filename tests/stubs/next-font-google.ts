// Stub de testes: no Vitest não há o compilador do Next, então cada fonte do
// next/font/google vira uma função que devolve só as classes esperadas.
type FontResult = { className: string; variable: string; style: { fontFamily: string } };

function font(name: string) {
  return (options: { variable?: string } = {}): FontResult => ({
    className: `font-${name}`,
    variable: options.variable ?? `--font-${name}`,
    style: { fontFamily: name },
  });
}

export const Manrope = font("manrope");
export const Geist_Mono = font("geist-mono");
export const Source_Serif_4 = font("source-serif-4");
