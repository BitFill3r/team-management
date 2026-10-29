import { redirect } from "next/navigation";
import { authenticated } from "@/lib/auth";
import Login from "@/components/login";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await authenticated()) redirect("/");
  return <Login />;
}
