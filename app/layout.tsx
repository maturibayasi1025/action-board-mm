import { AddToHomeScreenGuide } from "@/components/AddToHomeScreenGuide";
import { ReferralCodeHandlerWrapper } from "@/components/ReferralCodeHandlerWrapper";
import { SentryInitializer } from "@/components/SentryInitializer";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import Navbar from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { generateRootMetadata, notoSansJP } from "@/lib/metadata";
import { ThemeProvider } from "next-themes";
import Script from "next/script";
import { Suspense } from "react";
import Footer from "./footer";
import "./globals.css";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const generateMetadata = generateRootMetadata;

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: "#F0D800",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable} suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="bg-background text-foreground">
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="gtag-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_ID}');
              `}
            </Script>
          </>
        )}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SentryInitializer />
          <Navbar />
          <main className="md:container md:mx-auto flex w-full min-w-0 flex-col items-stretch overflow-x-hidden">
            <Suspense>
              <ReferralCodeHandlerWrapper />
            </Suspense>
            {children}
          </main>
          <Footer />
          <Toaster />
          <ServiceWorkerRegister />
          <AddToHomeScreenGuide />
        </ThemeProvider>
      </body>
    </html>
  );
}
