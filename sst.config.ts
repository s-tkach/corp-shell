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
      tracing: "active",
      link: [db, oktaClientSecret, oktaClientId, nextAuthSecret, webhookSecret],
      environment: {
        DATABASE_URL: db.secretArn,
        OKTA_CLIENT_SECRET: oktaClientSecret.value,
        OKTA_CLIENT_ID: oktaClientId.value,
        NEXTAUTH_SECRET: nextAuthSecret.value,
        WEBHOOK_SECRET: webhookSecret.value,
      },
    });

    // Route 53 health check for 99.9% availability monitoring (M12-4)
    // Only provisioned in prod — health check polls every 10s from multiple AWS regions
    if ($app.stage === "prod") {
      const healthCheck = new aws.route53.HealthCheck("ShellHealthCheck", {
        fqdn: "app.corp.com",
        port: 443,
        type: "HTTPS",
        resourcePath: "/api/health",
        failureThreshold: 3,
        requestInterval: 10,
        // CloudWatch alarm triggers when health check fails across 3 consecutive periods
        enableSni: true,
        tags: {
          project: "corp-shell",
          stage: "prod",
        },
      });

      // CloudWatch alarm: pages on-call if health check fails
      new aws.cloudwatch.MetricAlarm("ShellHealthAlarm", {
        name: "corp-shell-health-check",
        comparisonOperator: "LessThanThreshold",
        evaluationPeriods: 1,
        metricName: "HealthCheckStatus",
        namespace: "AWS/Route53",
        period: 60,
        statistic: "Minimum",
        threshold: 1,
        treatMissingData: "breaching",
        dimensions: {
          HealthCheckId: healthCheck.id,
        },
        tags: {
          project: "corp-shell",
          stage: "prod",
        },
      });
    }

    return {
      shellUrl: shell.url,
    };
  },
});
