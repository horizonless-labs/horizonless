# Security policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue.

We aim to acknowledge reports within 3 working days.

## Scope

horizonless is a data-conversion library. It never handles secret keys and its conversion functions make no network calls. The most relevant issues are:

- Output that misreports amounts, assets or parties for a real transaction in a way an application could act on (for example, crediting a deposit that did not happen).
- Crashes or excessive resource use on crafted RPC input.

## Supported versions

Only the latest minor release receives fixes before 1.0.
