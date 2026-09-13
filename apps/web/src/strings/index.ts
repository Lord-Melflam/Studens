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
    "nav.enter": "Ouvrir l'application",
    "nav.signout": "se déconnecter",
    "nav.domain.hint": "adresse vérifiée chez ce domaine",
    "app.home.lede": "Studens rassemble des outils pour les étudiants. Choisissez un module.",
    "app.modules": "modules",
    "app.home.more": "D'autres modules suivront. Rien n'est affiché ici tant qu'il n'existe pas.",
    "app.unknown": "Module inconnu : « {id} ».",
    "app.back": "retour aux modules",
    "app.home.title": "Vos outils",
    "app.open": "Ouvrir",
    "settings.title": "Mon compte",
    "settings.signedout": "Vous n'êtes pas connecté.",
    "settings.account": "Compte",
    "settings.domain": "Domaine de votre adresse",
    "settings.domain.hint": "Indication, pas une preuve d'inscription.",
    "settings.stored": "Ce que nous gardons",
    "settings.stored.value": "L'identifiant de votre fournisseur, le domaine de votre adresse, et vos préférences.",
    "settings.stored.hint": "Ni votre adresse complète, ni le nom que votre fournisseur nous envoie.",
    "settings.language": "Langue",
    "settings.language.hint": "Change l'interface. Les informations venant des institutions restent dans leur langue.",
    "settings.sessions": "Connexions actives",
    "settings.sessions.hint": "Chaque appareil où vous êtes connecté. Aucune adresse IP ni appareil n'est enregistré.",
    "settings.sessions.this": "Cet appareil",
    "settings.sessions.other": "Un autre appareil",
    "settings.sessions.since": "depuis le {when}",
    "settings.sessions.end": "Déconnecter",
    "settings.sessions.endthis": "Me déconnecter ici",
    "app.setup.prompt": "Votre configuration n'est pas terminée : vous n'avez pas encore de pseudonyme.",
    "app.setup.go": "Reprendre",
    "settings.profile": "Profil",
    "settings.username": "Pseudonyme",
    "settings.username.hint": "La seule information de votre profil que les autres voient.",
    "settings.save": "Enregistrer",
    "settings.saved": "Enregistré.",
    "settings.unset": "Non renseigné",
    "settings.institution": "Établissement",
    "settings.institution.hint": "Déclaré par vous. N'ouvre aucun accès et ne prouve rien.",
    "settings.studies": "Études",
    "settings.studies.hint": "N'apparaît jamais à côté de ce que vous publiez.",
    "settings.redo": "Refaire la configuration",
    "settings.soon": "Pas encore disponible",
    "settings.soon.contributions": "Retrouver et modifier vos contributions signées.",
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

    "firstrun.step": "Étape {n} sur {total}",
    "firstrun.later": "Plus tard",
    "firstrun.start": "Commencer",
    "firstrun.back": "Retour",
    "firstrun.next": "Suivant",
    "firstrun.skip": "Passer",
    "firstrun.finish": "Terminer",

    "firstrun.1.title": "Bienvenue sur Studens",
    "firstrun.1.lede":
      "Quatre écrans, une minute. Vous pouvez vous arrêter quand vous voulez et reprendre où vous en étiez.",
    "firstrun.1.point.name": "Un pseudonyme. C'est la seule chose demandée.",
    "firstrun.1.point.rest": "Le reste est facultatif et sert à vous proposer ce qui vous concerne.",
    "firstrun.1.point.later": "Tout est modifiable ensuite dans votre compte.",
    "firstrun.1.known": "Nous savons déjà que vous avez une adresse chez {domain}. Rien d'autre.",

    "firstrun.2.title": "Choisissez un pseudonyme",
    "firstrun.2.lede":
      "C'est le nom sous lequel vous apparaissez quand vous publiez quelque chose en votre nom.",
    "firstrun.2.label": "Pseudonyme",
    "firstrun.2.placeholder": "par exemple : lou.martin",
    "firstrun.2.rule":
      "De 3 à 24 caractères : lettres minuscules, chiffres, et point, tiret ou tiret bas entre deux.",
    "firstrun.2.public":
      "C'est la seule information de cette configuration qui soit visible par les autres.",
    "firstrun.2.err.short": "Trop court : 3 caractères au minimum.",
    "firstrun.2.err.long": "Trop long : 24 caractères au maximum.",
    "firstrun.2.err.shape": "Caractères non autorisés, ou un séparateur au début ou à la fin.",
    "firstrun.2.err.reserved": "Ce nom est réservé.",
    "firstrun.2.err.taken": "Ce pseudonyme est déjà pris.",
    "firstrun.2.err.other": "L'enregistrement a échoué. Réessayez.",

    "firstrun.3.title": "Dans quelle langue ?",
    "firstrun.3.lede": "Vous pouvez en changer à tout moment.",
    "firstrun.3.note":
      "Cela change l'interface. Les informations reprises des institutions restent dans la langue où elles sont publiées.",

    "firstrun.4.title": "Vos études",
    "firstrun.4.lede":
      "Facultatif, et utile seulement pour vous montrer ce qui vous concerne d'abord. Passez cet écran si vous préférez.",
    "firstrun.4.studies": "Ce que vous étudiez",
    "firstrun.4.studies.placeholder": "par exemple : bachelier ingénieur civil",
    "firstrun.4.year": "Année",
    "firstrun.4.year.none": "Je préfère ne pas le dire",
    "firstrun.4.year.n": "Année {n}",
    "firstrun.4.interests": "Centres d'intérêt",
    "firstrun.4.interests.placeholder": "par exemple : sécurité, données, langues",
    "firstrun.4.never":
      "Rien de cet écran n'apparaît à côté de ce que vous publiez, ni signé, ni anonyme.",

    "firstrun.5.title": "Votre établissement",
    "firstrun.5.lede":
      "Seule l'UCLouvain peut être choisie : Studens n'est pas encore ouvert ailleurs. Les autres sont listées parce qu'elles viendront.",
    "firstrun.5.soon": "pas encore ouvert",
    "firstrun.5.declared":
      "C'est une simple déclaration. Elle n'ouvre aucun accès et ne prouve rien.",
  },

  nl: {
    "nav.home": "Home",
    "nav.modules": "Wat het doet",
    "nav.privacy": "Privacy",
    "nav.about": "Over",
    "nav.signin": "Aanmelden",
    "nav.register": "Account aanmaken",
    "nav.source": "Broncode",
    "nav.enter": "Open de app",
    "nav.signout": "afmelden",
    "nav.domain.hint": "adres geverifieerd bij dit domein",
    "app.home.lede": "Studens bundelt hulpmiddelen voor studenten. Kies een module.",
    "app.modules": "modules",
    "app.home.more": "Er volgen er meer. Hier staat niets zolang het niet bestaat.",
    "app.unknown": "Onbekende module: \u00ab {id} \u00bb.",
    "app.back": "terug naar de modules",
    "app.home.title": "Jouw hulpmiddelen",
    "app.open": "Openen",
    "settings.title": "Mijn account",
    "settings.signedout": "Je bent niet aangemeld.",
    "settings.account": "Account",
    "settings.domain": "Domein van je adres",
    "settings.domain.hint": "Een aanwijzing, geen bewijs van inschrijving.",
    "settings.stored": "Wat we bewaren",
    "settings.stored.value": "De identificatie van je provider, het domein van je adres, en je voorkeuren.",
    "settings.stored.hint": "Niet je volledige adres, en niet de naam die je provider doorgeeft.",
    "settings.language": "Taal",
    "settings.language.hint": "Verandert de interface. Informatie van de instellingen blijft in haar eigen taal.",
    "settings.sessions": "Actieve aanmeldingen",
    "settings.sessions.hint": "Elk toestel waarop je aangemeld bent. Er wordt geen IP-adres of toestel bewaard.",
    "settings.sessions.this": "Dit toestel",
    "settings.sessions.other": "Een ander toestel",
    "settings.sessions.since": "sinds {when}",
    "settings.sessions.end": "Afmelden",
    "settings.sessions.endthis": "Mij hier afmelden",
    "app.setup.prompt": "Uw installatie is niet afgerond: u hebt nog geen gebruikersnaam.",
    "app.setup.go": "Hervatten",
    "settings.profile": "Profiel",
    "settings.username": "Gebruikersnaam",
    "settings.username.hint": "Het enige gegeven uit uw profiel dat anderen te zien krijgen.",
    "settings.save": "Opslaan",
    "settings.saved": "Opgeslagen.",
    "settings.unset": "Niet ingevuld",
    "settings.institution": "Instelling",
    "settings.institution.hint": "Door uzelf opgegeven. Opent geen toegang en bewijst niets.",
    "settings.studies": "Studie",
    "settings.studies.hint": "Verschijnt nooit naast wat u publiceert.",
    "settings.redo": "De installatie opnieuw doorlopen",
    "settings.soon": "Nog niet beschikbaar",
    "settings.soon.contributions": "Je ondertekende bijdragen terugvinden en aanpassen.",
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

    "firstrun.step": "Stap {n} van {total}",
    "firstrun.later": "Later",
    "firstrun.start": "Beginnen",
    "firstrun.back": "Terug",
    "firstrun.next": "Volgende",
    "firstrun.skip": "Overslaan",
    "firstrun.finish": "Afronden",

    "firstrun.1.title": "Welkom bij Studens",
    "firstrun.1.lede":
      "Vier schermen, één minuut. U kunt altijd stoppen en later verdergaan waar u gebleven was.",
    "firstrun.1.point.name": "Een gebruikersnaam. Dat is het enige dat we vragen.",
    "firstrun.1.point.rest": "De rest is optioneel en helpt ons te tonen wat u aangaat.",
    "firstrun.1.point.later": "Alles is achteraf aanpasbaar in uw account.",
    "firstrun.1.known": "We weten alleen dat u een adres hebt bij {domain}. Niets anders.",

    "firstrun.2.title": "Kies een gebruikersnaam",
    "firstrun.2.lede":
      "Dit is de naam waaronder u verschijnt wanneer u iets onder uw eigen naam publiceert.",
    "firstrun.2.label": "Gebruikersnaam",
    "firstrun.2.placeholder": "bijvoorbeeld: lou.martin",
    "firstrun.2.rule":
      "3 tot 24 tekens: kleine letters, cijfers, en een punt, koppelteken of liggend streepje ertussen.",
    "firstrun.2.public":
      "Dit is het enige gegeven uit deze installatie dat anderen te zien krijgen.",
    "firstrun.2.err.short": "Te kort: minstens 3 tekens.",
    "firstrun.2.err.long": "Te lang: hoogstens 24 tekens.",
    "firstrun.2.err.shape":
      "Niet-toegelaten tekens, of een scheidingsteken aan het begin of het einde.",
    "firstrun.2.err.reserved": "Deze naam is voorbehouden.",
    "firstrun.2.err.taken": "Deze gebruikersnaam is al bezet.",
    "firstrun.2.err.other": "Opslaan is mislukt. Probeer opnieuw.",

    "firstrun.3.title": "In welke taal?",
    "firstrun.3.lede": "U kunt dit op elk moment wijzigen.",
    "firstrun.3.note":
      "Dit verandert de interface. Informatie van de instellingen blijft in de taal waarin ze gepubliceerd is.",

    "firstrun.4.title": "Uw studie",
    "firstrun.4.lede":
      "Optioneel, en alleen nuttig om u eerst te tonen wat u aangaat. Sla dit scherm gerust over.",
    "firstrun.4.studies": "Wat u studeert",
    "firstrun.4.studies.placeholder": "bijvoorbeeld: bachelor burgerlijk ingenieur",
    "firstrun.4.year": "Jaar",
    "firstrun.4.year.none": "Dat zeg ik liever niet",
    "firstrun.4.year.n": "Jaar {n}",
    "firstrun.4.interests": "Interesses",
    "firstrun.4.interests.placeholder": "bijvoorbeeld: beveiliging, data, talen",
    "firstrun.4.never":
      "Niets van dit scherm verschijnt naast wat u publiceert, ondertekend noch anoniem.",

    "firstrun.5.title": "Uw instelling",
    "firstrun.5.lede":
      "Alleen de UCLouvain kan gekozen worden: Studens is elders nog niet open. De andere staan erbij omdat ze komen.",
    "firstrun.5.soon": "nog niet open",
    "firstrun.5.declared":
      "Dit is enkel een verklaring. Ze opent geen toegang en bewijst niets.",
  },

  en: {
    "nav.home": "Home",
    "nav.modules": "What it does",
    "nav.privacy": "Privacy",
    "nav.about": "About",
    "nav.signin": "Sign in",
    "nav.register": "Create an account",
    "nav.source": "Source code",
    "nav.enter": "Open the app",
    "nav.signout": "sign out",
    "nav.domain.hint": "address verified at this domain",
    "app.home.lede": "Studens brings together tools for students. Choose a module.",
    "app.modules": "modules",
    "app.home.more": "More will follow. Nothing appears here until it exists.",
    "app.unknown": "Unknown module: \u201c{id}\u201d.",
    "app.back": "back to the modules",
    "app.home.title": "Your tools",
    "app.open": "Open",
    "settings.title": "My account",
    "settings.signedout": "You are not signed in.",
    "settings.account": "Account",
    "settings.domain": "Domain of your address",
    "settings.domain.hint": "Evidence, not proof of enrolment.",
    "settings.stored": "What we keep",
    "settings.stored.value": "Your provider's identifier, the domain of your address, and your preferences.",
    "settings.stored.hint": "Not your full address, and not the name your provider sends us.",
    "settings.language": "Language",
    "settings.language.hint": "Changes the interface. Information from the institutions stays in its own language.",
    "settings.sessions": "Active sign-ins",
    "settings.sessions.hint": "Every device you are signed in on. No IP address and no device is recorded.",
    "settings.sessions.this": "This device",
    "settings.sessions.other": "Another device",
    "settings.sessions.since": "since {when}",
    "settings.sessions.end": "Sign out",
    "settings.sessions.endthis": "Sign me out here",
    "app.setup.prompt": "Your setup is not finished: you have no username yet.",
    "app.setup.go": "Resume",
    "settings.profile": "Profile",
    "settings.username": "Username",
    "settings.username.hint": "The only thing in your profile that other people can see.",
    "settings.save": "Save",
    "settings.saved": "Saved.",
    "settings.unset": "Not given",
    "settings.institution": "Institution",
    "settings.institution.hint": "Declared by you. It opens no access and proves nothing.",
    "settings.studies": "Studies",
    "settings.studies.hint": "Never appears beside what you publish.",
    "settings.redo": "Go through the setup again",
    "settings.soon": "Not available yet",
    "settings.soon.contributions": "Find and edit the contributions you signed.",
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

    "firstrun.step": "Step {n} of {total}",
    "firstrun.later": "Later",
    "firstrun.start": "Start",
    "firstrun.back": "Back",
    "firstrun.next": "Next",
    "firstrun.skip": "Skip",
    "firstrun.finish": "Finish",

    "firstrun.1.title": "Welcome to Studens",
    "firstrun.1.lede":
      "Four screens, one minute. You can stop whenever you like and pick up where you left off.",
    "firstrun.1.point.name": "A username. That is the only thing we ask for.",
    "firstrun.1.point.rest": "The rest is optional, and helps us show you what concerns you.",
    "firstrun.1.point.later": "Everything can be changed afterwards in your account.",
    "firstrun.1.known":
      "All we already know is that you hold an address at {domain}. Nothing else.",

    "firstrun.2.title": "Choose a username",
    "firstrun.2.lede":
      "This is the name you appear under when you publish something in your own name.",
    "firstrun.2.label": "Username",
    "firstrun.2.placeholder": "for example: lou.martin",
    "firstrun.2.rule":
      "3 to 24 characters: lowercase letters, digits, and a dot, hyphen or underscore between two of them.",
    "firstrun.2.public": "It is the only thing from this setup that other people can see.",
    "firstrun.2.err.short": "Too short: 3 characters at least.",
    "firstrun.2.err.long": "Too long: 24 characters at most.",
    "firstrun.2.err.shape":
      "Characters that are not allowed, or a separator at the start or the end.",
    "firstrun.2.err.reserved": "That name is reserved.",
    "firstrun.2.err.taken": "That username is already taken.",
    "firstrun.2.err.other": "Saving failed. Try again.",

    "firstrun.3.title": "Which language?",
    "firstrun.3.lede": "You can change it at any time.",
    "firstrun.3.note":
      "This changes the interface. Information taken from the institutions stays in the language it is published in.",

    "firstrun.4.title": "Your studies",
    "firstrun.4.lede":
      "Optional, and useful only to show you what concerns you first. Skip this screen if you would rather.",
    "firstrun.4.studies": "What you study",
    "firstrun.4.studies.placeholder": "for example: bachelor of civil engineering",
    "firstrun.4.year": "Year",
    "firstrun.4.year.none": "I would rather not say",
    "firstrun.4.year.n": "Year {n}",
    "firstrun.4.interests": "Interests",
    "firstrun.4.interests.placeholder": "for example: security, data, languages",
    "firstrun.4.never":
      "Nothing on this screen appears beside what you publish, signed or anonymous.",

    "firstrun.5.title": "Your institution",
    "firstrun.5.lede":
      "Only UCLouvain can be chosen: Studens is not open anywhere else yet. The others are listed because they are coming.",
    "firstrun.5.soon": "not open yet",
    "firstrun.5.declared": "This is a statement, nothing more. It opens no access and proves nothing.",
  },
};
