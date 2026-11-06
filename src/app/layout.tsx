import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Am Ball · Trainingsanwesenheit",
  description: "Die geschützte Anwesenheitsliste für unser Fußballtraining.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>
    {children}
    <footer className="agency-footer">
      Powered by <a href="https://www.heydot.de">heydot.de</a> - HEYDOT Agency - Eltville am Rhein
    </footer>
  </body></html>;
}
