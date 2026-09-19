/**
 * The first run: five screens, once, after a member first signs in.
 *
 * FR-F4 to FR-F14.
 *
 * WHY IT IS A SEQUENCE AND NOT A FORM. Only one answer is required (FR-F6). A
 * single form with one required field and six optional ones teaches people that
 * the optional ones are also expected, and they answer them to be safe. One
 * question per screen lets each screen say what the answer is for and what
 * happens if it is skipped, and "Passer" is a real button rather than fine
 * print.
 *
 * WHY THE STEP IS IN THE URL. Refreshing is the commonest thing anyone does
 * when a form looks stuck, and losing three screens of work to it is the
 * cheapest possible way to lose somebody. The step is also saved server side
 * (FR-F5), so coming back tomorrow on another device resumes in the same place.
 *
 * THIS IS NOT THE APP AND NOT THE PUBLIC SITE. No module navigation, no
 * crumbs, no account menu: the only ways out are forward, back one screen, and
 * signing out. A wizard you can wander out of halfway is a wizard people leave
 * halfway. It mentions no module's domain either (FR-B16).
 */
import { useCallback, useEffect, useState } from "react";
import { LOCALES, LOCALE_NAMES, localePath, useLocale, useT, type Locale } from "@studens/i18n";
import { currentRoute, navigate } from "../router.js";
import { TEXT_LIMITS, countGraphemes, textProblem, type TextProblem } from "./text.js";
import {
  PatchFailed,
  fetchInstitutions,
  fetchProfile,
  patchProfile,
  addMyInstitution,
  type Institution,
  type Profile,
  type UsernameProblem,
} from "./profile.js";

/** The zone's own prefix, the way `/app` is the shell's. */
export const FIRST_RUN = "/bienvenue";
export const STEPS = 5;

export function isFirstRunPath(route: string): boolean {
  return route === FIRST_RUN || route.startsWith(`${FIRST_RUN}/`);
}

/** The step in the path, clamped. `/bienvenue` alone means step one. */
export function stepFrom(route: string): number {
  const rest = route.slice(FIRST_RUN.length).replace(/^\//, "");
  const n = Number.parseInt(rest, 10);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(n, 1), STEPS);
}

