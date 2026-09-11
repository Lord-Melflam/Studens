# Design note: authentication and sessions

| | |
|---|---|
| Status | **Proposed** 2026-09-11, for review in the pull request that implements it |
| Decision | Server-side sessions in a cookie, OIDC authorization code with PKCE, providers as configuration |
| Resolves | `requirements.md` OPEN-36 (usernames) |
| Implements | FR-A1 to FR-A10, constrained by FR-C16, FR-C4, 1.5 item 2 |
| Still open | OPEN-35 (one person, many accounts), OPEN-8 (how Moderators are appointed) |

## 0. Decision

Six choices, each with what it costs.

### 1. Server-side sessions, not stateless tokens

**Serves** FR-A2 (end a session), FR-A5 (see and revoke sessions), FR-A3 (14 days
idle, 90 days absolute).

**Rejected: a signed stateless token (JWT).** Revocation needs a denylist, which
is the state a stateless token exists to avoid, and FR-A5 needs the list of live
sessions anyway. Having decided to keep that list, a token adds a second
mechanism with nothing left to do.

**Cost accepted.** One indexed database read per authenticated request, on the
connection pool the request already uses.

**What would change it.** Several independently deployed services needing to
verify identity without a shared database. The architecture decision
(`architecture-style.md`) rules that out for reasons that have nothing to do with
auth, so this would change only if that changed.

### 2. The cookie carries a random token; the database stores only its hash

The cookie holds 32 random bytes. `platform.Session` stores the SHA-256 of that
value and never the value itself.

**Serves** the threat model already written down for FR-C3, which assumes an
adversary may hold a stored snapshot of the database.

**Rejected: putting the session row's id in the cookie.** Simpler by one line,
and it makes any snapshot a set of working cookies. A backup would become a pile
of live accounts, which is a strictly worse property than the one FR-C3 already
worries about for anonymity.

**Cost accepted.** One hash per request.

**What would change it.** Nothing plausible. This is the cheap half of the
decision.

### 3. Cookie attributes: `HttpOnly`, `SameSite=Lax`, `Secure` outside development

`HttpOnly` so that script cannot read the session, which keeps an XSS from
becoming an account takeover. `Secure` and `__Host-` prefix whenever the
connection is HTTPS.

**`Lax` and deliberately not `Strict`.** The provider redirects the browser back
to our callback as a top-level cross-site GET. Under `Strict` the cookie is
withheld on exactly that request and sign-in cannot complete. `Lax` sends it for
top-level navigations and withholds it for cross-site subrequests, which is the
property wanted.

**Cost accepted.** `Lax` still sends the cookie on a cross-site top-level GET, so
any state-changing endpoint must not be a GET. Every write in this API is already
a POST, and that now has a reason attached rather than being a convention.

### 4. Providers are configuration, not code paths

One OIDC client. Microsoft and Google are two entries in a table of issuer,
client id, secret and scopes. Adding a Belgian institution's own identity
provider later is a config entry and a redirect URI.

**Serves** `requirements.md` 1.5 item 2, "not assuming one identity provider",
which is listed there as one of the few things cheap now and expensive later.

**Rejected: an SDK per provider.** Two dependencies and two code paths for one
protocol, and the second one is where the bug lives because it is exercised less.

**Cost accepted.** We implement the protocol details ourselves: PKCE, `state`,
`nonce`, id token signature and claim validation. That is code we own and must
test rather than code a vendor owns.

**What would change it.** A provider that is not OIDC compliant. Neither of ours
is.

### 5. PKCE, `state` and `nonce` live in a short-lived signed cookie

Not in a database table.

**Rejected: a `PendingAuthorization` table.** A row per sign-in attempt, with a
cleanup job, for data whose useful life is about sixty seconds.

**Cost accepted.** The cookie must be integrity protected, so the server needs a
secret (`STUDENS_SESSION_SECRET`). It is required outside development and the
process refuses to start in production without it, the same fence as the
development identity.

### 6. A username chosen at first sign-in, and the provider's real name is never stored

