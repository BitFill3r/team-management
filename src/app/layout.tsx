import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const appFont = localFont({
  src: "../../public/fonts/public-sans.ttf",
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Am Ball · Trainingsanwesenheit",
  description: "Die geschützte Anwesenheitsliste für unser Fußballtraining.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" className={appFont.variable}><body>
    {children}
    <footer className="agency-footer">
      Powered by <a href="https://www.heydot.de" target="_blank" rel="noopener noreferrer">heydot.de</a> - HEYDOT Agency - Eltville am Rhein
    </footer>
  </body></html>;
}
