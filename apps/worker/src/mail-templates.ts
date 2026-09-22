/**
 * What each message says, in three languages.
 *
 * RENDERED AT SEND TIME, NOT AT QUEUE TIME. The outbox row holds the kind, the
 * language and the variables, never the body. So a queued message is not frozen
 * in whatever the copy said the day it was queued, and fixing a sentence fixes
 * every message still waiting.
 *
 * WRITTEN AS PLAIN TEXT, SENT AS BOTH. These templates produce text and only
 * text, which is the source of every word; `mime.ts` renders that same text
 * into the HTML part beside it. One set of words, so the two parts cannot
 * disagree about why somebody was suspended.
 *
 * It was plain text alone until 2026-09-19, on the reasoning that styling is
 * stripped by half the clients that matter and that a text-only message has
 * nowhere to put a tracking pixel. What changed first was the styling: a bare
 * wall of text from an address nobody recognises is itself the shape of a
 * phishing mail, and for somebody whose account was suspended that message may
 * be the only notice they get.
 *
 * SINCE 2026-09-22 THERE IS ONE IMAGE, the mark, at the end. The rule it has
 * to respect was sharpened rather than dropped, because "no image" was never
 * the property anybody wanted: the property is that opening a message asks
 * nobody for anything. A REMOTE image is a read receipt whether or not it was
 * meant as one, reporting the time, the address and roughly the place. This
 * one is attached to the message and referenced by `cid:`, so it is already in
 * the client before the message is opened. The tests enforce "nothing remote",
 * which is stronger than the old rule and is the one that was meant. No
 * stylesheet, no `@import`, no `url()`, and every `src` must be a `cid:`.
 *
 * THE LIFETIME IS STATED IN THREE PLACES AND MUST AGREE. These three templates
 * say how long the confirmation link lasts, and `CONFIRM_MAX_AGE_SECONDS`
 * decides it. A test pins them together, because a message promising 24 hours
 * for a link that dies in one is worse than a message that says nothing.
 *
 * FR-H3 CONSTRAINS WHAT MAY BE WRITTEN HERE. No message may reveal the author
 * of an anonymous contribution, to anybody, including its author. There is
 * deliberately no template that names a contribution, and adding one would need
 * the same review any other guarantee gets.
 *
 * These live in the worker rather than in the shared string catalogues because
 * the catalogues are the interface's, loaded by the browser. Mail is a
 * different surface with a different register: no buttons, no links to relative
 * paths, and a subject line.
 */

import { contactAddress } from "@studens/platform";

type Vars = Record<string, unknown>;

interface Template {
  subject: string;
  /** A function, because every one of these interpolates something. */
  body: (v: Vars) => string;
}

/**
 * "Until <date>", or that there is no date.
 *
 * The date arrives as an ISO instant and is formatted HERE, in the reader's
 * language, because a date formatted where it was decided would be formatted
 * in the server's language: 09/07 means two different days either side of the
 * Channel, and a suspension is exactly the wrong thing to be vague about.
 *
 * Null is permanent, and permanent is stated as having no end rather than as a
 * date far away. Same rule as the column it comes from.
 */
function until(v: Vars, locale: string): string {
  const iso = v["until"];
  const lines: Record<string, [string, (d: string) => string]> = {
    fr: ["Cette décision n'a pas de date de fin.", (d) => `Elle prend fin le ${d}.`],
    nl: ["Deze beslissing heeft geen einddatum.", (d) => `Ze loopt af op ${d}.`],
    en: ["This decision has no end date.", (d) => `It ends on ${d}.`],
  };
  const [none, dated] = lines[locale] ?? lines["fr"]!;
  if (typeof iso !== "string" || iso === "") return none;
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return none;
  return dated(new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(when));
}

/**
 * Where to write about the decision, when there is anywhere.
 *
 * Empty when no address is configured, rather than a placeholder: an address
 * that does not exist turns a person trying to appeal into a bounce message,
 * which is worse than the screen and the mail both simply stating the reason.
 */
function contact(locale: string): string {
  const to = contactAddress();
  if (!to) return "";
  const lead: Record<string, string> = {
    fr: "\nPour en discuter, écrivez à ",
    nl: "\nOm erover te praten, schrijf naar ",
    en: "\nTo discuss it, write to ",
  };
  return `${lead[locale] ?? lead["fr"]!}${to}.`;
}

