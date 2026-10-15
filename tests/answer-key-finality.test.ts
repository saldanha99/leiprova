import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ANSWER_KEY_DECISION_EFFECTS,
  AnswerKeyEvidenceError,
  type AnswerKeyEvidenceDocumentDraft,
  type AnswerKeyEvidenceDraft,
  answerKeyEvidenceDocuments,
  answerKeyEvidenceProvenance,
  assertAnswerKeyEvidence,
  MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
  reviewAnswerKeyEvidence,
  SUPPORTED_ANSWER_KEY_DECISION_EFFECT,
} from "../src/lib/exams/answer-key-finality";

const policySource = readFileSync(
  new URL("../src/lib/exams/answer-key-finality.ts", import.meta.url),
  "utf8",
);

const FGV = "https://conhecimento.fgv.br/sites/default/files/concursos/";

// MPRJ XXXIX/2026, preambular de 31/05/2026: evidência composta real.
const composite = MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE;

// MPRJ XXXVIII/2025, preambular de 03/08/2025: a edição anterior **tem**
// gabarito definitivo autônomo, publicado em 22/08/2025 junto com o resultado
// dos recursos. URLs, datas do portal e resumos conferidos em 14/10/2026.
const XXXVIII_EDITION = "mprj-promotor-substituto-xxxviii-2025-preambular";
const xxxviiiBooklet: AnswerKeyEvidenceDocumentDraft = {
  role: "question_booklet",
  documentType: "question_booklet",
  editionPublicId: XXXVIII_EDITION,
  title: "MPRJ XXXVIII/2025 — prova preambular — caderno Tipo 1",
  sourceUrl: `${FGV}promotor-de-justica-substitutocns001-tipo-1_0.pdf`,
  publishedOn: "2025-08-04",
  coversBookletVersions: ["Tipo 1"],
  checksumSha256:
    "77eb7ab9f4271e3e2302b85fc4be9307ee1138a5d75a7aaae728ef6e35c189ca",
};
const definitive: AnswerKeyEvidenceDraft = {
  finality: "definitive_document",
  edition: {
    publicId: XXXVIII_EDITION,
    institutionAcronym: "MPRJ",
    jurisdictionCode: "RJ",
    roleName: "Promotor de Justiça Substituto",
    examDate: "2025-08-03",
    bookletVersionLabel: "Tipo 1",
    expectedQuestionCount: 100,
  },
  documents: [
    xxxviiiBooklet,
    {
      role: "definitive_answer_key",
      documentType: "answer_key",
      editionPublicId: XXXVIII_EDITION,
      title:
        "MPRJ XXXVIII/2025 — gabarito oficial definitivo da prova preambular",
      sourceUrl: `${FGV}v2gabarito-definito-mprj-promotor.pdf`,
      publishedOn: "2025-08-22",
      coversBookletVersions: ["Tipo 1", "Tipo 2", "Tipo 3", "Tipo 4"],
      checksumSha256:
        "396569954fbdbfc970c339c72b8a64ed1cb41e5da6b83e568eff47ea475b7c02",
    },
  ],
};

// O ato de recursos do XXXVIII anulou cinco questões da Versão 1 e alterou
// outros gabaritos. Montado como evidência composta, ele precisa ser recusado:
// é o caso real que a finalidade composta **não** cobre.
const xxxviiiCompositeAttempt: AnswerKeyEvidenceDraft = {
  ...definitive,
  finality: "preliminary_plus_maintenance_act",
  documents: [
    xxxviiiBooklet,
    {
      role: "preliminary_answer_key",
      documentType: "answer_key",
      editionPublicId: XXXVIII_EDITION,
      title:
        "MPRJ XXXVIII/2025 — gabarito oficial preliminar da prova preambular",
      sourceUrl: `${FGV}mprj-promotor-2025-gabaritos-para-publicacao.pdf`,
      publishedOn: "2025-08-04",
      coversBookletVersions: ["Tipo 1", "Tipo 2", "Tipo 3", "Tipo 4"],
      checksumSha256:
        "a1b2c3d4e5f60718293a4b5c6d7e8f90112233445566778899aabbccddeeff00",
    },
    {
      role: "answer_key_maintenance_act",
      documentType: "answer_key_decision",
      editionPublicId: XXXVIII_EDITION,
      title:
        "MPRJ XXXVIII/2025 — resultado dos recursos em face do gabarito da prova preambular",
      sourceUrl: `${FGV}21.08-recursos-gabarito.pdf`,
      publishedOn: "2025-08-22",
      coversBookletVersions: ["Tipo 1", "Tipo 2", "Tipo 3", "Tipo 4"],
      checksumSha256:
        "b70218ddb53a516870536089d1a18942ce6aad4f1a7f1d31f2af4a58928610dc",
      decisionEffect: "keys_changed_and_questions_annulled",
      decisionLegalBasis:
        "art. 39, IV, da Deliberação CSMP nº 81, de 25 de março de 2025",
    },
  ],
};

