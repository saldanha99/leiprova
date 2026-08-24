// `server-only` existe para quebrar o build se um módulo de servidor vazar para
// o cliente. No ambiente node do vitest esse risco não existe, e o pacote não
// resolve — sem este stub, nenhum módulo marcado como server-only seria testável.
export {};
