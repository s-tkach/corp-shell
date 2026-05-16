"use client";

import Script from "next/script";

interface CloudWatchRumProps {
  appId: string;
  identityPoolId: string;
  region: string;
  endpoint: string;
}

export function CloudWatchRum({ appId, identityPoolId, region, endpoint }: CloudWatchRumProps) {
  const config = JSON.stringify({
    sessionSampleRate: 1,
    identityPoolId,
    endpoint,
    telemetries: ["performance", "errors", "http"],
    allowCookies: true,
    enableXRay: true,
  });

  return (
    <Script
      id="cw-rum-init"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
(function(n,i,v,r,s,c,x,z){x=window.AwsRumClient={q:[],n:n,i:i,v:v,r:r,c:c};window[n]=function(){x.q.push(arguments)};z=document.createElement('script');z.async=true;z.src=s;document.head.insertBefore(z,document.head.getElementsByTagName('script')[0]);})(
  'cwr', '${appId}', '1.0.0', '${region}', 'https://client.rum.us-east-1.amazonaws.com/1.0.2/cwr.js', ${config}
);`,
      }}
    />
  );
}
