/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "corp-shell",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: { region: "us-east-1" },
      },
    };
  },
  async run() {
    const vpc = new sst.aws.Vpc("ShellVpc", { nat: "managed" });

    const db = new sst.aws.Aurora("ShellDb", {
      engine: "postgres",
      scaling: $app.stage === "prod"
        ? { min: "0.5 ACU", max: "2 ACU" }
        : $app.stage === "staging"
        ? { min: "0.5 ACU", max: "1 ACU" }
        : { min: "0 ACU", max: "1 ACU" },
      vpc,
    });

    const oktaClientSecret = new sst.Secret("OktaClientSecret");
    const oktaClientId = new sst.Secret("OktaClientId");
    const nextAuthSecret = new sst.Secret("NextAuthSecret");
    const webhookSecret = new sst.Secret("WebhookSecret");

    const shell = new sst.aws.Nextjs("Shell", {
      path: "shell/",
      link: [db, oktaClientSecret, oktaClientId, nextAuthSecret, webhookSecret],
      environment: {
        DATABASE_URL: db.secretArn,
        OKTA_CLIENT_SECRET: oktaClientSecret.value,
        OKTA_CLIENT_ID: oktaClientId.value,
        NEXTAUTH_SECRET: nextAuthSecret.value,
        WEBHOOK_SECRET: webhookSecret.value,
      },
    });

    return {
      shellUrl: shell.url,
    };
  },
});
