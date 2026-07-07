# Privacy Policy — PR Review Health Dashboard

_Last updated: 2026-07-07_

## What this extension collects

- **Your GitHub username and personal access token**, entered by you on the extension's Options page.
- **Pull request metadata** (lines changed, files changed, days open, whether test files were touched) for PRs you view on github.com while the extension is active.

## Where that data goes

- Your GitHub username and token are stored locally in Chrome's `chrome.storage.local` and sent only to the backend URL you configure (by default, a server you run yourself on `localhost`).
- Your GitHub token is encrypted at rest (Fernet symmetric encryption) before being stored in that backend's database. It is decrypted only in memory, only to make requests to GitHub's own API on your behalf.
- Pull request metadata is sent to GitHub's REST API (to fetch PR details) and to your configured backend (to compute and store a risk score). It is not sent to any other third party.

## What this extension does not do

- It does not sell, share, or transmit your data to any analytics, advertising, or third-party service.
- It does not collect data from any site other than `github.com` and `api.github.com`.
- It has no telemetry of its own.

## Your control over your data

- You can remove your stored token at any time via the Options page.
- Because the backend is self-hosted, you control the database it's stored in — you can delete it, back it up, or inspect it directly at any time.

## Contact

This is an open-source portfolio project. Source code, including this privacy policy, is available at the project's GitHub repository.
