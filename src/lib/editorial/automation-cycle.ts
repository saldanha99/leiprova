import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

import * as schema from "@/lib/db/schema";
import { safeEditorialErrorCode } from "@/lib/editorial/safe-error";
import {
  dispatchDueExamLicenseRequests,
  prepareExamLicenseRequests,
  reconcileGrantedExamLicenseRequests,
  type LicenseEmailSender,
} from "@/lib/licensing/exam-license-automation";

type Database = PostgresJsDatabase<typeof schema>;

export type EditorialStepFailure = Readonly<{ step: string; code: string }>;

/** Executa uma etapa independente do ciclo. A falha vira código seguro no
 * resumo em vez de abortar as etapas seguintes e a auditoria de conclusão. */
export async function runIsolatedStep<T>(
  failures: EditorialStepFailure[],
  step: string,
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run();
  } catch (error) {
    const code = safeEditorialErrorCode(error);
    failures.push({ step, code });
    console.warn(`[etapa:${step}]`, JSON.stringify({ code }));
    return null;
  }
}

/** Preparação, conciliação e envio falham separadamente: um erro no envio não
 * impede registrar pedidos novos nem concluir licenças já concedidas. */
export async function runExamLicensingSteps(
  db: Database,
  ownerUserId: number,
  failures: EditorialStepFailure[],
  sender: LicenseEmailSender | null,
) {
  const prepared = await runIsolatedStep(failures, "licensing.prepare", () =>
    prepareExamLicenseRequests(db, ownerUserId),
  );
  const reconciled = await runIsolatedStep(failures, "licensing.reconcile", () =>
    reconcileGrantedExamLicenseRequests(db),
  );
  const dispatch = sender
    ? await runIsolatedStep(failures, "licensing.dispatch", () =>
        dispatchDueExamLicenseRequests(db, sender),
      )
    : { due: 0, sent: 0, deferred: 0, manualReview: 0 };
  return { emailEnabled: sender !== null, prepared, reconciled, dispatch };
}
