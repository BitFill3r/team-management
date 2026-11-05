export type SurveyStatus = "draft" | "open" | "closed";
export type SurveyConfig = {
  title: string; description: string;
  firstLabel: string; firstPlaceholder: string; firstRequired: boolean;
  secondLabel: string; secondPlaceholder: string; secondRequired: boolean;
  secondType: "text" | "single_choice"; warnDuplicates: boolean; options: string[];
};
export type SurveyOption = { id: string; label: string };
export type Survey = Omit<SurveyConfig, "options"> & {
  id: string; token: string; status: SurveyStatus; published: boolean; version: number; options: SurveyOption[];
};
export type SurveySummary = { id: string; title: string; status: SurveyStatus; count: number };
export type SurveyResponse = {
  id: string; firstValue: string | null; secondValue: string | null; optionId: string | null;
  version: number; createdAt: string;
};
export type SurveyDetail = { survey: Survey; responses: SurveyResponse[] };
export type PublicSurvey = Pick<Survey, "title" | "description" | "firstLabel" | "firstPlaceholder" | "firstRequired" |
  "secondLabel" | "secondPlaceholder" | "secondRequired" | "secondType" | "options">;
