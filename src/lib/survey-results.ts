import type { Survey, SurveyResponse } from "./survey-types";

export function duplicateResponses(survey: Survey, responses: SurveyResponse[]) {
  const counts = new Map<string, number>();
  if (survey.warnDuplicates) for (const response of responses) {
    const key = response.firstValue?.trim().toLocaleLowerCase("de");
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set(responses.filter((response) =>
    response.firstValue && (counts.get(response.firstValue.trim().toLocaleLowerCase("de")) ?? 0) > 1).map((response) => response.id));
}
export function surveyCounts(survey: Survey, responses: SurveyResponse[]) {
  return survey.options.map((option) => ({ ...option, count: responses.filter((response) => response.optionId === option.id).length }));
}
export function surveyCsv(survey: Survey, responses: SurveyResponse[]) {
  const cell = (value: string) => {
    const safe = /^[\s]*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  const rows = [
    [survey.firstLabel, survey.secondLabel, "Eingegangen am"],
    ...responses.map((response) => [response.firstValue ?? "",
      survey.secondType === "text" ? response.secondValue ?? "" : survey.options.find((option) => option.id === response.optionId)?.label ?? "",
      new Date(response.createdAt).toISOString()]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n") + "\r\n";
}
