/**
 * Confere cada questão contra a fonte oficial.
 *
 *   pnpm content:verify
 *
 * Baixa o texto consolidado no Planalto e exige que:
 *   1. o texto literal de cada questão apareça VERBATIM na fonte;
 *   2. a alternativa correta seja exatamente esse texto;
 *   3. NENHUM distrator apareça literalmente na fonte — um distrator que
 *      reproduz outro trecho da norma cria uma segunda resposta defensável,
 *      que é o defeito mais caro de um produto de literalidade.
 *
 * Não substitui a revisão humana independente: confere transcrição, não
 * mérito editorial, adequação à banca ou vigência da redação.
 */
import { DEMO_QUESTIONS, type DemoQuestion } from "../src/lib/demo-content";

// O Planalto responde 403 para o User-Agent padrão de cliente HTTP.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

function normalize(value: string) {
  return value
    .normalize("NFC")
    .replace(/ /g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—‑]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

async function fetchOfficialText(url: string) {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${url} respondeu ${response.status}`);

  // As páginas do Planalto são servidas em windows-1252, não em UTF-8.
  const buffer = await response.arrayBuffer();
  const decoded = new TextDecoder("windows-1252").decode(buffer);
  return normalize(stripHtml(decoded));
}

/** Compara ignorando a pontuação final, que varia conforme o recorte citado. */
function occursIn(haystack: string, needle: string) {
  const value = normalize(needle);
  return haystack.includes(value) || haystack.includes(value.replace(/[;.\s]+$/, ""));
}

type Problem = { question: DemoQuestion; detail: string };

async function main() {
  const sources = new Map<string, string>();
  for (const url of new Set(DEMO_QUESTIONS.map((question) => question.officialUrl))) {
    process.stdout.write(`baixando ${url}\n`);
    sources.set(url, await fetchOfficialText(url));
  }

  const problems: Problem[] = [];

  for (const question of DEMO_QUESTIONS) {
    const source = sources.get(question.officialUrl);
    if (!source) {
      problems.push({ question, detail: "fonte oficial não carregada" });
      continue;
    }

    if (!occursIn(source, question.literalText)) {
      problems.push({ question, detail: "o texto literal NÃO consta na fonte oficial" });
    }

    const correct = question.options.find((option) => option.id === question.correctOptionId);
    if (!correct) {
      problems.push({ question, detail: `correctOptionId "${question.correctOptionId}" não existe` });
    } else if (normalize(correct.text) !== normalize(question.literalText)) {
      problems.push({ question, detail: "a alternativa correta difere do texto literal" });
    }

    for (const option of question.options) {
      if (option.id === question.correctOptionId) continue;
      if (occursIn(source, option.text)) {
        problems.push({
          question,
          detail: `o distrator "${option.id}" consta literalmente na fonte — a questão tem duas respostas defensáveis`,
        });
      }
    }
  }

  const total = DEMO_QUESTIONS.length;
  const options = DEMO_QUESTIONS.reduce((sum, question) => sum + question.options.length, 0);

  if (problems.length) {
    console.error(`\n${problems.length} problema(s) em ${total} questões:\n`);
    for (const { question, detail } of problems) {
      console.error(`  [${question.articleRef}] ${detail}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `\n${total} questões e ${options} alternativas conferidas contra a fonte oficial: ` +
      `todos os gabaritos são verbatim e nenhum distrator é literal.`,
  );
  console.log("Isto confere transcrição. A revisão humana independente continua pendente.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao verificar o conteúdo.");
  process.exitCode = 1;
});
