export const opportunityLifecycleLabels = {
  authorized: "Autorizado",
  commission_formed: "Comissão formada",
  organizer_selected: "Responsável definido",
  pre_notice: "Pré-edital",
  notice_published: "Edital publicado",
  registration_open: "Inscrições abertas",
  registration_closed: "Inscrições encerradas",
  exam_scheduled: "Prova agendada",
  exam_held: "Prova realizada",
  result_published: "Resultado publicado",
  homologated: "Homologado",
  closed: "Encerrado",
  suspended: "Suspenso",
  canceled: "Cancelado",
} as const;

export const responsibleTypeLabels = {
  external_organizer: "Banca externa",
  institutional_commission: "Comissão institucional",
  hybrid: "Arranjo híbrido",
} as const;

export function getOpportunityLifecycleLabel(status: string) {
  return opportunityLifecycleLabels[status as keyof typeof opportunityLifecycleLabels] ?? status;
}

export function getResponsibleTypeLabel(type: string | null) {
  if (!type) return null;
  return responsibleTypeLabels[type as keyof typeof responsibleTypeLabels] ?? type;
}

export function formatOpportunityDate(value: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00-03:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}
