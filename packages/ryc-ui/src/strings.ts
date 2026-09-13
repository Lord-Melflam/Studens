/**
 * RYC's own strings, in three languages.
 *
 * The module owns them for the same reason it owns its routes, its storage and
 * its public presentation: a shared translation file is a file every module
 * has to edit, which is the coupling FR-B4 exists to prevent.
 *
 * Keys are prefixed `ryc.` so that a merged bundle cannot collide, and so that
 * a string on screen can be traced to its owner by reading the key.
 */
import type { Bundle } from "@studens/i18n";

export const rycStrings: Bundle = {
  fr: {
    "ryc.name": "Rate Your Courses",
    "ryc.summary":
      "Ce que valent vraiment les cours, d'après les étudiants qui les ont suivis.",
    "ryc.status.note":
      "Utilisable aujourd'hui, avec les 546 cours accessibles depuis les programmes de l'EPL.",

    "ryc.problem.title": "Choisir un cours à l'aveugle",
    "ryc.problem.1":
      "Au moment du PAE, vous choisissez des cours à option sur la base d'une fiche officielle. Elle dit ce que le cours contient. Elle ne dit pas ce qu'il demande vraiment, comment il est donné, ni à quoi ressemble l'examen.",
    "ryc.problem.2":
      "Le reste se passe sur Discord, en septembre, et se perd en trois semaines. Chaque année, la même question est reposée aux mêmes personnes, et la réponse disparaît à nouveau.",
    "ryc.problem.3":
      "Studens garde ces réponses au même endroit, datées, avec la charge de travail réelle et l'année où le cours a été suivi.",

    "ryc.step.1.title": "Cherchez ou parcourez",
    "ryc.step.1.body":
      "Par code, par mot du titre, ou en parcourant un programme entier. Le catalogue vient directement de l'université : ECTS, quadrimestre, langue, heures encadrées et mode d'évaluation officiel.",
    "ryc.step.2.title": "Lisez ce que disent celles et ceux qui l'ont suivi",
    "ryc.step.2.body":
      "Une note de recommandation, la charge de travail rapportée à ses crédits, la difficulté, et surtout du texte : ce qui aide, ce qui manque, et ce qu'il faut savoir avant de s'inscrire.",
    "ryc.step.3.title": "Donnez le vôtre, sous votre nom ou anonymement",
    "ryc.step.3.body":
      "Le choix se fait sur un écran à lui seul, après avoir écrit. L'anonymat est définitif et sans lien avec votre compte : c'est une garantie de structure, pas une promesse.",

    "ryc.highlight.1.title": "Rien ne vous est demandé que l'université publie déjà",
    "ryc.highlight.1.body":
      "ECTS, quadrimestre, langue, heures encadrées, mode d'évaluation avec ses pondérations : tout ça est repris automatiquement. Vous n'écrivez que ce que la fiche officielle ne peut pas dire.",
    "ryc.highlight.2.title": "Des chiffres qui viennent avec leur dénominateur",
    "ryc.highlight.2.body":
      "Une moyenne de 4,1 sur 23 avis ne veut pas dire la même chose que sur 2. Le nombre est toujours affiché à côté, et un taux de réussite n'apparaît qu'au-delà de cinq réponses.",
    "ryc.highlight.3.title": "Une année sur chaque avis",
    "ryc.highlight.3.body":
      "Un cours change de titulaire, de barème, de projet. Savoir qu'un avis date de 2019 est aussi important que ce qu'il dit.",
    "ryc.highlight.4.title": "Vous restez maître de ce que vous signez",
    "ryc.highlight.4.body":
      "Le choix entre votre nom et l'anonymat se fait après avoir écrit, sur un écran à lui seul, avec les chiffres qui vous concernent sous les yeux.",

    "ryc.sources.title": "Le catalogue officiel, directement",
    "ryc.sources.body":
      "Les fiches ne sont pas recopiées à la main : elles sont reprises du site de l'université et rafraîchies. Un lien vers la fiche officielle est affiché sur chaque cours, parce que c'est elle qui fait foi.",
    "ryc.sources.1": "UCLouvain",
    "ryc.sources.2": "546 cours",
    "ryc.sources.3": "43 programmes",
    "ryc.sources.4": "année académique en cours",

    "ryc.first.title": "Vous cherchez un cours",
    "ryc.first.body":
      "Et vous lisez. Écrire le vôtre peut attendre le jour où vous aurez quelque chose à dire.",

    "ryc.mock.example": "exemple",
    "ryc.mock.explain":
      "Personne n'a encore publié d'avis. Ci-dessous, à quoi ressemblera cette partie.",
    "ryc.mock.caption":
      "La fiche du cours est réelle, reprise du catalogue UCLouvain. Les deux avis sont fictifs : il n'y en a pas encore.",
    "ryc.mock.year": "suivi en {years}",

    "ryc.intro":
      "Ce que valent vraiment les cours, d'après les étudiants qui les ont suivis. Parcourez un programme, ou cherchez un cours par son code.",
    "ryc.tab.browse": "Parcourir un programme",
    "ryc.tab.search": "Chercher",
    "ryc.meta": "{n} cours, année académique {from}-{to}",
    "ryc.loading": "chargement…",
    "ryc.err.catalogue": "le catalogue n'est pas chargé",
    "ryc.err.course": "impossible de charger {code}",
    "ryc.err.search": "la recherche a échoué",
    "ryc.search.label": "Code ou mot du titre",
    "ryc.search.placeholder": "LEPL1503, ou « mécanique »",
    "ryc.search.none": "Aucun cours pour « {query} ».",

    "ryc.course.ects": "{n} ECTS",
    "ryc.course.external": "autre institution",
    "ryc.course.reviews.one": "{count} avis",
    "ryc.course.reviews.other": "{count} avis",

    "ryc.browse.back": "retour aux programmes",
    "ryc.browse.faculty": "Faculté",
    "ryc.browse.choose": "choisir",
    "ryc.browse.noProgrammes": "Aucun programme chargé pour cette faculté.",
    "ryc.browse.count": "{shown} programmes sur {total}",
    "ryc.browse.courses.one": "{count} cours",
    "ryc.browse.courses.other": "{count} cours",
    "ryc.browse.searchPlaceholder": "informatique, mineure, sinf…",
    "ryc.browse.noMatch": "Aucun programme ne correspond.",
    "ryc.browse.noneInProgramme": "Aucun cours chargé pour ce programme.",

    "ryc.filter.search": "Filtrer",
    "ryc.filter.searchPlaceholder": "code ou mot du titre",
    "ryc.filter.clear": "tout effacer",
    "ryc.filter.count": "{shown} cours sur {total}",
    "ryc.filter.noMatch": "Aucun cours ne correspond à ces filtres.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Site",
    "ryc.filter.quarter": "Quadrimestre",
    "ryc.filter.ects": "Crédits",
    "ryc.filter.language": "Langue",
    "ryc.filter.entity": "Entité en charge",
    "ryc.filter.reviews": "Avis",
    "ryc.filter.reviewedOnly": "Seulement ceux qui en ont",

    "ryc.kind.bachelier": "Bachelier",
    "ryc.kind.master": "Master",
    "ryc.kind.specialisation": "Master de spécialisation",
    "ryc.kind.mineure": "Mineure",
    "ryc.kind.filiere": "Filière",
    "ryc.kind.approfondissement": "Approfondissement",
    "ryc.kind.certificat": "Certificat",
    "ryc.kind.autre": "Autre",
  },

  nl: {
    "ryc.name": "Rate Your Courses",
    "ryc.summary":
      "Wat vakken echt waard zijn, volgens de studenten die ze gevolgd hebben.",
    "ryc.status.note":
      "Vandaag bruikbaar, met de 546 vakken die vanuit de EPL-opleidingen bereikbaar zijn.",

    "ryc.problem.title": "Blind een vak kiezen",
    "ryc.problem.1":
      "Bij het samenstellen van je jaarprogramma kies je keuzevakken op basis van een officiële fiche. Die zegt wat het vak inhoudt. Ze zegt niet wat het echt vraagt, hoe het gegeven wordt, of hoe het examen eruitziet.",
    "ryc.problem.2":
      "De rest gebeurt op Discord, in september, en is na drie weken weg. Elk jaar wordt dezelfde vraag aan dezelfde mensen gesteld, en verdwijnt het antwoord opnieuw.",
    "ryc.problem.3":
      "Studens bewaart die antwoorden op één plek, gedateerd, met de werkelijke werklast en het jaar waarin het vak gevolgd werd.",

    "ryc.step.1.title": "Zoek of blader",
    "ryc.step.1.body":
      "Op code, op een woord uit de titel, of door een hele opleiding te doorlopen. De catalogus komt rechtstreeks van de universiteit: studiepunten, kwartiel, taal, contacturen en de officiële evaluatievorm.",
    "ryc.step.2.title": "Lees wat wie het gevolgd heeft ervan zegt",
    "ryc.step.2.body":
      "Een aanbevelingsscore, de werklast afgezet tegen de studiepunten, de moeilijkheid, en vooral tekst: wat helpt, wat ontbreekt, en wat je moet weten voor je je inschrijft.",
    "ryc.step.3.title": "Geef het jouwe, onder je naam of anoniem",
    "ryc.step.3.body":
      "Die keuze gebeurt op een scherm apart, nadat je geschreven hebt. Anoniem is definitief en zonder band met je account: een garantie in de structuur, geen belofte.",

    "ryc.highlight.1.title": "Er wordt niets gevraagd wat de universiteit al publiceert",
    "ryc.highlight.1.body":
      "Studiepunten, kwartiel, taal, contacturen, evaluatievorm met de wegingen: dat wordt allemaal automatisch overgenomen. Jij schrijft alleen wat de officiële fiche niet kan zeggen.",
    "ryc.highlight.2.title": "Cijfers die met hun noemer komen",
    "ryc.highlight.2.body":
      "Een gemiddelde van 4,1 op 23 beoordelingen betekent iets anders dan op 2. Het aantal staat er altijd naast, en een slaagpercentage verschijnt pas vanaf vijf antwoorden.",
    "ryc.highlight.3.title": "Een jaartal bij elke beoordeling",
    "ryc.highlight.3.body":
      "Een vak wisselt van titularis, van puntenverdeling, van project. Weten dat een beoordeling uit 2019 komt is even belangrijk als wat ze zegt.",
    "ryc.highlight.4.title": "Jij houdt de hand op wat je ondertekent",
    "ryc.highlight.4.body":
      "De keuze tussen je naam en anonimiteit komt nadat je geschreven hebt, op een scherm apart, met de cijfers die jou aangaan voor ogen.",

    "ryc.sources.title": "De officiële catalogus, rechtstreeks",
    "ryc.sources.body":
      "De fiches worden niet met de hand overgetikt: ze worden van de website van de universiteit overgenomen en ververst. Bij elk vak staat een link naar de officiële fiche, want die is doorslaggevend.",
    "ryc.sources.1": "UCLouvain",
    "ryc.sources.2": "546 vakken",
    "ryc.sources.3": "43 opleidingen",
    "ryc.sources.4": "lopend academiejaar",

    "ryc.first.title": "Je zoekt een vak",
    "ryc.first.body":
      "En je leest. Zelf iets schrijven kan wachten tot de dag dat je iets te zeggen hebt.",

    "ryc.mock.example": "voorbeeld",
    "ryc.mock.explain":
      "Er is nog geen enkele beoordeling gepubliceerd. Hieronder zie je hoe dit deel eruit zal zien.",
    "ryc.mock.caption":
      "De vakfiche is echt, overgenomen uit de catalogus van UCLouvain. De twee beoordelingen zijn verzonnen: er zijn er nog geen.",
    "ryc.mock.year": "gevolgd in {years}",

    "ryc.intro":
      "Wat cursussen echt waard zijn, volgens de studenten die ze gevolgd hebben. Doorloop een opleiding, of zoek een cursus op zijn code.",
    "ryc.tab.browse": "Een opleiding doorlopen",
    "ryc.tab.search": "Zoeken",
    "ryc.meta": "{n} cursussen, academiejaar {from}-{to}",
    "ryc.loading": "laden…",
    "ryc.err.catalogue": "de catalogus is niet geladen",
    "ryc.err.course": "{code} kan niet geladen worden",
    "ryc.err.search": "het zoeken is mislukt",
    "ryc.search.label": "Code of woord uit de titel",
    "ryc.search.placeholder": "LEPL1503, of \u201cmechanica\u201d",
    "ryc.search.none": "Geen cursus voor \u201c{query}\u201d.",

    "ryc.course.ects": "{n} studiepunten",
    "ryc.course.external": "andere instelling",
    "ryc.course.reviews.one": "{count} beoordeling",
    "ryc.course.reviews.other": "{count} beoordelingen",

    "ryc.browse.back": "terug naar de opleidingen",
    "ryc.browse.faculty": "Faculteit",
    "ryc.browse.choose": "kiezen",
    "ryc.browse.noProgrammes": "Geen opleiding geladen voor deze faculteit.",
    "ryc.browse.count": "{shown} van {total} opleidingen",
    "ryc.browse.courses.one": "{count} cursus",
    "ryc.browse.courses.other": "{count} cursussen",
    "ryc.browse.searchPlaceholder": "informatica, minor, sinf…",
    "ryc.browse.noMatch": "Geen enkele opleiding komt overeen.",
    "ryc.browse.noneInProgramme": "Geen cursus geladen voor deze opleiding.",

    "ryc.filter.search": "Filteren",
    "ryc.filter.searchPlaceholder": "code of woord uit de titel",
    "ryc.filter.clear": "alles wissen",
    "ryc.filter.count": "{shown} van {total} cursussen",
    "ryc.filter.noMatch": "Geen cursus komt overeen met deze filters.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Campus",
    "ryc.filter.quarter": "Semester",
    "ryc.filter.ects": "Studiepunten",
    "ryc.filter.language": "Taal",
    "ryc.filter.entity": "Verantwoordelijke entiteit",
    "ryc.filter.reviews": "Beoordelingen",
    "ryc.filter.reviewedOnly": "Alleen die er hebben",

    "ryc.kind.bachelier": "Bachelor",
    "ryc.kind.master": "Master",
    "ryc.kind.specialisation": "Master-na-master",
    "ryc.kind.mineure": "Minor",
    "ryc.kind.filiere": "Traject",
    "ryc.kind.approfondissement": "Verdieping",
    "ryc.kind.certificat": "Getuigschrift",
    "ryc.kind.autre": "Andere",
  },

  en: {
    "ryc.name": "Rate Your Courses",
    "ryc.summary": "What courses are really worth, according to the students who took them.",
    "ryc.status.note":
      "Usable today, with the 546 courses reachable from the EPL programmes.",

    "ryc.problem.title": "Choosing a course blind",
    "ryc.problem.1":
      "When you build your year's programme, you pick electives from an official description. It says what the course contains. It does not say what it actually demands, how it is taught, or what the exam looks like.",
    "ryc.problem.2":
      "The rest happens on Discord, in September, and is gone in three weeks. Every year the same question is put to the same people, and the answer disappears again.",
    "ryc.problem.3":
      "Studens keeps those answers in one place, dated, with the real workload and the year the course was taken.",

    "ryc.step.1.title": "Search, or browse",
    "ryc.step.1.body":
      "By code, by a word in the title, or by going through a whole programme. The catalogue comes straight from the university: credits, term, language, contact hours and the official assessment method.",
    "ryc.step.2.title": "Read what the people who took it say",
    "ryc.step.2.body":
      "A recommendation score, the workload against its credits, the difficulty, and above all prose: what helps, what is missing, and what to know before signing up.",
    "ryc.step.3.title": "Add yours, under your name or anonymously",
    "ryc.step.3.body":
      "That choice happens on a screen of its own, after you have written. Anonymous is permanent and unlinked to your account: a guarantee of structure, not a promise.",

    "ryc.highlight.1.title": "Nothing is asked of you that the university already publishes",
    "ryc.highlight.1.body":
      "Credits, term, language, contact hours, assessment method with its weightings: all of it is taken automatically. You write only what the official description cannot say.",
    "ryc.highlight.2.title": "Numbers that arrive with their denominator",
    "ryc.highlight.2.body":
      "An average of 4.1 across 23 reviews does not mean what it means across 2. The count is always beside it, and a pass rate appears only above five answers.",
    "ryc.highlight.3.title": "A year on every review",
    "ryc.highlight.3.body":
      "A course changes lecturer, marking scheme, project. Knowing a review is from 2019 matters as much as what it says.",
    "ryc.highlight.4.title": "You stay in charge of what you sign",
    "ryc.highlight.4.body":
      "The choice between your name and anonymity comes after you have written, on a screen of its own, with the numbers that concern you in front of you.",

    "ryc.sources.title": "The official catalogue, directly",
    "ryc.sources.body":
      "Course descriptions are not retyped by hand: they are taken from the university's site and refreshed. A link to the official page is shown on every course, because that is the one that counts.",
    "ryc.sources.1": "UCLouvain",
    "ryc.sources.2": "546 courses",
    "ryc.sources.3": "43 programmes",
    "ryc.sources.4": "current academic year",

    "ryc.first.title": "You look up a course",
    "ryc.first.body":
      "And you read. Writing your own can wait for the day you have something to say.",

    "ryc.mock.example": "example",
    "ryc.mock.explain":
      "Nobody has published a review yet. Below is what this part will look like.",
    "ryc.mock.caption":
      "The course record is real, taken from the UCLouvain catalogue. The two reviews are invented: there are none yet.",
    "ryc.mock.year": "taken in {years}",

    "ryc.intro":
      "What courses are really like, according to the students who took them. Browse a programme, or search for a course by its code.",
    "ryc.tab.browse": "Browse a programme",
    "ryc.tab.search": "Search",
    "ryc.meta": "{n} courses, academic year {from}-{to}",
    "ryc.loading": "loading…",
    "ryc.err.catalogue": "the catalogue is not loaded",
    "ryc.err.course": "could not load {code}",
    "ryc.err.search": "the search failed",
    "ryc.search.label": "Code or a word of the title",
    "ryc.search.placeholder": "LEPL1503, or \u201cmechanics\u201d",
    "ryc.search.none": "No course for \u201c{query}\u201d.",

    "ryc.course.ects": "{n} ECTS",
    "ryc.course.external": "another institution",
    "ryc.course.reviews.one": "{count} review",
    "ryc.course.reviews.other": "{count} reviews",

    "ryc.browse.back": "back to the programmes",
    "ryc.browse.faculty": "Faculty",
    "ryc.browse.choose": "choose",
    "ryc.browse.noProgrammes": "No programme loaded for this faculty.",
    "ryc.browse.count": "{shown} of {total} programmes",
    "ryc.browse.courses.one": "{count} course",
    "ryc.browse.courses.other": "{count} courses",
    "ryc.browse.searchPlaceholder": "computer science, minor, sinf…",
    "ryc.browse.noMatch": "No programme matches.",
    "ryc.browse.noneInProgramme": "No course loaded for this programme.",

    "ryc.filter.search": "Filter",
    "ryc.filter.searchPlaceholder": "code or a word of the title",
    "ryc.filter.clear": "clear all",
    "ryc.filter.count": "{shown} of {total} courses",
    "ryc.filter.noMatch": "No course matches these filters.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Site",
    "ryc.filter.quarter": "Term",
    "ryc.filter.ects": "Credits",
    "ryc.filter.language": "Language",
    "ryc.filter.entity": "Entity in charge",
    "ryc.filter.reviews": "Reviews",
    "ryc.filter.reviewedOnly": "Only those that have some",

    "ryc.kind.bachelier": "Bachelor",
    "ryc.kind.master": "Master",
    "ryc.kind.specialisation": "Advanced master",
    "ryc.kind.mineure": "Minor",
    "ryc.kind.filiere": "Track",
    "ryc.kind.approfondissement": "Specialisation path",
    "ryc.kind.certificat": "Certificate",
    "ryc.kind.autre": "Other",
  },
};
