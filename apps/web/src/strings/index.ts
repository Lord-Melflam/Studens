/**
 * The shell's own strings, in three languages.
 *
 * OWNED HERE, not in a shared locales directory. A module's strings belong to
 * the module, for the same reason its routes and its storage do: a central
 * translation file is a file every module has to edit, which is the coupling
 * FR-B4 exists to prevent. `mergeBundles` puts them together at the top.
 *
 * KEYS ARE FLAT AND GREPPABLE. `public.hero.title`, never a nested object, so
 * that finding where a sentence comes from is one search.
 *
 * ON THE TRANSLATIONS THEMSELVES. French is the source: it is what the first
 * institution teaches in and what the copy was thought in. The Dutch and
 * English were written by the same hand and have NOT been checked by a native
 * speaker. For English that is a small risk. For Dutch it is not: this product
 * asks Flemish students to trust it with something they are nervous about
 * saying, and clumsy Dutch reads as "not for you". docs/design has this as an
 * open item to close before any Flemish institution is launched into.
 */
import type { Bundle } from "@studens/i18n";

export const shellStrings: Bundle = {
  fr: {
    "nav.home": "Accueil",
    "nav.modules": "Ce que ça fait",
    "nav.privacy": "Vie privée",
    "nav.about": "À propos",
    "nav.signin": "Se connecter",
    "nav.register": "Créer un compte",
    "nav.source": "Code source",
    "nav.language": "Langue",

    "foot.tagline":
      "Un projet indépendant, sans but lucratif, affilié à aucune université ni haute école.",
    "foot.fine":
      "Le code est ouvert, sous licence MIT. Ce qui est publié ici vient des étudiants, pas des institutions.",

    "hero.kicker": "Pour les étudiants de l'enseignement supérieur",
    "hero.title.1": "Ce que les étudiants savent,",
    "hero.title.2": "gardé quelque part.",
    "hero.lede":
      "Chaque année, les mêmes questions sont posées aux mêmes personnes, et les réponses disparaissent en trois semaines. Studens est l'endroit où elles s'accumulent au lieu de se perdre.",
    "hero.secondary": "Voir ce qu'il y a dedans",
    "hero.fine":
      "Gratuit, sans publicité. Connexion avec votre compte Microsoft ou Google, aucun mot de passe à retenir, rien à installer.",

    "why.eyebrow": "Pourquoi",
    "why.title": "Le savoir pratique des étudiants n'est écrit nulle part",
    "why.p1":
      "Comment s'organiser, à quoi s'attendre, ce qui vaut le coup et ce qui n'en vaut pas la peine : tout ça existe déjà, chez celles et ceux qui sont passés par là avant vous.",
    "why.p2":
      "Mais ça vit dans des conversations, des serveurs Discord et des groupes qui changent chaque année. Personne ne l'écrit, parce qu'il n'y a pas d'endroit où l'écrire, et donc chaque promotion recommence de zéro.",
    "why.p3":
      "Studens est fait pour que ça s'accumule : daté, consultable, et toujours là l'année suivante. Un outil à la fois, ajouté quand le besoin est constaté et pas avant.",

    "inside.eyebrow": "Ce qu'il y a dedans",
    "inside.title": "Des modules, pas une application fourre-tout",
    "inside.lede":
      "Chaque module règle un problème précis et s'utilise seul. Rien n'est annoncé comme prêt tant que ça ne l'est pas : ce qui manque est écrit ici plutôt que promis.",
    "inside.fine":
      "D'autres suivront, en fonction de ce dont les étudiants ont réellement besoin, pas d'une feuille de route décidée à l'avance.",
    "inside.available": "disponible",
    "inside.planned": "à venir",
    "inside.more": "En savoir plus",

    "first.eyebrow": "Le premier module · {name}",
    "first.cta": "Voir {name} en détail",

    "promises.eyebrow": "Ce qui vaut pour tout Studens",
    "promises.title": "Quatre choses qui ne changeront pas d'un module à l'autre",
    "promises.sign.title": "Vous choisissez ce que vous signez",
    "promises.sign.body":
      "À chaque publication, votre nom ou l'anonymat. Ce qui est publié anonymement n'est relié à votre compte nulle part : la table n'a pas de champ pour ça. C'est une garantie de structure, pas une promesse.",
    "promises.independent.title": "Indépendant de toute institution",
    "promises.independent.body":
      "Studens n'est mandaté par aucune université ni haute école, ne parle au nom d'aucune, et n'a de comptes à rendre à aucune.",
    "promises.free.title": "Gratuit, et rien qui vous suive",
    "promises.free.body":
      "Pas de publicité, pas de revente de données, pas d'abonnement. Aucun cookie d'analyse non plus : il n'y a rien à accepter en arrivant ici, parce qu'il n'y a rien qui vous piste.",
    "promises.open.title": "Vérifiable",
    "promises.open.body":
      "Le code est public, et la spécification aussi, avec le raisonnement derrière chaque décision. Une promesse qu'on ne peut pas vérifier ne vaut que la confiance accordée à celui qui la fait.",
    "promises.limits": "Ce que l'anonymat ne protège pas",

    "start.eyebrow": "Commencer",
    "start.title": "Moins d'une minute",
    "start.1.title": "Vous vous connectez",
    "start.1.body":
      "Avec le compte Microsoft ou Google que vous avez déjà. Pas de mot de passe à créer, pas de carte bancaire, pas de vérification d'inscription.",
    "start.2.title": "Vous choisissez un pseudonyme",
    "start.2.body":
      "C'est lui qui apparaît quand vous publiez quelque chose sous votre nom. Nous ne gardons pas le nom que votre fournisseur nous envoie, et du reste de votre profil, rien n'est obligatoire.",

    "modules.title": "Ce que ça fait",
    "modules.lede":
      "Studens est fait de modules. Chacun résout un problème précis, et n'apparaît ici que lorsqu'il fonctionne.",

    "signin.title": "Entrer",
    "signin.lede":
      "Pas de mot de passe à créer ni à retenir. Vous utilisez un compte que vous avez déjà, et nous n'en voyons jamais le mot de passe.",
    "signin.with": "Continuer avec {provider}",
    "signin.dev": "Continuer en mode développement",
    "signin.none": "La connexion n'est pas encore ouverte sur cette installation.",
    "signin.fine":
      "En continuant, vous créez un compte si vous n'en avez pas encore. Nous conservons le domaine de votre adresse, jamais l'adresse elle-même, et pas votre nom.",
    "signin.fine.link": "Ce que ça implique",

    "lang.note":
      "L'interface existe en trois langues. Les informations reprises des institutions restent dans la langue où elles sont publiées.",
  },

  nl: {
    "nav.home": "Home",
    "nav.modules": "Wat het doet",
    "nav.privacy": "Privacy",
    "nav.about": "Over",
    "nav.signin": "Aanmelden",
    "nav.register": "Account aanmaken",
    "nav.source": "Broncode",
    "nav.language": "Taal",

    "foot.tagline":
      "Een onafhankelijk project zonder winstoogmerk, niet verbonden aan enige universiteit of hogeschool.",
    "foot.fine":
      "De code is open, onder MIT-licentie. Wat hier verschijnt komt van studenten, niet van instellingen.",

    "hero.kicker": "Voor studenten in het hoger onderwijs",
    "hero.title.1": "Wat studenten weten,",
    "hero.title.2": "ergens bewaard.",
    "hero.lede":
      "Elk jaar worden dezelfde vragen aan dezelfde mensen gesteld, en na drie weken zijn de antwoorden weg. Studens is de plek waar ze zich opstapelen in plaats van te verdwijnen.",
    "hero.secondary": "Bekijk wat erin zit",
    "hero.fine":
      "Gratis, zonder reclame. Aanmelden met je bestaande Microsoft- of Google-account: geen wachtwoord te onthouden, niets te installeren.",

    "why.eyebrow": "Waarom",
    "why.title": "De praktische kennis van studenten staat nergens opgeschreven",
    "why.p1":
      "Hoe je je organiseert, wat je kunt verwachten, wat de moeite waard is en wat niet: dat bestaat al, bij wie er vóór jou doorheen is gegaan.",
    "why.p2":
      "Maar het leeft in gesprekken, in Discord-servers en in groepen die elk jaar veranderen. Niemand schrijft het op, omdat er geen plek is om het op te schrijven, en dus begint elke lichting opnieuw.",
    "why.p3":
      "Studens bestaat zodat het zich opstapelt: gedateerd, doorzoekbaar, en het jaar daarna nog steeds er. Eén hulpmiddel per keer, toegevoegd wanneer de nood blijkt en niet eerder.",

    "inside.eyebrow": "Wat erin zit",
    "inside.title": "Modules, geen allesomvattende app",
    "inside.lede":
      "Elke module lost één duidelijk probleem op en werkt op zichzelf. Niets wordt als klaar aangekondigd zolang het dat niet is: wat ontbreekt staat hier, in plaats van beloofd te worden.",
    "inside.fine":
      "Er volgen er meer, op basis van wat studenten echt nodig hebben, niet van een vooraf vastgelegde routekaart.",
    "inside.available": "beschikbaar",
    "inside.planned": "op komst",
    "inside.more": "Meer weten",

    "first.eyebrow": "De eerste module · {name}",
    "first.cta": "{name} in detail bekijken",

    "promises.eyebrow": "Wat voor heel Studens geldt",
    "promises.title": "Vier dingen die van module tot module niet veranderen",
    "promises.sign.title": "Jij kiest wat je ondertekent",
    "promises.sign.body":
      "Bij elke publicatie: je naam of anoniem. Wat anoniem verschijnt is nergens aan je account gekoppeld: de tabel heeft er geen veld voor. Dat is een garantie in de structuur, geen belofte.",
    "promises.independent.title": "Onafhankelijk van elke instelling",
    "promises.independent.body":
      "Studens heeft van geen enkele universiteit of hogeschool een mandaat, spreekt namens geen enkele, en legt aan geen enkele verantwoording af.",
    "promises.free.title": "Gratis, en niets dat je volgt",
    "promises.free.body":
      "Geen reclame, geen doorverkoop van gegevens, geen abonnement. Ook geen analysecookies: er valt hier bij aankomst niets te aanvaarden, omdat er niets is dat je volgt.",
    "promises.open.title": "Controleerbaar",
    "promises.open.body":
      "De code is openbaar, en de specificatie ook, met de redenering achter elke beslissing. Een belofte die je niet kunt nagaan is niet meer waard dan het vertrouwen in wie ze doet.",
    "promises.limits": "Wat anonimiteit niet beschermt",

    "start.eyebrow": "Beginnen",
    "start.title": "Minder dan een minuut",
    "start.1.title": "Je meldt je aan",
    "start.1.body":
      "Met het Microsoft- of Google-account dat je al hebt. Geen wachtwoord aan te maken, geen bankkaart, geen controle van je inschrijving.",
    "start.2.title": "Je kiest een schuilnaam",
    "start.2.body":
      "Die verschijnt wanneer je iets onder je eigen naam publiceert. We bewaren de naam die je provider ons doorgeeft niet, en van de rest van je profiel is niets verplicht.",

    "modules.title": "Wat het doet",
    "modules.lede":
      "Studens bestaat uit modules. Elke module lost één duidelijk probleem op, en verschijnt hier pas wanneer ze werkt.",

    "signin.title": "Binnenkomen",
    "signin.lede":
      "Geen wachtwoord aan te maken of te onthouden. Je gebruikt een account dat je al hebt, en wij zien het wachtwoord ervan nooit.",
    "signin.with": "Doorgaan met {provider}",
    "signin.dev": "Doorgaan in ontwikkelmodus",
    "signin.none": "Aanmelden is op deze installatie nog niet opengesteld.",
    "signin.fine":
      "Door door te gaan maak je een account aan als je er nog geen hebt. We bewaren het domein van je adres, nooit het adres zelf, en je naam niet.",
    "signin.fine.link": "Wat dat betekent",

    "lang.note":
      "De interface bestaat in drie talen. Informatie die van de instellingen komt blijft in de taal waarin ze gepubliceerd is.",
  },

  en: {
    "nav.home": "Home",
    "nav.modules": "What it does",
    "nav.privacy": "Privacy",
    "nav.about": "About",
    "nav.signin": "Sign in",
    "nav.register": "Create an account",
    "nav.source": "Source code",
    "nav.language": "Language",

    "foot.tagline":
      "An independent, not-for-profit project, affiliated with no university or university college.",
    "foot.fine":
      "The code is open, under the MIT licence. What is published here comes from students, not from institutions.",

    "hero.kicker": "For students in higher education",
    "hero.title.1": "What students know,",
    "hero.title.2": "kept somewhere.",
    "hero.lede":
      "Every year the same questions are asked of the same people, and the answers are gone in three weeks. Studens is where they accumulate instead of disappearing.",
    "hero.secondary": "See what is inside",
    "hero.fine":
      "Free, no advertising. Sign in with the Microsoft or Google account you already have: no password to remember, nothing to install.",

    "why.eyebrow": "Why",
    "why.title": "Students' practical knowledge is written down nowhere",
    "why.p1":
      "How to organise yourself, what to expect, what is worth it and what is not: all of it already exists, with the people who went through it before you.",
    "why.p2":
      "But it lives in conversations, in Discord servers and in groups that change every year. Nobody writes it down, because there is nowhere to write it down, and so each cohort starts again from nothing.",
    "why.p3":
      "Studens exists so that it accumulates: dated, searchable, and still there the following year. One tool at a time, added when the need is observed and not before.",

    "inside.eyebrow": "What is inside",
    "inside.title": "Modules, not a catch-all application",
    "inside.lede":
      "Each module solves one precise problem and stands on its own. Nothing is announced as ready while it is not: what is missing is written here rather than promised.",
    "inside.fine":
      "More will follow, based on what students actually need, not on a roadmap decided in advance.",
    "inside.available": "available",
    "inside.planned": "coming",
    "inside.more": "Find out more",

    "first.eyebrow": "The first module · {name}",
    "first.cta": "See {name} in detail",

    "promises.eyebrow": "What holds across all of Studens",
    "promises.title": "Four things that will not change from one module to the next",
    "promises.sign.title": "You choose what you sign",
    "promises.sign.body":
      "With every contribution: your name, or anonymity. What you publish anonymously is linked to your account nowhere: the table has no column for it. That is a guarantee of structure, not a promise.",
    "promises.independent.title": "Independent of every institution",
    "promises.independent.body":
      "Studens is mandated by no university or university college, speaks for none, and answers to none.",
    "promises.free.title": "Free, and nothing following you",
    "promises.free.body":
      "No advertising, no selling of data, no subscription. No analytics cookies either: there is nothing to accept when you arrive, because there is nothing tracking you.",
    "promises.open.title": "Verifiable",
    "promises.open.body":
      "The code is public, and so is the specification, with the reasoning behind every decision. A promise you cannot check is worth only the trust you place in whoever made it.",
    "promises.limits": "What anonymity does not protect",

    "start.eyebrow": "Getting started",
    "start.title": "Under a minute",
    "start.1.title": "You sign in",
    "start.1.body":
      "With the Microsoft or Google account you already have. No password to create, no card, no proof of enrolment.",
    "start.2.title": "You choose a pseudonym",
    "start.2.body":
      "It is what appears when you publish something under your own name. We do not keep the name your provider sends us, and nothing else in your profile is required.",

    "modules.title": "What it does",
    "modules.lede":
      "Studens is made of modules. Each one solves a precise problem, and appears here only once it works.",

    "signin.title": "Come in",
    "signin.lede":
      "No password to create or remember. You use an account you already have, and we never see its password.",
    "signin.with": "Continue with {provider}",
    "signin.dev": "Continue in development mode",
    "signin.none": "Signing in is not open yet on this installation.",
    "signin.fine":
      "By continuing you create an account if you do not have one. We keep the domain of your address, never the address itself, and not your name.",
    "signin.fine.link": "What that means",

    "lang.note":
      "The interface exists in three languages. Information taken from the institutions stays in the language it is published in.",
  },
};
