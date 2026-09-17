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
    "ryc.course.ects.unstated": "crédits non précisés",
    "ryc.course.external": "autre institution",
    "ryc.course.reviews.one": "{count} avis",
    "ryc.course.reviews.other": "{count} avis",

    "ryc.browse.back": "retour aux programmes",
    "ryc.browse.noProgrammes": "Aucun programme chargé pour cette faculté.",
    "ryc.browse.count": "{shown} programmes sur {total}",
    "ryc.browse.courses.one": "{count} cours",
    "ryc.browse.courses.other": "{count} cours",
    "ryc.browse.searchPlaceholder": "informatique, mineure, sinf…",
    "ryc.browse.noMatch": "Aucun programme ne correspond.",
    "ryc.browse.noCourseList.flag": "pas de liste de cours",
    "ryc.browse.noCourseList": "L'UCLouvain ne publie pas de liste de cours pour ce programme.",
    "ryc.browse.noCourseList.why":
      "C'est le cas de la formation continue et des programmes organisés avec une autre institution, dont les cours sont hébergés chez elle. Le programme existe : ce qui manque ici manque aussi à la source.",
    "ryc.browse.officialProgramme": "Voir le programme sur uclouvain.be",
    "ryc.browse.noSuchProgramme": "Aucun programme ne porte le code {code}.",
    "ryc.browse.noneInProgramme": "Aucun cours chargé pour ce programme.",

    "ryc.filter.search": "Filtrer",
    "ryc.filter.searchPlaceholder": "code ou mot du titre",
    "ryc.filter.clear": "tout effacer",
    "ryc.filter.count": "{shown} cours sur {total}",
    "ryc.filter.noMatch": "Aucun cours ne correspond à ces filtres.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Site",
    "ryc.filter.faculty": "Faculté",
    "ryc.filter.domain": "Domaine",
    "ryc.filter.noTerm": "Quadrimestre non précisé",
    "ryc.filter.choose": "choisir parmi {n}",
    "ryc.filter.fold": "replier",
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

    "ryc.mock.ribbon": "5 ECTS · Q2 · Français · 30.0 h + 30.0 h",
    "ryc.mock.named.body":
      "Le projet est long mais c'est là que j'ai le plus appris. Commencez l'architecture la première semaine, pas la troisième.",
    "ryc.mock.anon.body":
      "Beaucoup de travail non encadré en dehors des séances, et le barème du travail de groupe mérite d'être lu en entier avant de s'inscrire.",
    "ryc.anonymous": "Anonyme",
    "ryc.detached": "Compte supprimé",
    "ryc.reviews.detached.one": "{count} vient d'un compte supprimé.",
    "ryc.reviews.detached.other": "{count} viennent de comptes supprimés.",
    "ryc.imported": "Repris de {source}",
    "ryc.err.send": "l'envoi a échoué",
    "ryc.signin.required":
      "Publier un avis demande d'être connecté. La commande de connexion est en haut de la page.",

    "ryc.steps.label": "Étapes",
    "ryc.steps.form": "Votre avis",
    "ryc.steps.fork": "Nom ou anonyme",
    "ryc.steps.confirm": "Confirmation",

    "ryc.course.back": "retour",
    "ryc.course.teachers": "Enseignants",
    "ryc.course.entity": "Entité en charge",
    "ryc.course.reachedVia": "Accessible via",
    "ryc.course.hours": "Heures encadrées",
    "ryc.course.assessment": "Évaluation",
    "ryc.course.sourceLanguage": "Fiche publiée en français par l'UCLouvain.",
    "ryc.course.themes": "Thèmes abordés",
    "ryc.course.content": "Contenu",
    "ryc.course.official": "Fiche officielle",
    "ryc.course.notOffered.flag": "plus au programme",
    "ryc.course.notOffered":
      "L'UCLouvain ne propose plus ce cours cette année. Ce qui suit est sa dernière description publiée, celle de {year}-{next}. Les avis le concernant restent lisibles, et vous pouvez toujours en écrire un si vous l'avez suivi.",
    "ryc.course.external.note":
      "Ce cours est donné dans une autre institution. UCLouvain n'en publie que la référence, donc les détails ci-dessous sont incomplets.",

    "ryc.stat.of": "sur 5",
    "ryc.stat.recommendation": "recommandé",
    "ryc.stat.workload": "charge / ECTS",
    "ryc.stat.difficulty": "difficulté",
    "ryc.reviews.title": "Avis",
    "ryc.reviews.write": "Donner mon avis",
    "ryc.reviews.failed": "Les avis n'ont pas pu être chargés.",
    "ryc.reviews.denominator": "Sur {count} avis : {named} nommés, {anonymous} anonymes.",
    "ryc.reviews.pass": "Réussite : {band}.",
    "ryc.reviews.none":
      "Personne n'a encore donné son avis sur ce cours. Le premier avis est le plus utile, et le plus exposé : le choix entre votre nom et l'anonymat vous sera présenté avant l'envoi.",
    "ryc.reviews.locked":
      "Les chiffres ci-dessus décrivent le cours et restent publics. Le texte des avis demande un compte.",
    "ryc.review.taken": "suivi en {from}-{to}",
    "ryc.review.scores":
      "recommandé {recommendation}/5 · charge {workload}/5 · difficulté {difficulty}/5",

    "ryc.scale.recommendation.label": "Le recommanderiez-vous ?",
    "ryc.scale.recommendation.low": "je déconseille",
    "ryc.scale.recommendation.high": "je recommande",
    "ryc.scale.recommendation.short": "la recommandation",
    "ryc.scale.workloadVsEcts.label": "Charge de travail, par rapport à ses ECTS",
    "ryc.scale.workloadVsEcts.low": "bien plus léger",
    "ryc.scale.workloadVsEcts.high": "bien plus lourd",
    "ryc.scale.workloadVsEcts.short": "la charge de travail",
    "ryc.scale.difficulty.label": "Difficulté",
    "ryc.scale.difficulty.low": "très facile",
    "ryc.scale.difficulty.high": "très difficile",
    "ryc.scale.difficulty.short": "la difficulté",

    "ryc.form.back": "retour à la fiche",
    "ryc.form.title": "Votre avis sur {code}",
    "ryc.form.lede":
      "Le choix entre votre nom et l'anonymat vient après, sur un écran à lui seul.",
    "ryc.form.quota.one": "Il vous reste un avis à publier pour cette période.",
    "ryc.form.quota.other": "Il vous reste {count} avis à publier pour cette période.",
    "ryc.form.quota.note":
      "La limite compte les avis, jamais lesquels : elle vaut pour les deux voies, sans lien entre votre compte et un avis anonyme.",
    "ryc.form.completed": "J'ai suivi ce cours jusqu'au bout.",
    "ryc.form.completed.note": "Sans cela, il n'y a pas d'avis à donner.",
    "ryc.form.year": "Année où vous l'avez suivi",
    "ryc.form.hours": "Heures par semaine, en dehors des séances",
    "ryc.form.optional": "facultatif",
    "ryc.form.passed": "Avez-vous réussi ce cours ?",
    "ryc.form.passed.yes": "oui",
    "ryc.form.passed.no": "non",
    "ryc.form.passed.unsaid": "je préfère ne pas dire",
    "ryc.form.passed.note":
      "Jamais affiché avec votre avis. Utilisé seulement pour une indication globale, à partir de cinq réponses.",
    "ryc.form.body": "Votre avis",
    "ryc.form.body.placeholder": "Comment le cours est donné, ce qui aide, ce qui manque.",
    "ryc.form.count.short.one": "encore {count} caractère",
    "ryc.form.count.short.other": "encore {count} caractères",
    "ryc.form.count.long.one": "{count} caractère de trop",
    "ryc.form.count.long.other": "{count} caractères de trop",
    "ryc.form.count.ok": "{n} caractères, sur {max} au maximum",
    "ryc.form.advice": "Un conseil à qui le prendra l'an prochain",
    "ryc.form.missing": "Il manque : {list}.",
    "ryc.form.missing.completed": "confirmer que vous avez terminé le cours",
    "ryc.form.missing.body": "le texte de l'avis",
    "ryc.form.missing.long": "raccourcir le texte ({max} caractères maximum)",
    "ryc.form.abandon": "Abandonner cet avis ? Le texte sera perdu.",
    "ryc.form.continue": "Continuer",
    "ryc.form.nothing.sent": "Rien n'est envoyé à cette étape.",

    "ryc.quota.done":
      "Vous avez atteint votre limite d'avis pour cette période. Elle se renouvelle : revenez dans quelques jours.",
    "ryc.quota.note":
      "Nous comptons combien d'avis vous publiez, jamais lesquels. Un avis anonyme reste sans lien avec votre compte, y compris pour ce décompte.",

    "ryc.draft.reread": "Relire mon avis",
    "ryc.draft.facts":
      "recommandé {recommendation}/5 · charge {workload}/5 · difficulté {difficulty}/5 · {chars} caractères",
    "ryc.draft.advice": "Conseil :",

    "ryc.counts.lead": "Ce cours a",
    "ryc.counts.and": "et",
    "ryc.counts.named.one": "{count} avis nommé",
    "ryc.counts.named.other": "{count} avis nommés",
    "ryc.counts.anon.one": "{count} avis anonyme",
    "ryc.counts.anon.other": "{count} avis anonymes",
    "ryc.counts.first": "Vous seriez le premier.",
    "ryc.counts.note":
      "Plus il y a d'avis anonymes, moins le vôtre ressort. Vous seul savez combien d'étudiants ont suivi ce cours : nous ne le savons pas.",

    "ryc.fork.back": "revenir au formulaire",
    "ryc.fork.title": "Comment voulez-vous publier cet avis ?",
    "ryc.fork.lede": "Ce choix ne peut pas être changé après l'envoi. Lisez les deux avant de choisir.",
    "ryc.fork.named.chip": "Sous mon nom",
    "ryc.fork.named.1": "Votre nom apparaît sur la fiche du cours.",
    "ryc.fork.named.2": "On peut vous demander des précisions, ou vous contredire.",
    "ryc.fork.named.3": "Vous restez rattaché à cet avis, y compris dans un an.",
    "ryc.fork.named.cta": "Publier sous mon nom",
    "ryc.fork.anon.chip": "Anonyme",
    "ryc.fork.anon.lead": "Définitif",
    "ryc.fork.anon.1": "Aucun nom, aucune faculté, aucun domaine.",
    "ryc.fork.anon.2": "Impossible à modifier ou à supprimer.",
    "ryc.fork.anon.3": "Vous ne pourrez pas prouver qu'il est de vous.",
    "ryc.fork.anon.cta": "Continuer en anonyme",
    "ryc.fork.note":
      "La modification d'un avis nommé est prévue et n'est pas encore en place. Elle ne concernera jamais un avis anonyme : personne, nous y compris, ne peut retrouver lequel est le vôtre.",

    "ryc.confirm.back": "revenir au choix",
    "ryc.confirm.title": "Dernière étape avant l'envoi",
    "ryc.confirm.1.before": "Cet avis sera publié",
    "ryc.confirm.1.strong": "sans aucun lien avec votre compte.",
    "ryc.confirm.2": "Vous ne pourrez plus le modifier, le corriger ni le retirer.",
    "ryc.confirm.2.em": "Nous non plus, à votre demande : nous ne saurons pas lequel est le vôtre.",
    "ryc.confirm.3":
      "Un modérateur pourra le retirer s'il pose problème, sans savoir qui l'a écrit.",
    "ryc.confirm.sending": "envoi…",
    "ryc.confirm.cta": "Publier anonymement, définitivement",
    "ryc.confirm.return": "Revenir en arrière",

    "ryc.sent.title": "Avis envoyé",
    "ryc.sent.anon":
      "Il part en modération sans rien qui le relie à vous. Cette page ne peut pas vous le montrer, ni maintenant ni plus tard : nous ne savons pas lequel est le vôtre, et c'est exactement ce que vous avez choisi.",
    "ryc.sent.named":
      "Il part en modération sous votre nom, et apparaîtra sur la fiche du cours une fois relu.",
    "ryc.sent.back": "Retour à la fiche",

    "ryc.report.open": "Signaler cet avis",
    "ryc.report.title": "Signaler cet avis",
    "ryc.report.lede":
      "Dites-nous ce qui ne va pas. Pas besoin de compte. Un signalement est lu par une personne, jamais traité automatiquement.",
    "ryc.report.why": "Pourquoi",
    "ryc.report.cat.illegal": "C'est illégal",
    "ryc.report.cat.illegal.hint": "Diffamation, menace, incitation à la haine, ou autre infraction.",
    "ryc.report.cat.thirdparty": "Cela désigne quelqu'un",
    "ryc.report.cat.thirdparty.hint":
      "Nomme ou identifie une personne qui n'a pas demandé à l'être, ou donne ses coordonnées.",
    "ryc.report.cat.abuse": "C'est une attaque",
    "ryc.report.cat.abuse.hint": "Insultes ou harcèlement, plutôt qu'un avis sur le cours.",
    "ryc.report.cat.spam": "C'est hors sujet",
    "ryc.report.cat.spam.hint": "Publicité, répétition, ou sans rapport avec le cours.",
    "ryc.report.cat.inaccurate": "C'est faux",
    "ryc.report.cat.inaccurate.hint": "Des faits inexacts, sans relever des cas ci-dessus.",
    "ryc.report.cat.immediate":
      "Cet avis sera masqué immédiatement, le temps qu'une personne le lise.",
    "ryc.report.detail": "Expliquez",
    "ryc.report.detail.placeholder":
      "Ce qui pose problème, et pourquoi. Plus c'est précis, plus vite c'est traitable.",
    "ryc.report.detail.rule": "Au moins {min} caractères : une explication, pas un mot.",
    "ryc.report.contact": "Votre adresse e-mail (facultatif)",
    "ryc.report.contact.placeholder": "pour être tenu au courant",
    "ryc.report.contact.hint":
      "Uniquement pour vous dire ce qui a été décidé. Sans elle, nous n'avons aucun moyen de vous répondre.",
    "ryc.report.send": "Envoyer le signalement",
    "ryc.report.sending": "envoi…",
    "ryc.report.cancel": "Annuler",
    "ryc.report.close": "Fermer",
    "ryc.report.thanks": "Signalement reçu.",
    "ryc.report.sent.held":
      "Cet avis est masqué le temps qu'une personne le lise. S'il ne pose pas de problème, il réapparaîtra.",
    "ryc.report.sent.queued": "Il sera lu par une personne. L'avis reste visible en attendant.",
    "ryc.report.nodeadline":
      "Nous ne promettons pas de délai tant que nous n'en avons pas mesuré un. Ce qui est signalé comme illégal ou nommant quelqu'un est masqué d'abord.",
    "ryc.report.failed": "L'envoi a échoué. Réessayez.",
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
    "ryc.course.ects.unstated": "studiepunten niet vermeld",
    "ryc.course.external": "andere instelling",
    "ryc.course.reviews.one": "{count} beoordeling",
    "ryc.course.reviews.other": "{count} beoordelingen",

    "ryc.browse.back": "terug naar de opleidingen",
    "ryc.browse.noProgrammes": "Geen opleiding geladen voor deze faculteit.",
    "ryc.browse.count": "{shown} van {total} opleidingen",
    "ryc.browse.courses.one": "{count} cursus",
    "ryc.browse.courses.other": "{count} cursussen",
    "ryc.browse.searchPlaceholder": "informatica, minor, sinf…",
    "ryc.browse.noMatch": "Geen enkele opleiding komt overeen.",
    "ryc.browse.noCourseList.flag": "geen cursuslijst",
    "ryc.browse.noCourseList": "UCLouvain publiceert geen cursuslijst voor dit programma.",
    "ryc.browse.noCourseList.why":
      "Dat is zo voor permanente vorming en voor programma's die samen met een andere instelling georganiseerd worden, waar de cursussen bij die instelling staan. Het programma bestaat: wat hier ontbreekt, ontbreekt ook bij de bron.",
    "ryc.browse.officialProgramme": "Het programma op uclouvain.be bekijken",
    "ryc.browse.noSuchProgramme": "Geen programma met de code {code}.",
    "ryc.browse.noneInProgramme": "Geen cursus geladen voor deze opleiding.",

    "ryc.filter.search": "Filteren",
    "ryc.filter.searchPlaceholder": "code of woord uit de titel",
    "ryc.filter.clear": "alles wissen",
    "ryc.filter.count": "{shown} van {total} cursussen",
    "ryc.filter.noMatch": "Geen cursus komt overeen met deze filters.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Campus",
    "ryc.filter.faculty": "Faculteit",
    "ryc.filter.domain": "Vakgebied",
    "ryc.filter.noTerm": "Semester niet vermeld",
    "ryc.filter.choose": "kies uit {n}",
    "ryc.filter.fold": "dichtklappen",
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

    "ryc.mock.ribbon": "5 studiepunten · Q2 · Frans · 30.0 u + 30.0 u",
    "ryc.mock.named.body":
      "Het project is lang, maar het is waar ik het meeste geleerd heb. Begin met de architectuur in de eerste week, niet in de derde.",
    "ryc.mock.anon.body":
      "Veel onbegeleid werk buiten de sessies, en het beoordelingsschema van het groepswerk verdient het om volledig gelezen te worden vóór je inschrijft.",
    "ryc.anonymous": "Anoniem",
    "ryc.detached": "Verwijderd account",
    "ryc.reviews.detached.one": "{count} komt van een verwijderd account.",
    "ryc.reviews.detached.other": "{count} komen van verwijderde accounts.",
    "ryc.imported": "Overgenomen uit {source}",
    "ryc.err.send": "verzenden is mislukt",
    "ryc.signin.required":
      "Een beoordeling plaatsen vereist dat u aangemeld bent. De aanmeldknop staat bovenaan de pagina.",

    "ryc.steps.label": "Stappen",
    "ryc.steps.form": "Uw beoordeling",
    "ryc.steps.fork": "Naam of anoniem",
    "ryc.steps.confirm": "Bevestiging",

    "ryc.course.back": "terug",
    "ryc.course.teachers": "Docenten",
    "ryc.course.entity": "Verantwoordelijke entiteit",
    "ryc.course.reachedVia": "Bereikbaar via",
    "ryc.course.hours": "Begeleide uren",
    "ryc.course.assessment": "Evaluatie",
    "ryc.course.sourceLanguage": "Fiche door UCLouvain in het Frans gepubliceerd.",
    "ryc.course.themes": "Behandelde thema's",
    "ryc.course.content": "Inhoud",
    "ryc.course.official": "Officiële fiche",
    "ryc.course.notOffered.flag": "niet meer aangeboden",
    "ryc.course.notOffered":
      "UCLouvain biedt deze cursus dit jaar niet meer aan. Hieronder staat de laatste gepubliceerde beschrijving, die van {year}-{next}. De beoordelingen blijven leesbaar en u kunt er nog een schrijven als u de cursus gevolgd hebt.",
    "ryc.course.external.note":
      "Deze cursus wordt aan een andere instelling gegeven. UCLouvain publiceert er enkel de verwijzing van, dus de details hieronder zijn onvolledig.",

    "ryc.stat.of": "op 5",
    "ryc.stat.recommendation": "aanbevolen",
    "ryc.stat.workload": "belasting / studiepunten",
    "ryc.stat.difficulty": "moeilijkheid",
    "ryc.reviews.title": "Beoordelingen",
    "ryc.reviews.write": "Mijn beoordeling geven",
    "ryc.reviews.failed": "De beoordelingen konden niet geladen worden.",
    "ryc.reviews.denominator": "Op {count} beoordelingen: {named} met naam, {anonymous} anoniem.",
    "ryc.reviews.pass": "Slaagkans: {band}.",
    "ryc.reviews.none":
      "Niemand heeft deze cursus al beoordeeld. De eerste beoordeling is de nuttigste, en ook de meest zichtbare: de keuze tussen uw naam en anonimiteit krijgt u vóór het verzenden.",
    "ryc.reviews.locked":
      "De cijfers hierboven beschrijven de cursus en blijven publiek. De tekst van de beoordelingen vereist een account.",
    "ryc.review.taken": "gevolgd in {from}-{to}",
    "ryc.review.scores":
      "aanbevolen {recommendation}/5 · belasting {workload}/5 · moeilijkheid {difficulty}/5",

    "ryc.scale.recommendation.label": "Zou u ze aanraden?",
    "ryc.scale.recommendation.low": "ik raad ze af",
    "ryc.scale.recommendation.high": "ik raad ze aan",
    "ryc.scale.recommendation.short": "de aanbeveling",
    "ryc.scale.workloadVsEcts.label": "Werklast, tegenover de studiepunten",
    "ryc.scale.workloadVsEcts.low": "veel lichter",
    "ryc.scale.workloadVsEcts.high": "veel zwaarder",
    "ryc.scale.workloadVsEcts.short": "de werklast",
    "ryc.scale.difficulty.label": "Moeilijkheid",
    "ryc.scale.difficulty.low": "heel makkelijk",
    "ryc.scale.difficulty.high": "heel moeilijk",
    "ryc.scale.difficulty.short": "de moeilijkheid",

    "ryc.form.back": "terug naar de fiche",
    "ryc.form.title": "Uw beoordeling van {code}",
    "ryc.form.lede": "De keuze tussen uw naam en anonimiteit komt daarna, op een scherm apart.",
    "ryc.form.quota.one": "U kunt deze periode nog één beoordeling plaatsen.",
    "ryc.form.quota.other": "U kunt deze periode nog {count} beoordelingen plaatsen.",
    "ryc.form.quota.note":
      "De limiet telt beoordelingen, nooit welke: ze geldt voor beide wegen, zonder verband tussen uw account en een anonieme beoordeling.",
    "ryc.form.completed": "Ik heb deze cursus tot het einde gevolgd.",
    "ryc.form.completed.note": "Zonder dat valt er niets te beoordelen.",
    "ryc.form.year": "Jaar waarin u ze gevolgd hebt",
    "ryc.form.hours": "Uren per week, buiten de lessen",
    "ryc.form.optional": "optioneel",
    "ryc.form.passed": "Bent u geslaagd voor deze cursus?",
    "ryc.form.passed.yes": "ja",
    "ryc.form.passed.no": "nee",
    "ryc.form.passed.unsaid": "dat zeg ik liever niet",
    "ryc.form.passed.note":
      "Wordt nooit bij uw beoordeling getoond. Enkel gebruikt voor een algemene aanwijzing, vanaf vijf antwoorden.",
    "ryc.form.body": "Uw beoordeling",
    "ryc.form.body.placeholder": "Hoe de cursus gegeven wordt, wat helpt, wat ontbreekt.",
    "ryc.form.count.short.one": "nog {count} teken",
    "ryc.form.count.short.other": "nog {count} tekens",
    "ryc.form.count.long.one": "{count} teken te veel",
    "ryc.form.count.long.other": "{count} tekens te veel",
    "ryc.form.count.ok": "{n} tekens, op maximaal {max}",
    "ryc.form.advice": "Een tip voor wie ze volgend jaar neemt",
    "ryc.form.missing": "Er ontbreekt: {list}.",
    "ryc.form.missing.completed": "bevestigen dat u de cursus afgerond hebt",
    "ryc.form.missing.body": "de tekst van de beoordeling",
    "ryc.form.missing.long": "de tekst inkorten (maximaal {max} tekens)",
    "ryc.form.abandon": "Deze beoordeling laten vallen? De tekst gaat verloren.",
    "ryc.form.continue": "Verder",
    "ryc.form.nothing.sent": "In deze stap wordt niets verzonden.",

    "ryc.quota.done":
      "U hebt uw limiet aan beoordelingen voor deze periode bereikt. Ze wordt vernieuwd: kom over enkele dagen terug.",
    "ryc.quota.note":
      "Wij tellen hoeveel beoordelingen u plaatst, nooit welke. Een anonieme beoordeling blijft los van uw account, ook voor die telling.",

    "ryc.draft.reread": "Mijn beoordeling nalezen",
    "ryc.draft.facts":
      "aanbevolen {recommendation}/5 · belasting {workload}/5 · moeilijkheid {difficulty}/5 · {chars} tekens",
    "ryc.draft.advice": "Tip:",

    "ryc.counts.lead": "Deze cursus heeft",
    "ryc.counts.and": "en",
    "ryc.counts.named.one": "{count} beoordeling met naam",
    "ryc.counts.named.other": "{count} beoordelingen met naam",
    "ryc.counts.anon.one": "{count} anonieme beoordeling",
    "ryc.counts.anon.other": "{count} anonieme beoordelingen",
    "ryc.counts.first": "U zou de eerste zijn.",
    "ryc.counts.note":
      "Hoe meer anonieme beoordelingen er zijn, hoe minder de uwe opvalt. Alleen u weet hoeveel studenten deze cursus gevolgd hebben: wij weten dat niet.",

    "ryc.fork.back": "terug naar het formulier",
    "ryc.fork.title": "Hoe wilt u deze beoordeling publiceren?",
    "ryc.fork.lede":
      "Deze keuze kan na het verzenden niet meer veranderd worden. Lees beide vóór u kiest.",
    "ryc.fork.named.chip": "Onder mijn naam",
    "ryc.fork.named.1": "Uw naam verschijnt op de fiche van de cursus.",
    "ryc.fork.named.2": "Men kan u om verduidelijking vragen, of u tegenspreken.",
    "ryc.fork.named.3": "U blijft aan deze beoordeling verbonden, ook over een jaar.",
    "ryc.fork.named.cta": "Publiceren onder mijn naam",
    "ryc.fork.anon.chip": "Anoniem",
    "ryc.fork.anon.lead": "Definitief",
    "ryc.fork.anon.1": "Geen naam, geen faculteit, geen domein.",
    "ryc.fork.anon.2": "Niet aan te passen of te verwijderen.",
    "ryc.fork.anon.3": "U zult niet kunnen bewijzen dat ze van u is.",
    "ryc.fork.anon.cta": "Anoniem verdergaan",
    "ryc.fork.note":
      "Een beoordeling met naam aanpassen is gepland en bestaat nog niet. Het zal nooit gelden voor een anonieme beoordeling: niemand, wij inbegrepen, kan terugvinden welke de uwe is.",

    "ryc.confirm.back": "terug naar de keuze",
    "ryc.confirm.title": "Laatste stap vóór het verzenden",
    "ryc.confirm.1.before": "Deze beoordeling wordt gepubliceerd",
    "ryc.confirm.1.strong": "zonder enig verband met uw account.",
    "ryc.confirm.2": "U kunt ze daarna niet meer aanpassen, verbeteren of intrekken.",
    "ryc.confirm.2.em": "Wij evenmin, op uw vraag: wij zullen niet weten welke de uwe is.",
    "ryc.confirm.3":
      "Een moderator kan ze verwijderen als ze problemen geeft, zonder te weten wie ze schreef.",
    "ryc.confirm.sending": "verzenden…",
    "ryc.confirm.cta": "Anoniem publiceren, definitief",
    "ryc.confirm.return": "Terugkeren",

    "ryc.sent.title": "Beoordeling verzonden",
    "ryc.sent.anon":
      "Ze gaat naar moderatie zonder iets dat ze aan u koppelt. Deze pagina kan ze u niet tonen, nu niet en later niet: wij weten niet welke de uwe is, en dat is precies wat u gekozen hebt.",
    "ryc.sent.named":
      "Ze gaat naar moderatie onder uw naam, en verschijnt op de fiche van de cursus zodra ze nagelezen is.",
    "ryc.sent.back": "Terug naar de fiche",

    "ryc.report.open": "Deze beoordeling melden",
    "ryc.report.title": "Deze beoordeling melden",
    "ryc.report.lede":
      "Zeg ons wat er mis is. U hebt geen account nodig. Een melding wordt door een mens gelezen, nooit automatisch afgehandeld.",
    "ryc.report.why": "Waarom",
    "ryc.report.cat.illegal": "Het is onwettig",
    "ryc.report.cat.illegal.hint": "Laster, bedreiging, aanzetten tot haat, of een ander misdrijf.",
    "ryc.report.cat.thirdparty": "Het wijst iemand aan",
    "ryc.report.cat.thirdparty.hint":
      "Noemt of identificeert iemand die daar niet om gevraagd heeft, of geeft diens contactgegevens.",
    "ryc.report.cat.abuse": "Het is een aanval",
    "ryc.report.cat.abuse.hint": "Beledigingen of intimidatie, eerder dan een mening over de cursus.",
    "ryc.report.cat.spam": "Het hoort hier niet",
    "ryc.report.cat.spam.hint": "Reclame, herhaling, of zonder verband met de cursus.",
    "ryc.report.cat.inaccurate": "Het klopt niet",
    "ryc.report.cat.inaccurate.hint": "Onjuiste feiten, zonder onder het bovenstaande te vallen.",
    "ryc.report.cat.immediate":
      "Deze beoordeling wordt meteen verborgen, tot iemand ze gelezen heeft.",
    "ryc.report.detail": "Leg uit",
    "ryc.report.detail.placeholder":
      "Wat er mis is, en waarom. Hoe preciezer, hoe sneller er iets mee kan gebeuren.",
    "ryc.report.detail.rule": "Minstens {min} tekens: een uitleg, geen enkel woord.",
    "ryc.report.contact": "Uw e-mailadres (optioneel)",
    "ryc.report.contact.placeholder": "om op de hoogte gehouden te worden",
    "ryc.report.contact.hint":
      "Enkel om u te zeggen wat er beslist is. Zonder adres hebben wij geen enkele manier om u te antwoorden.",
    "ryc.report.send": "Melding versturen",
    "ryc.report.sending": "verzenden…",
    "ryc.report.cancel": "Annuleren",
    "ryc.report.close": "Sluiten",
    "ryc.report.thanks": "Melding ontvangen.",
    "ryc.report.sent.held":
      "Deze beoordeling is verborgen tot iemand ze gelezen heeft. Is er niets mis mee, dan verschijnt ze opnieuw.",
    "ryc.report.sent.queued":
      "Ze wordt door een mens gelezen. De beoordeling blijft intussen zichtbaar.",
    "ryc.report.nodeadline":
      "Wij beloven geen termijn zolang wij er geen gemeten hebben. Wat als onwettig gemeld wordt, of wat iemand noemt, wordt eerst verborgen.",
    "ryc.report.failed": "Verzenden is mislukt. Probeer opnieuw.",
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
    "ryc.course.ects.unstated": "credits not stated",
    "ryc.course.external": "another institution",
    "ryc.course.reviews.one": "{count} review",
    "ryc.course.reviews.other": "{count} reviews",

    "ryc.browse.back": "back to the programmes",
    "ryc.browse.noProgrammes": "No programme loaded for this faculty.",
    "ryc.browse.count": "{shown} of {total} programmes",
    "ryc.browse.courses.one": "{count} course",
    "ryc.browse.courses.other": "{count} courses",
    "ryc.browse.searchPlaceholder": "computer science, minor, sinf…",
    "ryc.browse.noMatch": "No programme matches.",
    "ryc.browse.noCourseList.flag": "no course list",
    "ryc.browse.noCourseList": "UCLouvain publishes no course list for this programme.",
    "ryc.browse.noCourseList.why":
      "That is the case for continuing education and for programmes run with another institution, whose courses are hosted there. The programme exists: what is missing here is missing from the source too.",
    "ryc.browse.officialProgramme": "See the programme on uclouvain.be",
    "ryc.browse.noSuchProgramme": "No programme has the code {code}.",
    "ryc.browse.noneInProgramme": "No course loaded for this programme.",

    "ryc.filter.search": "Filter",
    "ryc.filter.searchPlaceholder": "code or a word of the title",
    "ryc.filter.clear": "clear all",
    "ryc.filter.count": "{shown} of {total} courses",
    "ryc.filter.noMatch": "No course matches these filters.",
    "ryc.filter.kind": "Type",
    "ryc.filter.site": "Site",
    "ryc.filter.faculty": "Faculty",
    "ryc.filter.domain": "Field of study",
    "ryc.filter.noTerm": "Term not stated",
    "ryc.filter.choose": "choose from {n}",
    "ryc.filter.fold": "fold away",
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

    "ryc.mock.ribbon": "5 ECTS · Q2 · French · 30.0 h + 30.0 h",
    "ryc.mock.named.body":
      "The project is long but it is where I learned the most. Start on the architecture in week one, not week three.",
    "ryc.mock.anon.body":
      "A lot of unsupervised work outside the sessions, and the group-work marking scheme is worth reading in full before you sign up.",
    "ryc.anonymous": "Anonymous",
    "ryc.detached": "Deleted account",
    "ryc.reviews.detached.one": "{count} is from a deleted account.",
    "ryc.reviews.detached.other": "{count} are from deleted accounts.",
    "ryc.imported": "Taken from {source}",
    "ryc.err.send": "sending failed",
    "ryc.signin.required":
      "Posting a review requires being signed in. The sign-in control is at the top of the page.",

    "ryc.steps.label": "Steps",
    "ryc.steps.form": "Your review",
    "ryc.steps.fork": "Name or anonymous",
    "ryc.steps.confirm": "Confirmation",

    "ryc.course.back": "back",
    "ryc.course.teachers": "Lecturers",
    "ryc.course.entity": "Entity in charge",
    "ryc.course.reachedVia": "Reachable through",
    "ryc.course.hours": "Contact hours",
    "ryc.course.assessment": "Assessment",
    "ryc.course.sourceLanguage": "Course record published by UCLouvain in French.",
    "ryc.course.themes": "Themes covered",
    "ryc.course.content": "Content",
    "ryc.course.official": "Official page",
    "ryc.course.notOffered.flag": "no longer offered",
    "ryc.course.notOffered":
      "UCLouvain no longer offers this course. What follows is its last published description, from {year}-{next}. Reviews of it stay readable, and you can still write one if you took it.",
    "ryc.course.external.note":
      "This course is taught at another institution. UCLouvain publishes only the reference, so the details below are incomplete.",

    "ryc.stat.of": "out of 5",
    "ryc.stat.recommendation": "recommended",
    "ryc.stat.workload": "workload / ECTS",
    "ryc.stat.difficulty": "difficulty",
    "ryc.reviews.title": "Reviews",
    "ryc.reviews.write": "Write a review",
    "ryc.reviews.failed": "The reviews could not be loaded.",
    "ryc.reviews.denominator": "Out of {count} reviews: {named} named, {anonymous} anonymous.",
    "ryc.reviews.pass": "Passing: {band}.",
    "ryc.reviews.none":
      "Nobody has reviewed this course yet. The first review is the most useful, and the most exposed: the choice between your name and anonymity is put to you before sending.",
    "ryc.reviews.locked":
      "The figures above describe the course and stay public. The text of the reviews requires an account.",
    "ryc.review.taken": "taken in {from}-{to}",
    "ryc.review.scores":
      "recommended {recommendation}/5 · workload {workload}/5 · difficulty {difficulty}/5",

    "ryc.scale.recommendation.label": "Would you recommend it?",
    "ryc.scale.recommendation.low": "I advise against",
    "ryc.scale.recommendation.high": "I recommend it",
    "ryc.scale.recommendation.short": "the recommendation",
    "ryc.scale.workloadVsEcts.label": "Workload, against its ECTS",
    "ryc.scale.workloadVsEcts.low": "much lighter",
    "ryc.scale.workloadVsEcts.high": "much heavier",
    "ryc.scale.workloadVsEcts.short": "the workload",
    "ryc.scale.difficulty.label": "Difficulty",
    "ryc.scale.difficulty.low": "very easy",
    "ryc.scale.difficulty.high": "very hard",
    "ryc.scale.difficulty.short": "the difficulty",

    "ryc.form.back": "back to the course",
    "ryc.form.title": "Your review of {code}",
    "ryc.form.lede": "The choice between your name and anonymity comes after, on a screen of its own.",
    "ryc.form.quota.one": "You have one review left to post this period.",
    "ryc.form.quota.other": "You have {count} reviews left to post this period.",
    "ryc.form.quota.note":
      "The limit counts reviews, never which ones: it applies to both paths, with no link between your account and an anonymous review.",
    "ryc.form.completed": "I took this course through to the end.",
    "ryc.form.completed.note": "Without that, there is nothing to review.",
    "ryc.form.year": "Year you took it",
    "ryc.form.hours": "Hours per week, outside the sessions",
    "ryc.form.optional": "optional",
    "ryc.form.passed": "Did you pass this course?",
    "ryc.form.passed.yes": "yes",
    "ryc.form.passed.no": "no",
    "ryc.form.passed.unsaid": "I would rather not say",
    "ryc.form.passed.note":
      "Never shown with your review. Used only for an overall indication, from five answers upward.",
    "ryc.form.body": "Your review",
    "ryc.form.body.placeholder": "How the course is taught, what helps, what is missing.",
    "ryc.form.count.short.one": "{count} character to go",
    "ryc.form.count.short.other": "{count} characters to go",
    "ryc.form.count.long.one": "{count} character too many",
    "ryc.form.count.long.other": "{count} characters too many",
    "ryc.form.count.ok": "{n} characters, out of {max} maximum",
    "ryc.form.advice": "A tip for whoever takes it next year",
    "ryc.form.missing": "Missing: {list}.",
    "ryc.form.missing.completed": "confirming that you finished the course",
    "ryc.form.missing.body": "the text of the review",
    "ryc.form.missing.long": "shortening the text ({max} characters maximum)",
    "ryc.form.abandon": "Abandon this review? The text will be lost.",
    "ryc.form.continue": "Continue",
    "ryc.form.nothing.sent": "Nothing is sent at this step.",

    "ryc.quota.done":
      "You have reached your review limit for this period. It renews: come back in a few days.",
    "ryc.quota.note":
      "We count how many reviews you post, never which ones. An anonymous review stays unlinked to your account, including for that count.",

    "ryc.draft.reread": "Reread my review",
    "ryc.draft.facts":
      "recommended {recommendation}/5 · workload {workload}/5 · difficulty {difficulty}/5 · {chars} characters",
    "ryc.draft.advice": "Tip:",

    "ryc.counts.lead": "This course has",
    "ryc.counts.and": "and",
    "ryc.counts.named.one": "{count} named review",
    "ryc.counts.named.other": "{count} named reviews",
    "ryc.counts.anon.one": "{count} anonymous review",
    "ryc.counts.anon.other": "{count} anonymous reviews",
    "ryc.counts.first": "You would be the first.",
    "ryc.counts.note":
      "The more anonymous reviews there are, the less yours stands out. Only you know how many students took this course: we do not.",

    "ryc.fork.back": "back to the form",
    "ryc.fork.title": "How do you want to publish this review?",
    "ryc.fork.lede": "This choice cannot be changed after sending. Read both before choosing.",
    "ryc.fork.named.chip": "Under my name",
    "ryc.fork.named.1": "Your name appears on the course page.",
    "ryc.fork.named.2": "People can ask you for detail, or disagree with you.",
    "ryc.fork.named.3": "You stay attached to this review, a year from now included.",
    "ryc.fork.named.cta": "Publish under my name",
    "ryc.fork.anon.chip": "Anonymous",
    "ryc.fork.anon.lead": "Permanent",
    "ryc.fork.anon.1": "No name, no faculty, no domain.",
    "ryc.fork.anon.2": "Impossible to edit or delete.",
    "ryc.fork.anon.3": "You will not be able to prove it is yours.",
    "ryc.fork.anon.cta": "Continue anonymously",
    "ryc.fork.note":
      "Editing a named review is planned and does not exist yet. It will never apply to an anonymous one: nobody, us included, can find out which is yours.",

    "ryc.confirm.back": "back to the choice",
    "ryc.confirm.title": "Last step before sending",
    "ryc.confirm.1.before": "This review will be published",
    "ryc.confirm.1.strong": "with no link at all to your account.",
    "ryc.confirm.2": "You will not be able to edit it, correct it or withdraw it.",
    "ryc.confirm.2.em": "Nor will we, at your request: we will not know which one is yours.",
    "ryc.confirm.3":
      "A moderator will be able to remove it if it causes a problem, without knowing who wrote it.",
    "ryc.confirm.sending": "sending…",
    "ryc.confirm.cta": "Publish anonymously, permanently",
    "ryc.confirm.return": "Go back",

    "ryc.sent.title": "Review sent",
    "ryc.sent.anon":
      "It goes to moderation with nothing linking it to you. This page cannot show it to you, now or later: we do not know which one is yours, and that is exactly what you chose.",
    "ryc.sent.named":
      "It goes to moderation under your name, and will appear on the course page once reviewed.",
    "ryc.sent.back": "Back to the course",

    "ryc.report.open": "Report this review",
    "ryc.report.title": "Report this review",
    "ryc.report.lede":
      "Tell us what is wrong with it. No account needed. A report is read by a person, never handled automatically.",
    "ryc.report.why": "Why",
    "ryc.report.cat.illegal": "It is unlawful",
    "ryc.report.cat.illegal.hint": "Defamation, a threat, incitement to hatred, or another offence.",
    "ryc.report.cat.thirdparty": "It identifies somebody",
    "ryc.report.cat.thirdparty.hint":
      "Names or identifies a person who did not ask to be, or gives their contact details.",
    "ryc.report.cat.abuse": "It is an attack",
    "ryc.report.cat.abuse.hint": "Insults or harassment, rather than a view on the course.",
    "ryc.report.cat.spam": "It does not belong here",
    "ryc.report.cat.spam.hint": "Advertising, repetition, or nothing to do with the course.",
    "ryc.report.cat.inaccurate": "It is wrong",
    "ryc.report.cat.inaccurate.hint": "Inaccurate facts, without falling under the above.",
    "ryc.report.cat.immediate": "This review will be hidden at once, until a person has read it.",
    "ryc.report.detail": "Explain",
    "ryc.report.detail.placeholder":
      "What is wrong, and why. The more precise, the sooner something can be done.",
    "ryc.report.detail.rule": "At least {min} characters: an explanation, not one word.",
    "ryc.report.contact": "Your email address (optional)",
    "ryc.report.contact.placeholder": "to be told what happens",
    "ryc.report.contact.hint":
      "Only to tell you what was decided. Without it we have no way to answer you.",
    "ryc.report.send": "Send the report",
    "ryc.report.sending": "sending…",
    "ryc.report.cancel": "Cancel",
    "ryc.report.close": "Close",
    "ryc.report.thanks": "Report received.",
    "ryc.report.sent.held":
      "This review is hidden until a person has read it. If there is nothing wrong with it, it comes back.",
    "ryc.report.sent.queued": "A person will read it. The review stays visible meanwhile.",
    "ryc.report.nodeadline":
      "We promise no deadline until we have measured one. Anything reported as unlawful, or as naming somebody, is hidden first.",
    "ryc.report.failed": "Sending failed. Try again.",
  },
};
