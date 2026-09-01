export type ActiveExamSpecialization = Readonly<{
  id: number;
}>;

export type ExamSpecializationSelection =
  | Readonly<{ success: true; specializationId: number | null }>
  | Readonly<{ success: false; message: string }>;

export function resolveExamMetadataSpecialization(
  activeSpecializations: readonly ActiveExamSpecialization[],
  requestedSpecializationId: number | undefined,
): ExamSpecializationSelection {
  if (activeSpecializations.length > 0 && requestedSpecializationId === undefined) {
    return { success: false, message: "Selecione a especialização desta carreira." };
  }

  if (requestedSpecializationId === undefined) {
    return { success: true, specializationId: null };
  }

  const specialization = activeSpecializations.find(
    (candidate) => candidate.id === requestedSpecializationId,
  );
  if (!specialization) {
    return {
      success: false,
      message: "A especialização está inativa ou não pertence à carreira selecionada.",
    };
  }

  return { success: true, specializationId: specialization.id };
}
