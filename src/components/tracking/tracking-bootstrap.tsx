"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { browserCaptureAttribution } from "@/lib/tracking";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
/** Domínio próprio do Stape (GTM server-side). Sem ele, usa o loader padrão do Google. */
const GTM_LOADER_ORIGIN = (process.env.NEXT_PUBLIC_GTM_SERVER_URL?.trim() || "https://www.googletagmanager.com").replace(/\/$/, "");
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;

function CaptureOnNavigation() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    browserCaptureAttribution();
  }, [pathname, searchParams]);
  return null;
}

/** Captura UTMs/click ids/cookies em toda navegação e carrega o GTM (Stape) quando configurado. */
export function TrackingBootstrap() {
  const gtmEnabled = GTM_ID_PATTERN.test(GTM_ID);
  return (
    <>
      <Suspense fallback={null}>
        <CaptureOnNavigation />
      </Suspense>
      {gtmEnabled ? (
        <Script id="gtm-loader" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='${GTM_LOADER_ORIGIN}/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
        </Script>
      ) : null}
    </>
  );
}