function patchDocument(
  draft: AnswerKeyEvidenceDraft,
  role: string,
  patch: Partial<AnswerKeyEvidenceDocumentDraft>,
): AnswerKeyEvidenceDraft {
  return {
    ...draft,
    documents: draft.documents.map((document) =>
      document.role === role ? { ...document, ...patch } : document,
    ),
  };
}

function dropDocument(
  draft: AnswerKeyEvidenceDraft,
  role: string,
): AnswerKeyEvidenceDraft {
  return {
    ...draft,
    documents: draft.documents.filter((document) => document.role !== role),
  };
}

function documentOf(draft: AnswerKeyEvidenceDraft, role: string) {
  const found = draft.documents.find((document) => document.role === role);
  if (!found) throw new Error(`Fixture sem o papel ${role}.`);
  return found;
}

function rejection(draft: AnswerKeyEvidenceDraft) {
  const review = reviewAnswerKeyEvidence(draft);
  if (review.valid) throw new Error("Esperada recusa, obtida aprovação.");
  return review;
}

describe("política de finalidade do gabarito de prova anterior externa", () => {
  it("aceita a evidência composta real do MPRJ XXXIX e narra a união discriminada", () => {
    const review = reviewAnswerKeyEvidence(composite);
    expect(review.valid).toBe(true);
    if (!review.valid) return;
    const { evidence } = review;
    expect(evidence.finality).toBe("preliminary_plus_maintenance_act");
    if (evidence.finality !== "preliminary_plus_maintenance_act") return;

    expect(evidence.edition.examDate).toBe("2026-05-31");
    expect(evidence.edition.institutionAcronym).toBe("MPRJ");
    expect(evidence.edition.jurisdictionCode).toBe("RJ");
    expect(evidence.booklet.sourceUrl).toBe(
      `${FGV}promotor-de-justica-substituto-cns001-tipo-1.pdf`,
    );
    expect(evidence.preliminaryAnswerKey.documentType).toBe("answer_key");
    expect(evidence.maintenanceAct.documentType).toBe("answer_key_decision");
    expect(evidence.maintenanceAct.decisionEffect).toBe(
      SUPPORTED_ANSWER_KEY_DECISION_EFFECT,
    );
    // A união impede o campo da outra variante em tempo de compilação e não o
    // deixa aparecer em tempo de execução.
    expect("definitiveAnswerKey" in evidence).toBe(false);
    expect(answerKeyEvidenceDocuments(evidence)).toHaveLength(3);

    const provenance = answerKeyEvidenceProvenance(evidence);
    expect(provenance.definitiveAnswerKeyDocument).toBeNull();
    expect(provenance.decisionEffect).toBe("all_keys_maintained");
    expect(provenance.relabelProhibited).toBe(true);
  });

  it("aceita o gabarito definitivo autônomo real do MPRJ XXXVIII", () => {
    const review = reviewAnswerKeyEvidence(definitive);
    expect(review.valid).toBe(true);
    if (!review.valid || review.evidence.finality !== "definitive_document") {
      throw new Error("Esperada finalidade de documento definitivo.");
    }
    expect(review.evidence.definitiveAnswerKey.sourceUrl).toBe(
      `${FGV}v2gabarito-definito-mprj-promotor.pdf`,
    );
    expect("maintenanceAct" in review.evidence).toBe(false);
    expect(answerKeyEvidenceDocuments(review.evidence)).toHaveLength(2);
    const provenance = answerKeyEvidenceProvenance(review.evidence);
    expect(provenance.decisionEffect).toBeNull();
    expect(provenance.decisionLegalBasis).toBeNull();
  });

  it("recusa a composta real do MPRJ XXXVIII, cujo ato anulou questões e alterou gabaritos", () => {
    expect(rejection(xxxviiiCompositeAttempt).code).toBe(
      "decision_effect_unsupported",
    );
    // Os outros efeitos reais também são recusados, um a um, em vez de cair em
    // "valor desconhecido".
    for (const effect of ANSWER_KEY_DECISION_EFFECTS.filter(
      (candidate) => candidate !== SUPPORTED_ANSWER_KEY_DECISION_EFFECT,
    )) {
      expect(
        rejection(
          patchDocument(composite, "answer_key_maintenance_act", {
            decisionEffect: effect,
          }),
        ).code,
      ).toBe("decision_effect_unsupported");
    }
  });

  it("recusa composição incompleta", () => {
    expect(
      rejection(dropDocument(composite, "answer_key_maintenance_act")).code,
    ).toBe("roles_incomplete");
    expect(
      rejection(dropDocument(composite, "preliminary_answer_key")).code,
    ).toBe("roles_incomplete");
    expect(rejection(dropDocument(composite, "question_booklet")).code).toBe(
      "roles_incomplete",
    );
    expect(rejection(dropDocument(definitive, "definitive_answer_key")).code).toBe(
      "roles_incomplete",
    );
    expect(rejection({ ...composite, documents: [] }).code).toBe(
      "roles_incomplete",
    );
  });

  it("recusa papel que a finalidade declarada não admite", () => {
    // Definitivo com o ato pendurado, e composta com um definitivo acoplado.
    expect(
      rejection({
        ...definitive,
        documents: [
          ...definitive.documents,
          {
            ...documentOf(xxxviiiCompositeAttempt, "answer_key_maintenance_act"),
            decisionEffect: "all_keys_maintained",
          },
        ],
      }).code,
    ).toBe("roles_unexpected");
    expect(
      rejection({
        ...composite,
        documents: [
          ...composite.documents,
          {
            role: "definitive_answer_key",
            documentType: "answer_key",
            editionPublicId: composite.edition.publicId,
            title: "MPRJ XXXIX/2026 — gabarito definitivo inexistente",
            sourceUrl: `${FGV}gabarito-definitivo-que-nao-existe.pdf`,
            publishedOn: "2026-06-30",
            coversBookletVersions: ["Tipo 1"],
          },
        ],
      }).code,
    ).toBe("roles_unexpected");
  });

  it("recusa documento de outra edição dentro do conjunto", () => {
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          editionPublicId: XXXVIII_EDITION,
        }),
      ).code,
    ).toBe("document_edition_mismatch");
    // O caderno do XXXVIII tem nome de arquivo quase idêntico ao do XXXIX
    // (um hífen e o sufixo `_0`); trocado no conjunto, cai pela edição.
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          editionPublicId: XXXVIII_EDITION,
          sourceUrl: xxxviiiBooklet.sourceUrl,
        }),
      ).code,
    ).toBe("document_edition_mismatch");
  });

  it("recusa o mesmo documento exercendo dois papéis", () => {
    const preliminary = documentOf(composite, "preliminary_answer_key");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          sourceUrl: preliminary.sourceUrl,
        }),
      ).code,
    ).toBe("document_duplicated");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          checksumSha256: preliminary.checksumSha256,
        }),
      ).code,
    ).toBe("document_duplicated");
    // Título igual em dois papéis, com acentuação e espaçamento diferentes. O
    // texto escolhido satisfaz as duas regras de papel, para que a recusa venha
    // da duplicação e não da contradição de título.
    const shared = "MPRJ XXXIX/2026 — recursos ao gabarito preliminar";
    expect(
      rejection(
        patchDocument(
          patchDocument(composite, "preliminary_answer_key", {
            title: shared,
          }),
          "answer_key_maintenance_act",
          { title: `  ${shared.replace("preliminar", "preliminár")}  ` },
        ),
      ).code,
    ).toBe("document_duplicated");
    expect(
      rejection({
        ...composite,
        documents: [
          ...composite.documents,
          documentOf(composite, "preliminary_answer_key"),
        ],
      }).code,
    ).toBe("document_duplicated");
  });

  it("recusa gabarito preliminar relabelado como definitivo, e o inverso", () => {
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          title:
            "MPRJ XXXIX/2026 — gabarito oficial definitivo da prova preambular",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    // Relabel que **mantém** a palavra do papel verdadeiro e acrescenta a do
    // papel falso: isola a proibição, sem depender da exigência de papel.
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          title:
            "MPRJ XXXIX/2026 — gabarito preliminar, tornado definitivo após os recursos",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    expect(
      rejection(
        patchDocument(definitive, "definitive_answer_key", {
          title:
            "MPRJ XXXVIII/2025 — gabarito definitivo, provisório até o julgamento dos recursos",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          title:
            "MPRJ XXXIX/2026 — gabarito oficial definitivo após os recursos",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    expect(
      rejection(
        patchDocument(definitive, "definitive_answer_key", {
          title:
            "MPRJ XXXVIII/2025 — gabarito oficial preliminar da prova preambular",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    // Um ato precisa declarar que julga/mantém; um PDF qualquer não serve.
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          title: "MPRJ XXXIX/2026 — aviso de convocação",
        }),
      ).code,
    ).toBe("title_role_contradiction");
    // E o caderno não pode se apresentar como gabarito.
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          title: "MPRJ XXXIX/2026 — gabarito do caderno Tipo 1",
        }),
      ).code,
    ).toBe("title_role_contradiction");
  });

  it("recusa papel com tipo de documento trocado e papel desconhecido", () => {
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          documentType: "answer_key",
        }),
      ).code,
    ).toBe("document_type_mismatch");
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          documentType: "answer_key",
        }),
      ).code,
    ).toBe("document_type_mismatch");
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          documentType: "answer_key_decision",
        }),
      ).code,
    ).toBe("document_type_mismatch");
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          role: "answer_key_preliminary",
        }),
      ).code,
    ).toBe("document_role_unknown");
    for (const finality of ["definitive", "preliminary", "", "all_keys_maintained"]) {
      expect(rejection({ ...composite, finality }).code).toBe(
        "finality_unknown",
      );
    }
  });

  it("recusa gabarito que não alcança a versão do caderno de referência", () => {
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          coversBookletVersions: ["Tipo 2", "Tipo 3", "Tipo 4"],
        }),
      ).code,
    ).toBe("booklet_version_mismatch");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          coversBookletVersions: ["Tipo 4"],
        }),
      ).code,
    ).toBe("booklet_version_mismatch");
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          coversBookletVersions: ["Tipo 1", "Tipo 2"],
        }),
      ).code,
    ).toBe("booklet_version_mismatch");
    expect(
      rejection({
        ...composite,
        edition: { ...composite.edition, bookletVersionLabel: "Tipo 3" },
      }).code,
    ).toBe("booklet_version_mismatch");
    // A comparação ignora acento, caixa e espaço, mas não troca a versão.
    const review = reviewAnswerKeyEvidence(
      patchDocument(composite, "question_booklet", {
        coversBookletVersions: ["  tipo 1 "],
      }),
    );
    expect(review.valid).toBe(true);
  });

  it("recusa cronologia impossível de publicação", () => {
    const preliminary = documentOf(composite, "preliminary_answer_key");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          publishedOn: preliminary.publishedOn,
        }),
      ).code,
    ).toBe("publication_chronology_invalid");
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          publishedOn: "2026-05-30",
        }),
      ).code,
    ).toBe("publication_chronology_invalid");
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          publishedOn: composite.edition.examDate,
        }),
      ).code,
    ).toBe("publication_chronology_invalid");
  });

  it("recusa campos de decisão fora do ato e ato sem efeito ou fundamento", () => {
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          decisionEffect: "all_keys_maintained",
        }),
      ).code,
    ).toBe("decision_fields_misplaced");
    expect(
      rejection(
        patchDocument(composite, "question_booklet", {
          decisionLegalBasis:
            "art. 38, IV, da Deliberação CSMP nº 86, de 11 de dezembro de 2025",
        }),
      ).code,
    ).toBe("decision_fields_misplaced");
    // Ausente, nulo, parafraseado em português ou em caixa alta: nada disso é um
    // efeito conhecido, e nenhum é corrigido para o valor suportado.
    for (const decisionEffect of [
      undefined,
      null,
      "mantido",
      "ALL_KEYS_MAINTAINED",
      " all_keys_maintained",
    ]) {
      expect(
        rejection(
          patchDocument(composite, "answer_key_maintenance_act", {
            decisionEffect,
          }),
        ).code,
      ).toBe("decision_effect_unknown");
    }
    for (const decisionLegalBasis of [undefined, null, "", "art. 38"]) {
      expect(
        rejection(
          patchDocument(composite, "answer_key_maintenance_act", {
            decisionLegalBasis,
          }),
        ).code,
      ).toBe("decision_basis_missing");
    }
  });

  it("recusa URL que não seja link oficial externo canônico de PDF", () => {
    for (const sourceUrl of [
      `${FGV}22.06-recursos-gabarito-preambular.pdf?versao=2`,
      `${FGV}22.06-recursos-gabarito-preambular.pdf#pagina=1`,
      `http://conhecimento.fgv.br/sites/default/files/concursos/22.06-recursos-gabarito-preambular.pdf`,
      "https://usuario:senha@conhecimento.fgv.br/arquivo.pdf",
      "https://conhecimento.fgv.br:8443/arquivo.pdf",
      `${FGV}22.06-recursos-gabarito-preambular.html`,
      "/sites/default/files/concursos/22.06-recursos-gabarito-preambular.pdf",
      "",
    ]) {
      expect(
        rejection(
          patchDocument(composite, "answer_key_maintenance_act", { sourceUrl }),
        ).code,
      ).toBe("document_shape_invalid");
    }
  });

  it("recusa data inexistente e identidade de edição fora do formato", () => {
    expect(
      rejection({
        ...composite,
        edition: { ...composite.edition, examDate: "2026-02-30" },
      }).code,
    ).toBe("edition_identity_invalid");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          publishedOn: "2026-06-31",
        }),
      ).code,
    ).toBe("document_shape_invalid");
    expect(
      rejection(
        patchDocument(composite, "answer_key_maintenance_act", {
          publishedOn: "22/06/2026",
        }),
      ).code,
    ).toBe("document_shape_invalid");
    for (const edition of [
      { publicId: "MPRJ_XXXIX" },
      { publicId: "" },
      { institutionAcronym: "mprj" },
      { institutionAcronym: "M" },
      { jurisdictionCode: "RJX" },
      { jurisdictionCode: "rj" },
      { roleName: "PJ" },
      { bookletVersionLabel: "" },
      { expectedQuestionCount: 0 },
      { expectedQuestionCount: 301 },
      { expectedQuestionCount: 100.5 },
    ]) {
      expect(
        rejection({
          ...composite,
          edition: { ...composite.edition, ...edition },
        }).code,
      ).toBe("edition_identity_invalid");
    }
  });

  it("trata o resumo sha256 como metadado opcional de conferência do link", () => {
    // Ausente e nulo são aceitos: o resumo não é condição da evidência.
    const withoutChecksum = reviewAnswerKeyEvidence(
      patchDocument(composite, "answer_key_maintenance_act", {
        checksumSha256: null,
      }),
    );
    expect(withoutChecksum.valid).toBe(true);
    const bare = reviewAnswerKeyEvidence({
      ...composite,
      documents: composite.documents.map(({ checksumSha256, ...rest }) => {
        void checksumSha256;
        return rest;
      }),
    });
    expect(bare.valid).toBe(true);
    if (bare.valid) {
      expect(
        answerKeyEvidenceDocuments(bare.evidence).every(
          (document) => document.checksumSha256 === null,
        ),
      ).toBe(true);
    }
    // Informado, precisa ser hexadecimal minúsculo de 64 dígitos.
    for (const checksumSha256 of [
      "7C036CD2DEB5A8F9704FC9C449BB484EC44D74D31C22CC9EE320BE3D852DB213",
      "7c036cd2",
      `${"a".repeat(63)}z`,
      " ",
    ]) {
      expect(
        rejection(
          patchDocument(composite, "answer_key_maintenance_act", {
            checksumSha256,
          }),
        ).code,
      ).toBe("document_shape_invalid");
    }
  });

  it("lança com código estável na forma assertiva", () => {
    expect(assertAnswerKeyEvidence(composite).finality).toBe(
      "preliminary_plus_maintenance_act",
    );
    try {
      assertAnswerKeyEvidence(xxxviiiCompositeAttempt);
      throw new Error("Esperada exceção.");
    } catch (error) {
      expect(error).toBeInstanceOf(AnswerKeyEvidenceError);
      if (!(error instanceof AnswerKeyEvidenceError)) return;
      expect(error.code).toBe("decision_effect_unsupported");
      expect(error.message).toContain("mantém todos os gabaritos");
    }
  });

  it("congela o alvo conferido e não deixa a revisão devolver a mesma referência", () => {
    expect(Object.isFrozen(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE)).toBe(true);
    expect(
      Object.isFrozen(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE.documents),
    ).toBe(true);
    expect(
      Object.isFrozen(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE.documents[2]),
    ).toBe(true);
    expect(() => {
      Object.assign(MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE.edition, {
        examDate: "2025-08-03",
      });
    }).toThrow(TypeError);
    const review = reviewAnswerKeyEvidence(composite);
    if (!review.valid) throw new Error("Fixture deveria ser válida.");
    expect(review.evidence.edition).not.toBe(composite.edition);
    expect(review.evidence.edition).toEqual(composite.edition);
  });

  // Regressão de falha real reproduzida em 14/10/2026: o conjunto era aprovado
  // com `documents[1].sourceUrl = " " + documents[0].sourceUrl`. O analisador de
  // URL descartava o espaço, mas a deduplicação comparava a cadeia bruta, de modo
  // que o mesmo PDF exercia dois papéis. Cinco classes de normalização passavam;
  // só a URL byte-idêntica era recusada.
  it("recusa formas de URL que normalizam para o mesmo recurso", () => {
    const clone = () =>
      structuredClone(
        MPRJ_XXXIX_PREAMBULAR_ANSWER_KEY_EVIDENCE,
      ) as unknown as {
        documents: { sourceUrl: string }[];
      };

    // O caminho exato do relato.
    const reported = clone();
    reported.documents[1].sourceUrl = ` ${reported.documents[0].sourceUrl}`;
    expect(
      rejection(reported as unknown as AnswerKeyEvidenceDraft).code,
    ).toBe("document_shape_invalid");

    const booklet = documentOf(composite, "question_booklet").sourceUrl;
    const equivalents = [
      ` ${booklet}`,
      `${booklet} `,
      `\t${booklet}\n`,
      booklet.replace("conhecimento.fgv.br", "CONHECIMENTO.FGV.BR"),
      booklet.replace("conhecimento.fgv.br", "Conhecimento.Fgv.Br"),
      booklet.replace("conhecimento.fgv.br", "conhecimento.fgv.br:443"),
      booklet.replace("/concursos/", "/concursos/./"),
      booklet.replace("/files/concursos/", "/files/outro/../concursos/"),
    ];
    for (const sourceUrl of equivalents) {
      // Cada forma resolve para o mesmo recurso do caderno: se fosse aceita no
      // papel de gabarito preliminar, o mesmo PDF teria dois papéis.
      expect(new URL(sourceUrl).href).toBe(booklet);
      expect(
        rejection(
          patchDocument(composite, "preliminary_answer_key", { sourceUrl }),
        ).code,
      ).toBe("document_shape_invalid");
    }

    // Na forma canônica, o mesmo PDF em dois papéis continua caindo na
    // deduplicação — agora sem rota de escape por normalização.
    expect(
      rejection(
        patchDocument(composite, "preliminary_answer_key", {
          sourceUrl: booklet,
        }),
      ).code,
    ).toBe("document_duplicated");

    // O invariante que torna a deduplicação por cadeia bruta correta: toda URL
    // aceita já está na forma canônica do analisador.
    for (const document of composite.documents) {
      expect(new URL(document.sourceUrl).href).toBe(document.sourceUrl);
    }
    for (const document of definitive.documents) {
      expect(new URL(document.sourceUrl).href).toBe(document.sourceUrl);
    }
  });

  it("permanece política pura, sem banco, rede ou vocabulário comercial", () => {
    for (const forbidden of [
      "drizzle",
      "postgres",
      "@/lib/db",
      "../db/schema",
      "fetch(",
      "node:fs",
      "licensed_content",
      "hosted_copy",
      "publicationAllowed",
      "humanReview",
      "productsReleased",
      "--standing",
      "owner_standing_authorization",
      "productSlug",
      "opportunityPublicId",
    ]) {
      expect(policySource).not.toContain(forbidden);
    }
    // Nenhuma importação: o módulo não depende de nada do projeto.
    expect(policySource).not.toMatch(/^import /mu);
  });
});
