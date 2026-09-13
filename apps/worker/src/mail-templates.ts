/**
 * What each message says, in three languages.
 *
 * RENDERED AT SEND TIME, NOT AT QUEUE TIME. The outbox row holds the kind, the
 * language and the variables, never the body. So a queued message is not frozen
 * in whatever the copy said the day it was queued, and fixing a sentence fixes
 * every message still waiting.
 *
 * PLAIN TEXT ONLY. An HTML mail needs a plain-text alternative anyway, styling
 * is stripped by half the clients that matter, and the whole point of these
 * messages is that they are short and say one thing. It also means there is no
 * tracking pixel, because there is nowhere to put one.
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

type Vars = Record<string, unknown>;

interface Template {
  subject: string;
  /** A function, because every one of these interpolates something. */
  body: (v: Vars) => string;
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

/** The kinds that have a template, for the test that checks none is missing. */
export const TEMPLATED_KINDS = Object.keys(TEMPLATES);
