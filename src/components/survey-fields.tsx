"use client";

import { useId } from "react";
import type { PublicSurvey } from "@/lib/survey-types";

export type SurveyAnswers = { firstValue: string; secondValue: string; optionId: string };
export const emptySurveyAnswers: SurveyAnswers = { firstValue: "", secondValue: "", optionId: "" };
export function answerPayload(answer: SurveyAnswers) {
  return { firstValue: answer.firstValue.trim() || null, secondValue: answer.secondValue.trim() || null, optionId: answer.optionId || null };
}
export default function SurveyFields({ survey, value, onChange, disabled }: {
  survey: PublicSurvey; value: SurveyAnswers; onChange: (value: SurveyAnswers) => void; disabled: boolean;
}) {
  const id = useId();
  return <div className="survey-fields">
    <div><label htmlFor={`${id}-first`}>{survey.firstLabel} {survey.firstRequired ? "(Pflichtfeld)" : "(optional)"}</label>
      <input id={`${id}-first`} required={survey.firstRequired} maxLength={200} disabled={disabled}
        placeholder={survey.firstPlaceholder} value={value.firstValue} onChange={(event) => onChange({ ...value, firstValue: event.target.value })} /></div>
    <div><label htmlFor={`${id}-second`}>{survey.secondLabel} {survey.secondRequired ? "(Pflichtfeld)" : "(optional)"}</label>
      {survey.secondType === "text"
        ? <input id={`${id}-second`} required={survey.secondRequired} maxLength={200} disabled={disabled}
          placeholder={survey.secondPlaceholder} value={value.secondValue} onChange={(event) => onChange({ ...value, secondValue: event.target.value })} />
        : <select id={`${id}-second`} required={survey.secondRequired} disabled={disabled} value={value.optionId}
          onChange={(event) => onChange({ ...value, optionId: event.target.value })}>
          <option value="">{survey.secondRequired ? "Bitte wählen" : "Keine Angabe"}</option>
          {survey.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
        </select>}</div>
  </div>;
}
