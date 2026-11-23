import { Source_Serif_4 } from "next/font/google";

/** Serifa editorial dos títulos no tema claro (home e guias públicos). Sem itálico,
 * para a home baixar só duas fontes (Manrope e esta) e ficar ≥ 90 no Lighthouse. */
export const elsSerif = Source_Serif_4({
  variable: "--font-els-serif",
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

/** Classe da variável da serifa, para o contêiner do tema claro. */
export const elsFontVariables = elsSerif.variable;
