import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SignSync AI — Real-Time ASL Interface",
  description: "High-performance American Sign Language (ASL) recognition system powered by MediaPipe and Random Forest.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100..900&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-bg">
          <div className="orb orb-1"></div>
          <div className="orb orb-2"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