const SIGNATURE: Record<string, string> = {
  fr: "\n\nStudens\nUn projet indépendant, affilié à aucune université ni haute école.",
  nl: "\n\nStudens\nEen onafhankelijk project, aan geen enkele universiteit of hogeschool verbonden.",
  en: "\n\nStudens\nAn independent project, affiliated with no university or haute école.",
};

const TEMPLATES: Record<string, Record<string, Template>> = {
  "email.confirm": {
    fr: {
      subject: "Confirmez votre adresse",
      body: (v) =>
        "Vous avez demandé à être contacté à cette adresse.\n\n" +
        "Confirmez-la en ouvrant ce lien, valable 24 heures :\n" +
        `${String(v["url"])}\n\n` +
        "Si vous n'avez rien demandé, ignorez ce message : rien ne change tant " +
        "que le lien n'est pas ouvert.",
    },
    nl: {
      subject: "Bevestig uw adres",
      body: (v) =>
        "U hebt gevraagd om op dit adres gecontacteerd te worden.\n\n" +
        "Bevestig het via deze link, 24 uur geldig:\n" +
        `${String(v["url"])}\n\n` +
        "Hebt u niets gevraagd, negeer dit bericht: er verandert niets zolang " +
        "de link niet geopend is.",
    },
    en: {
      subject: "Confirm your address",
      body: (v) =>
        "You asked to be contacted at this address.\n\n" +
        "Confirm it by opening this link, valid for 24 hours:\n" +
        `${String(v["url"])}\n\n` +
        "If you asked for nothing, ignore this message: nothing changes until " +
        "the link is opened.",
    },
  },

  /**
   * Sent to the OLD address, before the change takes effect.
   *
   * This is the control that makes a session takeover visible to the person
   * losing it, so it carries no link and asks for no action: a message that
   * says "click here if this was not you" is the shape every phishing mail
   * takes. It tells them where to look instead.
   */
  "email.changed": {
    fr: {
      subject: "Changement d'adresse demandé",
      body: (v) =>
        `Une demande a été faite pour vous contacter à ${String(v["to"])} à la place.\n\n` +
        "Si c'est vous, il n'y a rien à faire : la nouvelle adresse doit encore " +
        "être confirmée.\n\n" +
        "Si ce n'est pas vous, connectez-vous et vérifiez vos connexions actives " +
        "dans « Mon compte ». Ce message ne contient aucun lien, volontairement.",
    },
    nl: {
      subject: "Adreswijziging aangevraagd",
      body: (v) =>
        `Er is gevraagd om u voortaan op ${String(v["to"])} te contacteren.\n\n` +
        "Bent u dat zelf, dan hoeft u niets te doen: het nieuwe adres moet nog " +
        "bevestigd worden.\n\n" +
        "Bent u dat niet, meld u dan aan en controleer uw actieve sessies bij " +
        "\"Mijn account\". Dit bericht bevat bewust geen enkele link.",
    },
    en: {
      subject: "Address change requested",
      body: (v) =>
        `Somebody asked to contact you at ${String(v["to"])} instead.\n\n` +
        "If that was you, there is nothing to do: the new address still has to " +
        "be confirmed.\n\n" +
        "If it was not, sign in and check your active sessions under \"My " +
        "account\". This message deliberately contains no link.",
    },
  },

  "account.deleted": {
    fr: {
      subject: "Votre compte a été supprimé",
      body: () =>
        "Votre compte Studens a été supprimé, ainsi que vos préférences et vos " +
        "connexions.\n\n" +
        "Ce que vous aviez publié sous votre nom reste en ligne, sans votre nom : " +
        "le texte est utile à d'autres étudiants, et il n'est plus rattaché à vous.\n\n" +
        "Ce que vous aviez publié anonymement était déjà sans lien avec votre " +
        "compte, et l'est toujours.",
    },
    nl: {
      subject: "Uw account is verwijderd",
      body: () =>
        "Uw Studens-account is verwijderd, samen met uw voorkeuren en uw " +
        "sessies.\n\n" +
        "Wat u onder uw naam publiceerde blijft online, zonder uw naam: de tekst " +
        "is nuttig voor andere studenten, en is niet langer aan u gekoppeld.\n\n" +
        "Wat u anoniem publiceerde stond al los van uw account, en staat dat nog " +
        "steeds.",
    },
    en: {
      subject: "Your account has been deleted",
      body: () =>
        "Your Studens account has been deleted, along with your preferences and " +
        "your sessions.\n\n" +
        "What you published under your name stays online, without your name: the " +
        "text is useful to other students, and it is no longer attached to you.\n\n" +
        "What you published anonymously was already unlinked from your account, " +
        "and still is.",
    },
  },

  /**
   * SENT THE MOMENT THE DECISION IS TAKEN, not at the next sign-in.
   *
   * The screen at sign-in is the other half of this and neither replaces the
   * other: somebody who gives up after one refused attempt never reaches the
   * screen, and somebody who never confirmed a contact address never gets this
   * message. Two ways in, both saying the same thing.
   *
   * IT CARRIES THE REASON IN FULL. A message saying "your account has been
   * suspended, sign in to find out why" asks somebody to go to the one place
   * they have just been shut out of, and reads like the phishing it resembles.
   *
   * IT CONTAINS NO LINK AND ASKS FOR NO ACTION, for the same reason
   * email.changed does not: this is the shape a message about losing access
   * takes, and every phishing mail in the world takes it too.
   */
  "account.suspended": {
    fr: {
      subject: "Votre compte Studens est suspendu",
      body: (v) =>
        "L'accès à votre compte a été retiré par une décision de modération.\n\n" +
        `Motif : ${String(v["reason"])}\n\n` +
        until(v, "fr") +
        "\n\nCe que vous avez publié anonymement n'est pas concerné : rien ne " +
        "relie ces publications à un compte, dans un sens comme dans l'autre.\n" +
        contact("fr"),
    },
    nl: {
      subject: "Uw Studens-account is geschorst",
      body: (v) =>
        "De toegang tot uw account is ingetrokken door een moderatiebeslissing.\n\n" +
        `Reden: ${String(v["reason"])}\n\n` +
        until(v, "nl") +
        "\n\nWat u anoniem publiceerde valt hier niet onder: niets verbindt zulke " +
        "publicaties met een account, in geen van beide richtingen.\n" +
        contact("nl"),
    },
    en: {
      subject: "Your Studens account is suspended",
      body: (v) =>
        "Access to your account was withdrawn by a moderation decision.\n\n" +
        `Reason: ${String(v["reason"])}\n\n` +
        until(v, "en") +
        "\n\nWhat you published anonymously is not affected: nothing ties it to an " +
        "account, in either direction.\n" +
        contact("en"),
    },
  },

  "account.reinstated": {
    fr: {
      subject: "Votre compte Studens est de nouveau accessible",
      body: () =>
        "La suspension de votre compte a été levée. Vous pouvez vous reconnecter.\n\n" +
        "Vos sessions ont été fermées au moment de la suspension, il faut donc " +
        "vous authentifier à nouveau.",
    },
    nl: {
      subject: "Uw Studens-account is weer toegankelijk",
      body: () =>
        "De schorsing van uw account is opgeheven. U kunt zich opnieuw aanmelden.\n\n" +
        "Uw sessies werden bij de schorsing afgesloten, u moet zich dus opnieuw " +
        "authenticeren.",
    },
    en: {
      subject: "Your Studens account is reachable again",
      body: () =>
        "The suspension on your account has been lifted. You can sign in again.\n\n" +
        "Your sessions were closed when it began, so you will have to " +
        "authenticate once more.",
    },
  },
};

export function renderMail(
  kind: string,
  locale: string,
  payload: object,
): { subject: string; body: string } {
  const byLocale = TEMPLATES[kind];
  if (!byLocale) {
    // A kind with no template is a bug, and it must be loud rather than a blank
    // message arriving in somebody's inbox.
    throw new Error(`no template for mail kind: ${kind}`);
  }
  // French is the source language, so it is the fallback (FR-G4).
  const template = byLocale[locale] ?? byLocale["fr"]!;
  const vars = payload as Vars;
  return {
    subject: template.subject,
    body: template.body(vars) + (SIGNATURE[locale] ?? SIGNATURE["fr"]!),
  };
}

/** The kinds that have a template. Every one is rendered by a test, in each
 *  of the three languages, because a kind whose body throws does it in the
 *  worker at send time with nobody watching. */
export const TEMPLATED_KINDS = Object.keys(TEMPLATES);
