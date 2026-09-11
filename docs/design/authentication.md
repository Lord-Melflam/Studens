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