**Resolves OPEN-36.** François, 2026-09-11.

**Serves** FR-C15, and 3.3. A pseudonym narrows the candidate set for the
complement problem less than a real name does: every attributed reviewer is a
person excluded from the pool of possible anonymous authors, and a real name
makes that exclusion certain rather than probable.

**The stronger half of the decision is what is not stored.** The provider hands
us a display name in the token. We do not keep it. Nothing in the product needs
it, and data we never hold cannot leak, be requested, or be correlated. The
`Member` row keeps the provider subject, the email domain (FR-A9) and the chosen
username, and nothing else about the person.

**Cost accepted.** Weaker accountability than a real name, and two members can
choose confusable usernames. Uniqueness is enforced; visual confusability is not.

**What would change it.** Evidence that pseudonymous reviews are materially
worse in practice, which would be a validation finding rather than an argument.

### 7. Single use of the authorization code is the provider's guarantee

Not ours, and this is worth stating because the code reads as though it were.

The callback clears the sign-in state cookie as it reads it. That stops a
refresh or a back button from replaying a sign-in. It does not stop a
deliberate replay, because clearing a cookie is an instruction to the browser
and an attacker replaying a captured callback can simply send it again, at
which point our `state` check passes.

What actually fails is the second exchange of the same code. RFC 6749
section 4.1.2: *"If an authorization code is used more than once, the
authorization server MUST deny the request and SHOULD revoke (when possible)
all tokens previously issued based on that authorization code."* Both providers
are obliged to enforce it, and a code's recommended lifetime is ten minutes.

**Cost accepted.** One security property in this flow is discharged by the
provider rather than by us. A provider that ignored that MUST would leave a
replay window to anyone already holding both the callback URL and the sign-in
cookie.

**What would change it.** If that ever needed to be ours, it is a short-lived
table of spent codes, keyed by hash, with the same shape as the quota counter.
It was not built now because it is machinery for a guarantee the standard
already places on the other side, and untested machinery in an auth path is its
own risk.

**How it stays visible.** `test/auth/callback.db.test.ts` replays a callback and
asserts that it fails. The fake provider in that test enforces the MUST, which
it did not in the first draft: it exchanged the same code twice, which is laxer
than any real provider and hid this dependency completely. A fixture more
permissive than reality is the same failure as one tidier than it.

## 1. What is built in which order

Four pull requests, because one would not be reviewable, and review is the
security boundary here (FR-B14).

1. **The session layer and the identity seam.** Session creation, lookup, idle
   and absolute expiry, revocation, the cookie. The development identity becomes
   the first implementation behind the seam and issues a real session, so the
   whole layer is exercised before any provider exists.
2. **The OIDC flow against a fake provider.** Authorize, callback, PKCE, state,
   nonce, claim validation, sign out. Testable end to end with no credentials.
3. **Microsoft and Google as configuration.** Needs registered applications and
   their secrets, which only François can create.
4. **Usernames**, and rendering them where `read.ts` currently returns the
   placeholder `"membre"`.

## 2. What this does not do

No password storage, no reset flow, no email verification, because FR-A7 means
there is nothing to store or reset.

No account linking. If the same person signs in with Microsoft and with Google
they are two Members, because `(provider, providerSubject)` is the identity.
Linking them needs a verified email address as the join key, which is more
personal data than the design currently keeps. If it is ever wanted, it is a
separate decision with its own note.

No "sign in with an institutional account only" gate. FR-A6 settled that
registration is open, and FR-A10 requires the email domain to be described as
evidence of holding an address at a domain, never as proof of enrolment.

## Appendix A: registering the two applications

A one-time task for whoever owns the accounts. Verified against the vendor
documentation on 2026-09-12; both consoles move, so the shape matters more than
the exact label.

**Both are free.** No subscription, no card, no trial that lapses. Microsoft
Entra app registrations are included in the free tier, and Google OAuth clients
cost nothing. Nothing here touches CON-1.

### The redirect URIs, which must match exactly

