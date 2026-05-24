# CloudFront Wildcard DNS Setup

This is a manual one-time configuration — it is not managed in the repository.

## Overview

All tenant subdomains (`acme.corp.example.com`, `globocorp.corp.example.com`) resolve to the
same CloudFront distribution, which forwards all traffic to the single AWS Amplify app.

## Steps

1. **Route 53 (or your DNS provider):** Add a wildcard A/CNAME record:
   - `*.corp.example.com` → CloudFront distribution domain (e.g., `d1234abcd.cloudfront.net`)
   - TTL: 300s

2. **CloudFront distribution:**
   - Add `*.corp.example.com` as an alternate domain name (CNAME)
   - Attach a wildcard SSL certificate from ACM: `*.corp.example.com` (must be in us-east-1)
   - Origin: the Amplify app's default domain

3. **ACM Certificate:**
   - Request a wildcard certificate for `*.corp.example.com` in us-east-1
   - DNS-validate it (add the CNAME records Route 53 prompts you for)

4. **Amplify:**
   - In the Amplify console, add `*.corp.example.com` as a custom domain
   - Amplify will prompt for DNS validation records — add them

## Local Development

Set `TENANT_SLUG=acme` in `.env.local` to simulate tenant `acme` without wildcard DNS.
The app will behave as if the host is `acme.localhost:3000`.

## Testing Cross-Tenant Isolation

To test that a token from one tenant is rejected on another:
1. Log in on `acme.localhost:3000` (with `TENANT_SLUG=acme`)
2. Copy the session cookie
3. Switch to `TENANT_SLUG=globocorp` and restart the dev server
4. Use the copied cookie — the middleware should return 401