/** True when the path names a step, rather than being the bare prefix. */
export function hasExplicitStep(route: string): boolean {
  const rest = route.slice(FIRST_RUN.length).replace(/^\//, "");
  return /^[0-9]+$/.test(rest);
}

export function firstRunPath(step: number): string {
  return `${FIRST_RUN}/${Math.min(Math.max(step, 1), STEPS)}`;
}

/**
 * One free text field, with its counter and its warning.
 *
 * THE WARNING APPEARS WHILE THE MISTAKE IS BEING MADE, not after the button is
 * pressed. Before this there was no limit on screen, no counter, and no message
 * for a refused value: François typed emoji, the save was refused for reasons
 * nobody could see, and the reasonable conclusion was that the emoji were to
 * blame. They were not. Nothing said what was.
 *
 * The rules come from `text.ts`, which mirrors the server, and a test fails if
 * the two ever disagree. A warning that is wrong is worse than none.
 */
function FreeTextField({
  id,
  label,
  placeholder,
  value,
  max,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  max: number;
  onChange: (v: string) => void;
}) {
  const t = useT();
  const problem: TextProblem | null = textProblem(value, max);
  const used = countGraphemes(value.replace(/\s+/gu, " ").trim());
  // Quiet until it is nearly full, then present. A counter that is always there
  // reads as a target to fill rather than a limit not to cross.
  const showCount = used > max - 20;

  return (
    <>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={problem ? "text-input bad" : "text-input"}
        value={value}
        // No maxLength: the browser would silently refuse the keystroke, and
        // somebody pasting a long line would watch it truncate with nothing
        // said. Being told why beats being stopped without a reason.
        aria-invalid={problem !== null}
        aria-describedby={`${id}-note`}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      <p id={`${id}-note`} className={problem ? "field-note bad" : "field-note"}>
        {problem === "long"
          ? t("text.err.long", { used, max })
          : problem
            ? t(`text.err.${problem}`)
            : showCount
              ? t("text.count", { used, max })
              : ""}
      </p>
    </>
  );
}

export function FirstRun({
  route,
  onDone,
}: {
  route: string;
  /**
   * Awaited. It reloads the session before it navigates, which is a round trip
   * of its own, and the button has to stay busy until it finishes or the
   * screen is asking to be pressed again while it works.
   */
  onDone: () => void | Promise<void>;
}) {
  const t = useT();
  const locale = useLocale();
  const step = stepFrom(route);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<UsernameProblem | "other" | null>(null);

  // Draft values. Held here rather than read straight off `profile` so a field
  // can be typed in without a request per keystroke.
  const [username, setUsername] = useState("");
  const [studies, setStudies] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [interests, setInterests] = useState("");
  /**
   * SEVERAL, NOT ONE. François: "I also see some people followig courses in 2
   * different universities, so it should be better if in /5 we make the choice
   * non exclusive."
   *
   * The storage has been a set since `MemberInstitution` existed; this screen
   * was the last thing still asking for one answer. `institutionCode` keeps the
   * first one picked, because other code wants a single answer to "where do you
   * study" and it is still a preference rather than a tenant (FR-F13).
   */
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const [p, list] = await Promise.all([fetchProfile(), fetchInstitutions()]);
      if (!p) return;
      setProfile(p);
      setUsername(p.username ?? "");
      setStudies(p.studies ?? "");
      setYear(p.yearOfStudy);
      setInterests(p.interests ?? "");
      setChosen(p.institutionCode ? [p.institutionCode] : []);
      setInstitutions(list);

      // FR-F5: `/bienvenue` with no number means "wherever I was". The saved
      // step is the server's, so this resumes on a different device too, which
      // a URL alone cannot do.
      if (!hasExplicitStep(route) && p.onboardingStep > 1) {
        navigate(firstRunPath(p.onboardingStep));
      }
    })();
    // Deliberately once, and `route` is deliberately not a dependency: this
    // reads the step to resume with, and re-running it on every navigation
    // would fight the person pressing Back.
  }, []);

  /** Save this screen's fields, then move. A failed save does not move. */
  const save = useCallback(
    async (patch: Record<string, unknown>, next: number) => {
      setSaving(true);
      setProblem(null);
      try {
        const saved = await patchProfile({ ...patch, onboardingStep: Math.min(next, STEPS) });
        setProfile(saved);
        if (next > STEPS) {
          // AWAITED, AND `saving` IS NOT CLEARED AFTERWARDS. Finishing is three
          // round trips, not one: the institutions, the profile, and then the
          // session reload inside `onDone` that stops the app bouncing us
          // straight back here. Clearing the flag before that last one made the
          // button live again while nothing visible was happening, so people
          // pressed it a second time. François, after the ULB session: "I click
          // on finish button twice each time."
          //
          // The screen is leaving, so there is nothing to re-enable. Leaving it
          // busy is what makes the wait legible instead of dead.
          await onDone();
          return;
        }
        navigate(firstRunPath(next));
      } catch (err) {
        if (err instanceof PatchFailed && err.field === "username") {
          setProblem(err.reason ?? "other");
        } else {
          setProblem("other");
        }
        setSaving(false);
      }
    },
    [onDone],
  );

  /**
   * Finish, writing every university picked.
   *
   * `institutionCode` takes the FIRST, because other code wants one answer to
   * "where do you study" and FR-F13 keeps it a preference rather than a tenant.
   * The rest go to the set, which is what RYC actually reads. Writing the first
   * one through the profile also adds it to the set, so it is not sent twice.
   *
   * The set is written before the profile, because the profile call is the one
   * that ends the first run: if the extra universities failed and the finish
   * succeeded, somebody would land in the app having answered a question whose
   * answer was thrown away.
   */
  const saveInstitutions = useCallback(
    async (codes: string[]) => {
      setSaving(true);
      setProblem(null);
      try {
        for (const code of codes.slice(1)) await addMyInstitution(code);
      } catch {
        setProblem("other");
        setSaving(false);
        return;
      }
      // Straight on, still busy. Clearing it here and letting `save` set it
      // again left one render where the button was enabled and the work was
      // not done.
      await save({ institutionCode: codes[0] ?? null, onboardedAt: true }, STEPS + 1);
    },
    [save],
  );

  const back = () => navigate(firstRunPath(step - 1));

  /**
   * Leave the setup and go into the app anyway.
   *
   * It records that the first run has been OPENED, which is what stops the app
   * sending them straight back here. Before this, "later" went to the public
   * home and the public home's way in bounced them to this screen again, so
   * there was no way into the product except by finishing. The progress is kept
   * either way, so coming back resumes where they stopped (FR-F5).
   */
  async function later() {
    setSaving(true);
    try {
      if (profile && profile.onboardingStep === 0) {
        await patchProfile({ onboardingStep: 1 });
      }
    } catch {
      // Going into the app matters more than recording the step. The worst
      // case is being offered the setup once more, not being stuck outside.
    } finally {
      setSaving(false);
      onDone();
    }
  }

  if (!profile) {
    return (
      <main className="firstrun">
        <p className="hint">…</p>
      </main>
    );
  }

  return (
    // The institution screen is a grid of every Belgian university, so it gets
    // more room than the screens that ask one question.
    <main className={step === 5 ? "firstrun wide" : "firstrun"}>
      <header className="firstrun-top">
        <span className="brand">Studens</span>
        {/*
          A real way out, into the app rather than out of the product. Someone
          who has just arrived and would rather look around first must be able
          to, and FR-F6's whole argument is that a setup you cannot escape is
          one people answer falsely to get past.
        */}
        <button type="button" className="quiet" disabled={saving} onClick={() => void later()}>
          {t("firstrun.later")}
        </button>
      </header>

      <div className="firstrun-progress" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span key={i} className={i < step ? "on" : ""} />
        ))}
      </div>
      <p className="firstrun-step">{t("firstrun.step", { n: step, total: STEPS })}</p>

      {/*
        A FAILURE ON ANY STEP IS VISIBLE. Until 2026-09-13 the error line lived
        inside step two only, so a refused save anywhere else did nothing at
        all: the button appeared dead and there was nothing on screen to read.
        The username problems keep their own precise wording on step two; this
        catches every other step and every other reason.
      */}
      {problem && step !== 2 && (
        <p className="error" role="alert">
          {problem === "other" ? t("firstrun.err.save") : t(`firstrun.2.err.${problem}`)}
        </p>
      )}

      {step === 1 && (
        <section className="firstrun-card">
          <h1>{t("firstrun.1.title")}</h1>
          <p className="lede">{t("firstrun.1.lede")}</p>
          <ul className="plain">
            <li>{t("firstrun.1.point.name")}</li>
            <li>{t("firstrun.1.point.rest")}</li>
            <li>{t("firstrun.1.point.later")}</li>
          </ul>
          {/* FR-A10. The one thing we already know, said plainly, so nobody
              wonders what was taken from the provider. */}
          <p className="hint">
            {t("firstrun.1.known", { domain: profile.emailDomain ?? "" })}
          </p>
          <div className="firstrun-actions">
            <button type="button" className="cta" onClick={() => void save({}, 2)} disabled={saving}>
              {t("firstrun.start")}
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="firstrun-card">
          <h1>{t("firstrun.2.title")}</h1>
          <p className="lede">{t("firstrun.2.lede")}</p>
          <label className="field-label" htmlFor="fr-username">
            {t("firstrun.2.label")}
          </label>
          <input
            id="fr-username"
            className="text-input"
            value={username}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={24}
            onChange={(e) => {
              // Lowercased as it is typed, because the rule is lowercase and
              // rejecting a capital afterwards is a worse way to teach that.
              setUsername(e.target.value.toLowerCase());
              setProblem(null);
            }}
            placeholder={t("firstrun.2.placeholder")}
          />
          <p className="hint">{t("firstrun.2.rule")}</p>
          {problem && <p className="error">{t(`firstrun.2.err.${problem}`)}</p>}
          {/* FR-F7 in the positive: every other profile field stays off every
              contribution, so this is the only one that is not private. Said
              here rather than in a policy page nobody opens. */}
          <p className="hint strong">{t("firstrun.2.public")}</p>
          <div className="firstrun-actions">
            <button type="button" className="ghost" onClick={back} disabled={saving}>
              {t("firstrun.back")}
            </button>
            <button
              type="button"
              className="cta"
              disabled={saving || username.trim().length < 3}
              onClick={() => void save({ username }, 3)}
            >
              {t("firstrun.next")}
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="firstrun-card">
          <h1>{t("firstrun.3.title")}</h1>
          <p className="lede">{t("firstrun.3.lede")}</p>
          <div className="choice-row">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                className={l === locale ? "choice here" : "choice"}
                aria-pressed={l === locale}
                onClick={() => {
                  // Two things at once, on purpose: the URL carries the language
                  // so the change is visible immediately, and the profile
                  // remembers it for the next sign-in on another device.
                  void patchProfile({ locale: l });
                  window.history.replaceState({}, "", localePath(currentRoute(), l as Locale));
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }}
              >
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
          <p className="hint">{t("firstrun.3.note")}</p>
          <div className="firstrun-actions">
            <button type="button" className="ghost" onClick={back} disabled={saving}>
              {t("firstrun.back")}
            </button>
            <button
              type="button"
              className="cta"
              disabled={saving}
              onClick={() => void save({ locale }, 4)}
            >
              {t("firstrun.next")}
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="firstrun-card">
          <h1>{t("firstrun.4.title")}</h1>
          <p className="lede">{t("firstrun.4.lede")}</p>

          <FreeTextField
            id="fr-studies"
            label={t("firstrun.4.studies")}
            placeholder={t("firstrun.4.studies.placeholder")}
            value={studies}
            max={TEXT_LIMITS.studies}
            onChange={setStudies}
          />

          <label className="field-label" htmlFor="fr-year">
            {t("firstrun.4.year")}
          </label>
          <select
            id="fr-year"
            className="text-input"
            value={year ?? ""}
            onChange={(e) => setYear(e.target.value === "" ? null : Number(e.target.value))}
          >
            <option value="">{t("firstrun.4.year.none")}</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {t("firstrun.4.year.n", { n })}
              </option>
            ))}
          </select>

          <FreeTextField
            id="fr-interests"
            label={t("firstrun.4.interests")}
            placeholder={t("firstrun.4.interests.placeholder")}
            value={interests}
            max={TEXT_LIMITS.interests}
            onChange={setInterests}
          />

          {/* FR-F7. The reason this screen can be answered truthfully is that
              none of it ever renders beside anything published, on either
              path. Said here, where the question is asked. */}
          <p className="hint strong">{t("firstrun.4.never")}</p>

          <div className="firstrun-actions">
            <button type="button" className="ghost" onClick={back} disabled={saving}>
              {t("firstrun.back")}
            </button>
            <button
              type="button"
              className="linkish"
              disabled={saving}
              onClick={() => void save({}, 5)}
            >
              {t("firstrun.skip")}
            </button>
            <button
              type="button"
              className="cta"
              // Blocked while a field is wrong, so the round trip that would
              // fail never happens and the warning is the only thing to read.
              disabled={
                saving ||
                textProblem(studies, TEXT_LIMITS.studies) !== null ||
                textProblem(interests, TEXT_LIMITS.interests) !== null
              }
              onClick={() =>
                void save(
                  {
                    studies: studies.trim() || null,
                    yearOfStudy: year,
                    interests: interests.trim() || null,
                  },
                  5,
                )
              }
            >
              {t("firstrun.next")}
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="firstrun-card">
          <h1>{t("firstrun.5.title")}</h1>
          <p className="lede">{t("firstrun.5.lede")}</p>

          {/*
            FR-F12: every institution is listed and only the ones whose
            catalogue is loaded can be chosen. Showing every institution says
            "this is coming"; showing UCLouvain alone would suggest Studens is a
            UCLouvain product, and it is not one.
          */}
          <ul className="institutions">
            {institutions.map((i) => (
              <li key={i.code}>
                <button
                  type="button"
                  disabled={!i.available || saving}
                  className={chosen.includes(i.code) ? "institution on" : "institution"}
                  style={i.colour ? { ["--mark" as string]: i.colour } : undefined}
                  aria-pressed={chosen.includes(i.code)}
                  onClick={() =>
                    setChosen((was) =>
                      was.includes(i.code) ? was.filter((c) => c !== i.code) : [...was, i.code],
                    )
                  }
                >
                  <span className="mark" aria-hidden="true">
                    {i.name.slice(0, 1)}
                  </span>
                  <span className="who">
                    <span className="name">{i.name}</span>
                  </span>
                  {!i.available && <span className="soon">{t("firstrun.5.soon")}</span>}
                </button>
              </li>
            ))}
          </ul>

          {/* FR-F13: self-declared. It opens nothing and proves nothing, and
              the tenant comes from the provider, not from this button. */}
          <p className="hint strong">{t("firstrun.5.declared")}</p>

          <div className="firstrun-actions">
            <button type="button" className="ghost" onClick={back} disabled={saving}>
              {t("firstrun.back")}
            </button>
            <button
              type="button"
              className="cta"
              disabled={saving}
              onClick={() => void saveInstitutions(chosen)}
            >
              {/* Says what it is doing. A button that only greys out reads as
                  broken when the wait is three round trips long. */}
              {saving ? t("firstrun.finishing") : t("firstrun.finish")}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