A redirect URI is compared character for character. A trailing slash is a
different URI.

| Environment | Microsoft | Google |
|---|---|---|
| Local | `http://localhost:3001/api/auth/callback/microsoft` | `http://localhost:3001/api/auth/callback/google` |
| Later, deployed | `https://<host>/api/auth/callback/microsoft` | `https://<host>/api/auth/callback/google` |

Add the local one now. Add the deployed one when there is a host, on the same
registration: one application can hold several redirect URIs, so this does not
need registering twice.

### Microsoft

1. Go to <https://entra.microsoft.com> and sign in.
2. If the account has more than one tenant, use the **Settings** icon in the top
   bar to switch to the one you want the app registered in. **An app registration
   cannot be moved between tenants afterwards**, so pick deliberately.
3. **Entra ID** > **App registrations** > **New registration**.
4. **Name**: `Studens`. Users see this on the consent screen, and it can be
   changed later.
5. **Supported account types**: **Any Entra ID Tenant + Personal Microsoft
   accounts**.

   This is the one choice with a requirement behind it. FR-A6 makes registration
   open to the public: no institutional gating, no roster check. Picking
   *Single tenant* would restrict sign-in to one directory, which is precisely
   the gate FR-A6 rules out, and would also exclude alumni whose university
   account has been closed, who FR-D16 exists to serve.
6. **Redirect URI**: platform **Web**, then the Microsoft URI from the table.
7. **Register**.
8. On **Overview**, copy the **Application (client) ID**. This is not a secret.
9. **Manage** > **Certificates & secrets** > **Client secrets** > **New client
   secret**. Description `studens-local`, expiry **6 months** (Microsoft caps it
   at 24 and recommends under 12; short is fine, and a calendar entry to rotate
   it is part of the job).
10. Copy the secret **Value**, not the Secret ID. **It is never shown again after
    you leave the page.** If it is lost, delete it and make another.

### Google

Google's order is the reverse: the consent screen comes before the credential.

1. Go to <https://console.cloud.google.com> and create a project, `studens`.
2. **APIs & Services** > **OAuth consent screen** (recently branded *Google Auth
   Platform*). Fill in **Branding**: app name `Studens`, a support email, a
   developer contact email.
3. **Audience**: **External**. *Internal* only exists for a Google Workspace
   organisation and would limit sign-in to its members, which FR-A6 rules out.
4. **Scopes**: add only `openid`, `email`, `profile`.

   This is worth getting right, because it decides whether the app needs
   verification. Those three are non-sensitive, and Google's documentation is
   explicit: with only these, users see **no warning screen**, authorizations
   **do not expire after seven days**, and **no app verification is required**.
   Adding any sensitive scope changes all three. We need nothing beyond them:
   FR-A9 wants the email domain, and OPEN-36 decided the display name is
   discarded.
5. While the publishing status is **Testing** the app is limited to 100 named
   test users. Add your own address to get started, and press **Publish** before
   any real student uses it.
6. **Credentials** > **Create credentials** > **OAuth client ID** >
   **Web application**. Name `Studens web`.
7. **Authorized redirect URIs**: the Google URI from the table.
8. **Create**, then copy the **Client ID** and **Client secret**.

### Where the four values go

Into `.env`, which is gitignored, by the person who created them:

```
STUDENS_MS_CLIENT_ID=...
STUDENS_MS_CLIENT_SECRET=...
STUDENS_GOOGLE_CLIENT_ID=...
STUDENS_GOOGLE_CLIENT_SECRET=...
STUDENS_SESSION_SECRET=...        # openssl rand -base64 32
```

`.env.example` carries the names with empty values and is the only tracked copy.

**Never paste a client secret into a chat, an issue, a pull request or a commit
message.** The repository is public, so anything committed is permanently
cloneable, and a transcript is a file on disk. If one is exposed, delete it in
the console and create another: rotating takes a minute, and an exposed secret
lets anyone impersonate this application to the provider.

A client **ID** is not a secret and appears in the browser on every sign-in.
Only the **secret** matters.
