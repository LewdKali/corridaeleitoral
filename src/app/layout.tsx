import type { Metadata } from "next";
import { Bebas_Neue, Outfit } from "next/font/google";
import "./globals.css";

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Outfit({
  subsets: ["latin"],
  variable: "--font-body",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://corridaeleitoral.vercel.app";

const ogImage =
  "https://pub-60d6e7a5e9304d9fadc59f3b46aa9d67.r2.dev/capas/lula.png";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Corrida Eleitoral: Lula x Flávio",
  description:
    "Paródia interativa da corrida eleitoral. Cada pagamento soma votos simbólicos.",
  openGraph: {
    title: "Corrida Eleitoral: Lula x Flávio",
    description:
      "Escolha um lado. Cada PIX confirmado soma votos simbólicos na disputa.",
    url: siteUrl,
    siteName: "Corrida Eleitoral",
    locale: "pt_BR",
    type: "website",
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: "Flávio X Lula — Brasil em Debate",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Corrida Eleitoral: Lula x Flávio",
    description:
      "Escolha um lado. Cada PIX confirmado soma votos simbólicos na disputa.",
    images: [ogImage],
  },
  icons: {
    icon: ogImage,
    apple: ogImage,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${body.variable} h-full`}>
      <body className="relative flex min-h-full flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
