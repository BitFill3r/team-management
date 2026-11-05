import { notFound } from "next/navigation";
import PublicSurvey from "@/components/public-survey";
import { surveyTokenSchema } from "@/lib/survey-validation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Am Ball · Umfrage", description: "Passwortgeschützte Umfrage", robots: { index: false, follow: false } };

export default async function SurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!surveyTokenSchema.safeParse(token).success) notFound();
  return <PublicSurvey token={token} />;
}
