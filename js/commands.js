// js/commands.js — single declarative command registry (WAVE 6).
//
// Every terminal command is declared exactly once in COMMAND_REGISTRY with
// { name, aliases, aliasOf, plain, category, argsSpec, examples, helpDisplay,
// helpDesc, helpPos, extraHelpRows, listed, allow, bareOnly, aiQueue, run }.
// shell.js (COMMANDS, help text, suggestions, dispatcher), terminal.js (tab
// completion), ai.js (tool allowlist) and foreground.js (ai queue routing)
// all derive from this registry: there are no parallel command lists left.
// Handler bodies were moved verbatim from the old shell.js switch; only
// `break;` became `return;` (identical control effect inside a run function)
// and the three ai.js calls go through one dynamic import (no static
// commands<->ai cycle). `man <command>` renders any entry.
//
// Golden-pin notes (do not "fix" without regenerating goldens): helpText
// prints only entries with helpDisplay (34 rows) under an Available
// commands (36) header; `man`, `llm` and `guestbook` are executable but
// unlisted on purpose so the count and rows stay byte-identical.
// WAVE 9a: `wall` and `guestbook` both carry plain/examples/argsSpec (alias
// drift closed); neither change affects the help rows or the counts above.
// WAVE 12: `background` (off|static|ambient|expressive) is unlisted with null
// helpDisplay/helpPos; PR3 `imgcat` is unlisted the same way (inline images
// need a browser plus a CDN-fetched addon). PR4: `sparkline` is unlisted the
// same way (null helpDisplay/helpPos); its chart module lazy-imports on first
// run. Playground: `pg <demo>` (first
// demo: `pg life`, lazy-imported pg-life.js) is likewise unlisted with null
// helpDisplay/helpPos. The 36/34 golden pins hold. `ring` (Aggie Ring easter
// egg) is unlisted the same way; the post is still a draft so its link line
// notes "publishing soon".

import { ASCII_ART } from './ascii-art.js';

import { isAbortError } from './foreground.js';
import { sanitizeTerminalText, renderMarkdown } from './markdown.js';
import { combinedTimeoutSignal, SEARCH_TIMEOUT_MILLIS } from './fetch-timeout.js';

const pageLoadTime = Date.now();

const ANSI_RESET = '\x1b[0m';
const ANSI_BOLD = '\x1b[1m';
function ansiRGB(redChan, greenChan, blueChan) { return `\x1b[38;2;${redChan};${greenChan};${blueChan}m`; }
function ansiBgRGB(redChan, greenChan, blueChan) { return `\x1b[48;2;${redChan};${greenChan};${blueChan}m`; }
const SITE_BLUE = ansiRGB(80, 140, 250);
const SITE_RED = ansiRGB(220, 80, 100);
const SITE_GREEN = ansiRGB(60, 200, 120);
const SITE_CYAN = ansiRGB(60, 190, 220);
const SITE_WHITE = ansiRGB(220, 220, 230);
const SITE_MUTED = ansiRGB(140, 140, 155);
const SITE_FAINT = ansiRGB(100, 100, 115);
const SITE_OK = ansiRGB(60, 200, 120);
const SITE_ERR = ansiRGB(220, 80, 100);
const SITE_LABEL = ansiRGB(80, 140, 250);

// Dynamic terminal host identity: the shell resolves the visitor's
// geolocation city slug (never the raw visitor IP) and publishes it here.
// Every host-named surface (prompt, neofetch header, hostname, uname) reads
// the getter at render time, so snapshots (network-blocked) deterministically
// keep the dvxb.io fallback while live sessions show db@<city-slug>.
const TERMINAL_HOST_FALLBACK = 'dvxb.io';
let terminalHost = TERMINAL_HOST_FALLBACK;
function getTerminalHost() { return terminalHost; }
function setTerminalHost(nextHost) {
  if (typeof nextHost !== 'string') return;
  const trimmedHost = nextHost.trim();
  if (trimmedHost.length === 0) return;
  // Fail closed on anything a city slug could never be: inner whitespace
  // (a raw "New York") or placeholder literals ("null"/"undefined") that
  // would otherwise paint verbatim into the prompt, title and neofetch.
  if (/\s/u.test(trimmedHost)) return;
  const loweredHost = trimmedHost.toLowerCase();
  if (loweredHost === 'null' || loweredHost === 'undefined' || loweredHost === 'none') return;
  terminalHost = trimmedHost;
}

// WAVE 13 shared boot script: the static establishing-shot lines. Each entry
// carries { text, fill } where fill reuses the palette constants above. The
// live boot path (js/shell.js bootSequence) consumes this constant, so the
// xterm transcript reads the single source of truth. Dynamic
// lines (CPU/GPU/clock/memory) stay in shell.js; this list is static text.
const BOOT_SCRIPT = [
  { text: '[  OK  ] Started auditd.service', fill: SITE_OK },
  { text: '[  OK  ] Mounted /research', fill: SITE_OK },
  { text: '[  OK  ] Started decipher-psma@MDA.service', fill: SITE_OK },
  { text: '[  OK  ] Started physics-gnn@DIVE.TAMU.service', fill: SITE_OK },
  { text: '[  OK  ] Started sok-water@AGGIES.TAMU.service', fill: SITE_OK },
  { text: '[  OK  ] Started build-agent@LM.service', fill: SITE_OK },
  { text: '[  OK  ] Reached target cs-student.target', fill: SITE_OK },
  { text: '[  OK  ] Started Builder.service', fill: SITE_OK },
  { text: '[  OK  ] Reached target Builder.target', fill: SITE_OK },
];


function colorBlock(redChan, greenChan, blueChan) {
  return `${ansiBgRGB(redChan, greenChan, blueChan)} ${ANSI_RESET}`;
}

const vfs = new Map([
  ['/home/db/about.txt', `Hi, I'm Devkumar! I am a student at Texas A&M University pursuing a B.S. in Computer Science (2029). My journey into computing began when I built my first PC in 5th grade. That experience opened my eyes to the incredible power of technology in unlocking creative potential and crafting something truly unique.

Today, I research cancer radiology @ MD Anderson, graph neural networks @ DIVE Lab, and security @ AGGIES Lab, while working as an SRE intern @ Lockheed Martin. I've previously contributed to nanomedicine ML research @ Houston Methodist and built transcriptomics platforms @ UTHSCSA.

If you'd like to connect, collaborate, or discuss exciting projects, please do not hesitate to reach out!`],
  ['/home/db/links/', `linkedin
github
keybase
resume.pdf`],
  ['/home/db/resume.md', `# Devkumar Banerjee

B.S. Computer Science, Texas A&M (2029) — \`db@dvxb.io\`

*Student, researcher, builder — College Station, TX*

- [GitHub](https://github.com/aptitudepi)
- [LinkedIn](https://linkedin.com/in/dvkb)
- Mail: \`dkb@tamu.edu\`

## Research

- Cancer radiology @ **MD Anderson**
- Graph neural networks @ **DIVE Lab**
- Security @ **AGGIES Lab**
- Nanomedicine ML @ **Houston Methodist**
- Transcriptomics platforms @ **UTHSCSA**

## Work

1. AI/SRE Intern @ **Lockheed Martin**
2. SF Dev @ **The Association of Former Students**

## Skills

| Domain | Tools |
| --- | --- |
| Languages | Python, C/C++, Java, JavaScript, SQL, Bash, YAML, HTML/CSS, R |
| Frameworks | PyTorch, TensorFlow, scikit-learn, Flask, Streamlit, Node.js, RESTful APIs |
| Systems | Linux, Docker, Podman, Ansible, AWS GovCloud, Git, GitLab CI/CD, GitHub Actions |

## Certs

GSEC · GFACT · AZ-900 · SC-900 · Linux Pro · CCST · ITF+ · RVFA

---

## Try it live

\`\`\`sh
ai what did Devkumar research?
projects --json
\`\`\``],
]);

const RESUME = {
  Firstname: 'Devkumar',
  Lastname: 'Banerjee',
  Education: 'BS Computer Science, Texas A&M (2029)',
  Research: ['MD Anderson (Cancer Radiology)', 'DIVE Lab (GNN — Materials)', 'AGGIES Lab (Security)', 'Houston Methodist (Nanomedicine)', 'UTHSCSA (PCPG Transcriptomics)'],
  Work: ['AI/SRE Intern @ Lockheed Martin', 'SF Dev @ The Association of Former Students'],
  Skills: ['Python', 'PyTorch', 'C', 'C++', 'Java', 'Linux', 'Docker', 'Ansible', 'Keras', 'Streamlit'],
  Certs: ['GSEC', 'GFACT', 'AZ-900', 'SC-900', 'Linux Pro', 'CCST', 'ITF+', 'RVFA'],
  User: 'db',
};

// Portfolio project cards (WAVE 8). Descriptions, tags and repo URLs repeat
// the site project section verbatim — no invented facts. Roles/outcomes
// paraphrase the resume page and about copy only.
const PORTFOLIO_PROJECTS = [
  {
    key: 'aggiemap',
    name: 'TheAggieMap',
    tags: ['Next.js', 'FastAPI', 'TypeScript'],
    description: 'Monorepo with a Next.js 14 frontend and FastAPI backend serving as Aggieland\'s interactive campus map. Built for HowdyHack 2025.',
    repo: 'https://github.com/aptitudepi/TheAggieMap',
    role: 'Led full-stack integration across the FastAPI backend and Next.js frontend; deployed both services with systemd.',
    outcome: 'Best Aggie Hack — HowdyHack 2025.',
  },
  {
    key: 'pcpg',
    name: 'PCPG Analyzer',
    tags: ['Python', 'Streamlit', 'Pandas'],
    description: 'Web-based framework for dynamic analysis and visualization of Pheochromocytoma & Paraganglioma transcriptome data to support cancer researchers worldwide.',
    repo: 'https://github.com/aptitudepi/pcpg-analyzer',
    role: 'Author — built alongside UTHSCSA transcriptomics work.',
    outcome: 'Supports cancer researchers worldwide with dynamic transcriptome analysis.',
  },
  {
    key: 'tidal',
    name: 'Doctor-Robot (TIDALHack)',
    tags: ['Groq', 'XGBoost', 'Streamlit'],
    description: 'Maps natural-language symptom descriptions to structured medical data and classifies into 40+ diseases using an XGBoost classifier with Groq-hosted LLMs.',
    repo: 'https://github.com/aptitudepi/TIDALHack',
    role: 'Author — symptom-mapping pipeline plus XGBoost classifier.',
    outcome: 'Classifies 40+ diseases from natural-language symptoms.',
  },
  {
    key: 'neural',
    name: 'Neural-Networks-From-Scratch',
    tags: ['Python', 'NumPy', 'Deep Learning'],
    description: 'Implementations of neural network architectures built from scratch using only NumPy, demonstrating a deep understanding of fundamental ML concepts and backpropagation.',
    repo: 'https://github.com/aptitudepi/Neural-Networks-From-Scratch',
    role: 'Author — every architecture from scratch in NumPy.',
    outcome: 'Working backpropagation without frameworks.',
  },
];

// Career timeline (WAVE 8). Every row restates the resume page / about copy.
const TIMELINE_ENTRIES = [
  { date: 'May 2026 – Present', title: 'AI Systems / SRE Intern', org: 'Lockheed Martin' },
  { date: 'Jun 2026 – Present', title: 'Data Research Intern', org: 'UT MD Anderson' },
  { date: 'Jan 2026 – Present', title: 'Undergraduate Researcher', org: 'DIVE Lab' },
  { date: 'May 2025 – Present', title: 'Undergraduate Researcher', org: 'AGGIES Lab' },
  { date: 'Aug 2025 – May 2029', title: 'B.S. Computer Science', org: 'Texas A&M' },
  { date: 'May – Aug 2025', title: 'SRE Intern', org: 'Lockheed Martin' },
  { date: 'Earlier', title: 'Nanomedicine ML research', org: 'Houston Methodist' },
  { date: 'Earlier', title: 'Transcriptomics platforms', org: 'UTHSCSA' },
];

// Last foreground command output (WAVE 8 export story). The shell dispatcher
// records every command's forwarded stream here; `export` saves it.
let lastCommandOutput = '';

function recordCommandOutput(outputText) {
  lastCommandOutput = String(outputText ?? '');
}

function readLastCommandOutput() {
  return lastCommandOutput;
}

const FORTUNES = [
  'Technology is anything that wasn\'t around when you were born — Alan Kay',
  'Any sufficiently advanced technology is equivalent to magic — Arthur C. Clarke',
  'All of the biggest technological inventions created by man - the airplane, the automobile, the computer - says little about his intelligence, but speaks volumes about his laziness — Mark Kennedy',
  'Just because something doesn\'t do what you planned it to do doesn\'t mean it\'s useless — Thomas Edison',
  'It has become appallingly obvious that our technology has exceeded our humanity — Albert Einstein',
  'One machine can do the work of fifty ordinary men.  No machine can do the work of one extraordinary man — Elbert Hubbard',
  'Technology is a word that describes something that doesn\'t work yet — Douglas Adams',
  'Humanity is acquiring all the right technology for all the wrong reasons — R. Buckminster Fuller',
  'I think that novels that leave out technology misrepresent life as badly as Victorians misrepresented life by leaving out sex — Kurt Vonnegut',
  'The human spirit must prevail over technology — Albert Einstein',
  'The great myth of our times is that technology is communication — Libby Larsen',
  'You cannot endow even the best machine with initiative; the jolliest steamroller will not plant flowers — Walter Lippmann',
  'We are stuck with technology when what we really want is just stuff that works — Douglas Adams',
  'Technology made large populations possible; large populations now make technology indispensable — Joseph Krutch',
  'This is the whole point of technology.  It creates an appetite for immortality on the one hand.  It threatens universal extinction on the other. Technology is lust removed from nature — Don DeLillo',
  'The real danger is not that computers will begin to think like men, but that men will begin to think like computers — Sydney Harris',
  'If we continue to develop our technology without wisdom or prudence, our servant may prove to be our executioner — Omar Bradley',
  'The art challenges the technology, and the technology inspires the art — John Lasseter',
  'Science and technology revolutionize our lives, but memory, tradition and myth frame our response — Arthur Schlesinger',
  'The science of today is the technology of tomorrow — Edward Teller',
  'Imagination is the Discovering Faculty, pre-eminently. It is that which penetrates into the unseen worlds around us, the worlds of Science — Ada Lovelace',
  'Software is like sex: It\'s better when it\'s free — Linus Torvalds',
  'Good programmers use their brains, but good guidelines save us having to think out every case — Francis Glassborow',
  'First learn computer science and all the theory.  Next develop a programming style.  Then forget all that and just hack — George Carrette',
  'There are two ways to write error-free programs; only the third one works — Alan J. Perlis',
  'That\'s been one of my mantras — focus and simplicity. Simple can be harder than complex; you have to work hard to get your thinking clean to make it simple — Steve Jobs',
  'The function of good software is to make the complex appear to be simple — Grady Booch',
  'I do not fear computers. I fear lack of them — Isaac Asimov',
  'Standards are always out of date.  That\'s what makes them standards — Alan Bennett',
  'To iterate is human, to recurse divine — L. Peter Deutsch',
  'Computers are good at following instructions, but not at reading your mind — Donald Knuth',
  'Never underestimate the bandwidth of a station wagon full of tapes hurtling down the highway — Andrew S. Tanenbaum',
  'Errors using inadequate data are much less than those using no data at all — Charles Babbage',
  'Technology is just a tool. In terms of getting the kids working together and motivating them, the teacher is the most important — Bill Gates',
  'Programs must be written for people to read, and only incidentally for machines to execute — Gerald Jay Sussman',
  'Code generation, like drinking alcohol, is good in moderation — Alex Lowe',
  'Never trust a computer you can\'t throw out a window — Steve Wozniak',
  'The best way to predict the future is to implement it — David Heinemeier Hansson',
  'UNIX is simple.  It just takes a genius to understand its simplicity — Dennis Ritchie',
  'Should array indices start at 0 or 1?  My compromise of 0.5 was rejected without, I thought, proper consideration — Stan Kelly-Bootle',
  'I think computer viruses should count as life.  I think it says something about human nature that the only form of life we have created so far is purely destructive.  We\'ve created life in our own image — Stephen Hawking',
  'It would appear that we have reached the limits of what it is possible to achieve with computer technology, although one should be careful with such statements, as they tend to sound pretty silly in 5 years — John Von Neumann',
  'Companies spend millions of dollars on firewalls, encryption and secure access devices, and it\'s money wasted, because none of these measures address the weakest link in the security chain — Kevin Mitnick',
  'A computer would deserve to be called intelligent if it could deceive a human into believing that it was human — Alan Turing',
  'Technology feeds on itself. Technology makes more technology possible — Alvin Toffler',
  'To err is human, but to really foul things up you need a computer — Paul Ehrlich',
  'The difference between theory and practice is that in theory, there is no difference between theory and practice — Richard Moore',
  'Computers are useless.  They can only give you answers — Pablo Picasso',
  'Computers are like Old Testament gods; lots of rules and no mercy — Joseph Campbell',
  'In C++ it\'s harder to shoot yourself in the foot, but when you do, you blow off your whole leg — Bjarne Stroustrup',
  'It\'s still magic even if you know how it\'s done — Terry Pratchett',
  'The use of COBOL cripples the mind; its teaching should therefore be regarded as a criminal offense — E.W. Dijkstra',
  'It\'s supposed to be automatic, but actually you have to push this button — John Brunner',
  'Technology is best when it brings people together — Matt Mullenweg',
  'The Web as I envisaged it, we have not seen it yet. The future is still so much bigger than the past — Tim Berners-Lee',
  'It\'s not a faith in technology. It\'s faith in people — Steve Jobs',
  'Technology is a useful servant but a dangerous master — Christian Lous Lange',
  'Programming is the art of algorithm design and the craft of debugging errant code — Ellen Ullman',
  'If we want users to like our software, we should design it to behave like a likable person — Alan Cooper',
  'Everybody should learn to program a computer because it teaches you how to think — Steve Jobs',
  'Software and cathedrals are much the same — first we build them, then we pray — Sam Redwine',
  'Most good programmers do programming not because they expect to get paid or get adulation by the public, but because it is fun to program — Linus Torvalds',
  'You might not think that programmers are artists, but programming is an extremely creative profession. It’s logic-based creativity — John Romero',
  'Programming is learned by writing programs — Brian Kernighan',
  'The most important property of a program is whether it accomplishes the intention of its user — C.A.R. Hoare',
  'The best error message is the one that never shows up — Thomas Fuchs',
  'There is always one more bug to fix — Ellen Ullman',
  'Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday\'s code — Dan Salomon',
  'If, at first, you do not succeed, call it version 1.0 — Khayri R.R. Woulfe',
  'The best performance improvement is the transition from the nonworking state to the working state — J. Osterhout',
  'The most important single aspect of software development is to be clear about what you are trying to build — Bjarne Stroustrup',
  'Perfection is achieved not when there is nothing more to add, but rather when there is nothing more to take away. — Antoine de Saint-Exupery',
  'When to use iterative development? You should use iterative development only on projects that you want to succeed — Martin Fowler',
  'The best way to predict the future is to invent it — Alan Kay',
  'The most disastrous thing that you can ever learn is your first programming language — Alan Kay',
  'Make it work, make it right, make it fast — Kent Beck',
  'Java is to JavaScript what car is to Carpet — Chris Heilmann',
  'Experience is the name everyone gives to their mistakes — Oscar Wilde',
  'First, solve the problem. Then, write the code — John Johnson',
  'Optimism is an occupational hazard of programming: feedback is the treatment — Kent Beck',
  'Simple things should be simple, complex things should be POSSIBLE — Alan Kay',
  'Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live. — Martin Golding',
  'Programming is not about typing, it\'s about thinking — Rich Hickey',
  'Any fool can write code that a computer can understand. Good programmers write code that humans can understand — Martin Fowler',
  'Talk is cheap. Show me the code — Linus Torvalds',
  'The computer was born to solve problems that did not exist before — Bill Gates',
  'The amateur software engineer is always in search of magic — Grady Booch',
  'The best designers will use many design patterns that dovetail and intertwine to produce a greater whole — Erich Gamma',
  'If it\'s not tested, it\'s broken — Bruce Eckel',
  'Give users what they actually want, not what they say they want — Kathy Sierra',
  'Debugging is like being the detective in a crime movie where you are also the murderer — Filipe Fortes',
  'Computing is kind of a mess. Your computer doesn\'t know where you are. It doesn\'t know what you\'re doing. It doesn\'t know what you know — Larry Page',
  'JavaScript is the world\'s most misunderstood programming language — Douglas Crockford',
  'The cleaner and nicer the program, the faster it\'s going to run. And if it doesn\'t, it\'ll be easy to make it fast — Joshua Bloch',
  'Often, the most striking and innovative solutions come from realizing that your concept of the problem was wrong — Eric S. Raymond',
  'It is often easier to ask for forgiveness than to ask for permission — Grace Hopper',
  'You can divide our industry into two kinds of people: those who want to go work for a company to make it successful, and those who want to go work for a successful company — Jamie Zawinski',
  'A language that doesn\'t affect the way you think about programming is not worth knowing — Alan Perlis',
  'In the practical world of computing, it is rather uncommon that a program, once it performs correctly and satisfactorily, remains unchanged forever — Niklaus Wirth',
  'Much of my work has come from being lazy — John Backus',
  'For much of the Internet, the shortest path between two points doesn\'t exist — Kevin Poulsen',
  'Creativity comes from applying things you learn in other fields to the field you work in — Aaron Swartz',
  'In JavaScript, there is a beautiful, elegant, highly expressive language that is buried under a steaming pile of good intentions and blunders — Douglas Crockford',
  'This is why I loved technology: if you used it right, it could give you power and privacy — Cory Doctorow',
  'Fools ignore complexity. Pragmatists suffer it. Some can avoid it. Geniuses remove it. — Alan Perlis',
  'If you can\'t understand the spec for a new technology, don\'t worry: nobody else will understand it either, and the technology won\'t be that important — Joel Spolsky',
  'Just because something is a standard doesn\'t mean it is the right choice for every application. Like XML, for example — Douglas Crockford',
  'To solve an interesting problem, start by finding a problem that is interesting to you — Eric S. Raymond',
  'If you\'re not doing some things that are crazy, then you\'re doing the wrong things — Larry Page',
  'We have to stop optimizing for programmers and start optimizing for users — Jeff Atwood',
  'Prolific programmers contribute to certain disaster — Niklaus Wirth',
  'Any application that can be written in JavaScript, will eventually be written in JavaScript — Jeff Atwood',
  'Software is getting slower more rapidly than hardware becomes faster — Niklaus Wirth',
  'Unix was not designed to stop you from doing stupid things, because that would also stop you from doing clever things — Douglas Gwyn',
  'The most damaging phrase in the language is: "It\'s always been done that way" — Grace Hopper',
  'Peers can be the best teachers, because they\'re the ones that remember what it\'s like to not understand — Peter Norvig',
  'From then on, when anything went wrong with a computer, we said it had bugs in it — Grace Hopper',
  'Many people tend to look at programming styles and languages like religions: if you belong to one, you cannot belong to others. But this analogy is another fallacy — Niklaus Wirth',
  'It is hard to write even the smallest piece of code correctly — Joshua Bloch',
  'It isn\'t enough to think outside the box. Thinking is passive. Get used to acting outside the box — Tim Ferriss',
  'Once you get to naming your laptop, you know that you\'re really having a deep relationship with it — Cory Doctorow',
  'Common programmer thought pattern: there are only three numbers: 0, 1, and n — Joel Spolsky',
  'There\'s a good part of Computer Science that\'s like magic. Unfortunately there\'s a bad part of Computer Science that\'s like religion — Hal Abelson',
  'Smart data structures and dumb code works a lot better than the other way around — Eric S. Raymond',
  'No computer is ever going to ask a new, reasonable question. It takes trained people to do that — Grace Hopper',
  'Start out by making 100 users really happy, rather than a lot more users only a little happy — Paul Buchheit',
  'What is the most important thing you could be working on in the world right now? ... And if you\'re not working on that, why aren\'t you? — Aaron Swartz',
  'Teaching peers is one of the best ways to develop mastery — Jeff Atwood',
  'No one should do a job he can do in his sleep — Cory Doctorow',
  'Nobody is going to pour truth into your brain. It\'s something you have to find out for yourself — Noam Chomsky',
  'The computer revolution is a revolution in the way we think and in the way we express what we think — Hal Abelson',
  'When you choose a language, you\'re choosing more than a set of technical trade-offs, you\'re choosing a community — Joshua Bloch',
  'JavaScript is the only language that I\'m aware of that people feel they don\'t need to learn before they start using it — Douglas Crockford',
  'Almost everyone who has had an idea that\'s somewhat revolutionary or wildly successful was first told they\'re insane — Larry Page',
  'One can steal ideas, but no one can steal execution or passion — Tim Ferriss',
  'If everything you do works, then you\'re not taking many risks and probably aren\'t innovating either — Paul Buchheit',
  'It turns out the Internet is this amazing resource for everyone who has access to it — Alexis Ohanian',
  'Being a young programmer today must be awful—you can choose 20 different programming languages, dozens of framework and operating systemsand you\'re paralyzed by choice — Joe Armstrong',
  'In some ways, programming is like painting. You start with a blank canvas and certain basic raw materials. You use a combination of science, art, and craft to determine what to do with them — Andrew Hunt',
  'Testing leads to failure, and failure leads to understanding — Burt Rutan',
  'Programming isn\'t about what you know; it\'s about what you can figure out — Chris Pine',
  'If you optimize everything, you will always be unhappy — Donald Knuth',
  'If debugging is the process of removing bugs, then programming must be the process of putting them in — E.W. Dijkstra',
  'Coding isn\'t the poor handmaiden of design or analysis. Coding is where your fuzzy ideas awaken in the harsh dawn of reality — Kent Beck',
  'Inside every well-written large program is a well-written small program — C.A.R. Hoare',
  'So much complexity in software comes from trying to make one thing do two things — Ryan Singer',
  'Code is like humor. When you have to explain it, it\'s bad — Cory House',
  'The more I study, the more insatiable do I feel my genius for it to be — Ada Lovelace',
  'There are only two hard things in Computer Science: cache invalidation and naming things — Phil Karlton',
  'All programming languages are shit. But the good ones fertilize your mind — Reginald Braithwaite',
  'The question of whether Machines Can Think... is about as relevant as the question of whether Submarines Can Swim — E.W. Dijkstra',
  'Computer science education cannot make anybody an expert programmer any more than studying brushes and pigment can make somebody an expert painter — Eric S. Raymond',
  'Programming languages, like pizza, come in only two sizes: too big and too small — Eric S. Raymond',
  'Computer Science is no more about computers than astronomy is about telescopes — Richard E. Pattis',
  'Languages that try to disallow idiocy become themselves idiotic — Rob Pike',
  'Perl: The only language that looks the same before and after RSA encryption — Keith Bostic',
  'Not everything I say is correct. It\'s correct modulo the little details you\'re going to have to worry about — John Hopcroft',
  'There is nothing in the programming field more despicable than an undocumented program — Edward Yourdon',
  'Beware of bugs in the above code; I have only proved it correct, not tried it — Donald Knuth',
  'Good programmers don\'t just write programs. They build a working vocabulary — Guy Steele',
  'In carpentry, you measure twice and cut once. In software development, you never measure and make cuts until you run out of time — Adam Morse',
  'Hofstadter\'s Law: It always takes longer than you expect, even when you take into account Hofstadter\'s Law — Douglas Hofstadter',
  'What we have to learn to do, we learn by doing — Aristotle',
  'One day, you\'ll turn off the feature that emails you every time someone buys your software. That\'s a huge milestone — Joel Spolsky',
  'Somebody finds the problem, and somebody else understands it. And I\'ll go on record as saying that finding it is the bigger challenge — Linus Torvalds',
  'Within a computer natural language is unnatural — Alan Perlis',
  'I love deadlines. I like the whooshing sound they make as they fly by — Douglas Adams',
  'When I am working on a problem, I never think about beauty. I think only of how to solve the problem. But when I have finished, if the solution is not beautiful, I know it is wrong — R. Buckminster Fuller',
  'Design and programming are human activities; forget that and all is lost — Bjarne Stroustrup',
  'Most of the biggest problems in software are problems of misconception — Rich Hickey',
  'After more than 30 years of programming, we ought to know that the design of complex software is inherently difficult — Niklaus Wirth',
  'If we wish to count lines of code, we should not regard them as "lines produced" but as "lines spent" — E.W. Dijkstra',
  'Working ten hour days allows you to fall behind twice as fast as you could working five hour days — Isaac Asimov',
  'Measuring programming progress by lines of code is like measuring aircraft building progress by weight — Bill Gates',
  'The designer of a new kind of system must participate fully in the implementation — Donald Knuth',
  'The only way to learn a new programming language is by writing programs in it — Dennis Ritchie',
  'Anyone who considers arithmetical methods of producing random digits is, of course, in a state of sin — John Von Neumann',
  'We shall do a much better programming job, provided we approach the task with a full appreciation of its tremendous difficulty, provided that we respect the intrinsic limitations of the human mind and approach the task as very humble programmers — Alan Turing',
  'Learn the principle, abide by the principle, and dissolve the principle — Bruce Lee',
  'Remember, to learn and not to do is really not to learn. To know and not to do is really not to know — Stephen Covey',
  'Technology like art is a soaring exercise of the human imagination — Daniel Bell',
  'Let\'s go invent tomorrow instead of worrying about what happened yesterday — Steve Jobs',
  'The great growling engine of change - technology — Alvin Toffler',
  'Innovation is the outcome of a habit, not a random act — Sukant Ratnakar',
  'The technology you use impresses no one. The experience you create with it is everything — Sean Gerety',
  'It\'s not that we use technology, we live technology — Godfrey Reggio',
  'The real problem is not whether machines think but whether men do. — B.F. Skinner',
  'Fight Features … The only way to make software secure, reliable, and fast is to make it small — Andrew S. Tanenbaum',
  'The nice thing about standards is that you have so many to choose from — Andrew S. Tanenbaum',
  'Half of the battle of building performant software is caring enough to look — AJ Stuyvenberg',
  'The thing is, you can\'t fake drive. If you try to, you can easily burnout — Sophia Turner',
  'Computer Science is no more about computers than astronomy is about telescopes — E.W. Dijkstra',
  'Progress is man\'s ability to complicate simplicity — Thor Heyerdahl',
  'Don\'t shoot a fly with a cannon — Paolo Insogna',
  'The essential part of any program, the theory of it, is something that could not conceivably be expressed, but is inextricably bound to human beings. — Peter Naur',
  'The most powerful tool we have as developers is automation — Scott Hanselman',
  'The only way to go fast, is to go well — Robert C. Martin',
  'Controlling complexity is the essence of computer programming — Brian Kernighan',
  'If you can\'t deploy your service, it\'s not done — Jez Humble',
  'One of my most productive days was throwing away 1000 lines of code — Ken Thompson',
  'Data trumps intuition — Peter Norvig',
  'Choose boring technology — Dan McKinley',
  'Shipping first-time code is like going into debt. A little debt speeds development so long as it is paid back promptly with refactoring — Ward Cunningham',
  'Design is not just what it looks like and feels like. Design is how it works — Steve Jobs',
  'A little duplication is better than a little dependency — John Ousterhout',
  'The purpose of computing is insight, not numbers — Richard Hamming',
  'Any organization that designs a system will produce a design whose structure is a copy of the organization\'s communication structure — Melvin Conway',
  'Adding manpower to a late software project makes it later — Frederick P. Brooks Jr.',
  'The future is uncertain and you will never know less than you know right now — Sandi Metz',
  'The problem with poorly designed small applications is that if they are successful, they grow up to be poorly designed big applications — Sandi Metz',
  'The first way design fails is due to lack of it — Sandi Metz'
];

const CMD_HISTORY = [];
CMD_HISTORY.idx = -1;

let _hnItems = [];
let _prefetchedLocation = null;

function setPrefetchedLocation(locationValue) {
  _prefetchedLocation = locationValue;
}

// Server-derived city for the terminal identity fallback chain: the ipapi.co
// prefetch (fired at shell boot) carries a geo-IP city. Returns the raw city
// string or null when the prefetch has not landed yet. Never throws.
function getPrefetchedCity() {
  try {
    const prefetchedValue = _prefetchedLocation;
    if (prefetchedValue === null || typeof prefetchedValue !== 'object') return null;
    const cityValue = prefetchedValue.city;
    if (typeof cityValue !== 'string') return null;
    const trimmedCity = cityValue.trim();
    return trimmedCity.length > 0 ? trimmedCity : null;
  } catch (prefetchError) {
    console.warn(`prefetched city read skipped: ${prefetchError.message}`);
    return null;
  }
}

function levenshtein(firstString, secondString) {
  const lenA = firstString.length, lenB = secondString.length;
  const distanceMatrix = Array.from({ length: lenA + 1 }, () => Array(lenB + 1).fill(0));
  for (let row = 0; row <= lenA; row++) distanceMatrix[row][0] = row;
  for (let col = 0; col <= lenB; col++) distanceMatrix[0][col] = col;
  for (let row = 1; row <= lenA; row++) {
    for (let col = 1; col <= lenB; col++) {
      distanceMatrix[row][col] = firstString[row - 1] === secondString[col - 1] ? distanceMatrix[row - 1][col - 1] : 1 + Math.min(distanceMatrix[row - 1][col], distanceMatrix[row][col - 1], distanceMatrix[row - 1][col - 1]);
    }
  }
  return distanceMatrix[lenA][lenB];
}

// Normalize a user-supplied VFS path: resolve relative paths against the
// home directory, collapse duplicate slashes, resolve ./ and ../ segments.
// A trailing slash is insignificant for lookup.

function normalizeVfsPath(rawPath) {
  const homeDir = '/home/db';
  const text = String(rawPath ?? '').trim();
  const rooted = text.startsWith('/') ? text : `${homeDir}/${text}`;
  const segments = rooted.split('/');
  const resolved = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return `/${resolved.join('/')}`;
}

// VFS lookup tolerates a trailing slash either way: the links entry is
// stored with one, every other entry without.

function lookupVfsPath(rawPath) {
  const normalized = normalizeVfsPath(rawPath);
  const direct = vfs.get(normalized);
  if (direct !== undefined) return direct;
  return vfs.get(`${normalized}/`);
}

// Directory model for ls/cat (GNU-flavored):
//   • `/home/db/links/` is a stored directory blob (shortcut names).
//   • `/home/db` itself is virtual: its listing derives from the vfs keys.
//   • `ls <file>` prints the basename (like GNU ls on a file operand).
//   • `cat` only reads files; any directory operand errors "Is a directory".
//   • `links/<name>` entries are shortcut names with no stored content, so
//     `cat` on them reports "No such file or directory" (browse them with
//     `ls links`).
const VFS_HOME_DIR = '/home/db';

function isVfsDirectory(normalizedPath) {
  if (vfs.get(`${normalizedPath}/`) !== undefined) return true;
  const childPrefix = `${normalizedPath}/`;
  for (const storedKey of vfs.keys()) {
    if (storedKey.startsWith(childPrefix)) return true;
  }
  return false;
}

function listVfsDirectory(normalizedDir) {
  const storedListing = vfs.get(`${normalizedDir}/`);
  if (storedListing !== undefined) return storedListing.split('\n');
  const childPrefix = `${normalizedDir}/`;
  const childNames = [];
  for (const storedKey of vfs.keys()) {
    if (storedKey.startsWith(childPrefix) === false) continue;
    const relativePath = storedKey.slice(childPrefix.length);
    if (relativePath.length === 0) continue;
    const slashIndex = relativePath.indexOf('/');
    if (slashIndex === -1) {
      childNames.push(relativePath);
      continue;
    }
    const dirName = `${relativePath.slice(0, slashIndex)}/`;
    if (childNames.includes(dirName) === false) childNames.push(dirName);
  }
  return childNames;
}

function baseNameOfPath(normalizedPath) {
  const pathSegments = normalizedPath.split('/').filter((pathSegment) => pathSegment.length > 0);
  return pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : '/';
}

const ANSI_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function visibleLen(value) {
  return value.replace(ANSI_PATTERN, '').length;
}

function getBlueRedPhase() {
  const elapsed = (Date.now() - pageLoadTime) / 1000;
  const sineWave = Math.sin(elapsed * Math.PI / 3);
  const mix = (sineWave + 1) / 2;
  return [Math.round(mix * 255), 0, Math.round((1 - mix) * 255)];
}

// Phase-sampled info-label ink for the neofetch/about rows. Same 6s
// blue-red clock as the nav/h2 colorcycle (shared --cycle-phase delay on
// the CSS side), sampled once per render since terminal bytes are static.
// Each channel is floored at 120 so every label holds >=4.9:1 contrast on
// the near-black terminal at every point of the sweep; values keep their
// existing static colors.
function infoLabelColor() {
  const phaseChannels = getBlueRedPhase();
  const redChan = Math.max(120, phaseChannels[0]);
  const greenChan = Math.max(120, phaseChannels[1]);
  const blueChan = Math.max(120, phaseChannels[2]);
  return ansiRGB(redChan, greenChan, blueChan);
}

// The ASCII portrait duplicated the thermal column, so it is hidden by
// default (the info block, color blocks and every command still work).
// Set to `true` to restore the classic terminal portrait in neofetch/boot.

const SHOW_TERMINAL_ART = false;

const NEOFETCH_TRY_COMMANDS = ['matrix', 'vm', 'ai', 'weather', 'hn', 'md', 'wall'];

async function neofetch(term) {
  await loadBuildInfo(); // resolve the deploy epoch before first paint (else Uptime starts at 0s)
  const artHeight = ASCII_ART.length;
  const gap = 4;
  const maxArtW = Math.max(...ASCII_ART.map(visibleLen));

  // Classic neofetch colour palette (two rows of eight blocks) shares the
  // final two info rows, left-aligned at one column so both rows line up.
  const phase = getBlueRedPhase();
  const bPhase = phase.map(channel => Math.min(255, Math.round(channel * 1.3)));
  const blockColors = [
    [0,0,0],[200,50,50],[50,180,50],[180,180,50],
    phase,
    [180,50,180],[50,180,180],[200,200,200],
    [80,80,80],[255,80,80],[80,255,80],[255,255,80],
    bPhase,
    [255,80,255],[80,255,255],[255,255,255],
  ];
  const blockRow = (colors) => colors
    .map(([redChan,greenChan,blueChan]) => `${' '.repeat(2)}${colorBlock(redChan,greenChan,blueChan)}${' '.repeat(2)}`)
    .join('');
  const blocks1 = blockRow(blockColors.slice(0, 8));
  const blocks2 = blockRow(blockColors.slice(8, 16));
  // Left-align both block rows at one column: pad the shorter row so the
  // block sequences start together, a few spaces past the longer text.
  const tryText = `${ANSI_BOLD}${SITE_WHITE}Try:${ANSI_RESET} ${NEOFETCH_TRY_COMMANDS.join(' · ')}`;
  const helpHintText = `${SITE_MUTED}type${ANSI_RESET} \`${SITE_WHITE}help${ANSI_RESET}\` ${SITE_MUTED}for the full command list${ANSI_RESET}`;
  const blockCol = Math.max(visibleLen(tryText), visibleLen(helpHintText)) + 3;

  const infoLines = [
    { label: '', value: `${ANSI_BOLD}${SITE_WHITE}db@${getTerminalHost()}${ANSI_RESET}` },
    { label: '', value: `${SITE_MUTED}─────────────────────────────────────────────────────────────────────────────────────────${ANSI_RESET}` },
    { label: 'Name', value: 'Devkumar Banerjee' },
    { label: 'Education', value: 'BS CS, Texas A&M (2029)' },
    { label: 'Research', value: 'MD Anderson · DIVE Lab · AGGIES Lab · Houston Methodist · UTHSCSA' },
    { label: 'Work', value: 'AI/SRE @ Lockheed Martin · SF Dev @ The Association' },
    { label: 'Skills', value: 'Python · PyTorch · C · C++ · Java · Linux · Docker · Ansible · Keras · Streamlit' },
    { label: 'Certs', value: 'GSEC · GFACT · AZ-900 · SC-900 · Linux Pro · CCST · ITF+ · RVFA' },
    { label: 'Shell', value: 'fish 3.7' },
    { label: 'AI', value: 'Groq cloud default (local option) · cloud prompts sent via Worker proxy' },
    { label: 'Uptime', value: uptimeStr() },
    { label: '', value: `${SITE_MUTED}─────────────────────────────────────────────────────────────────────────────────────────${ANSI_RESET}` },
    { label: '', value: `${tryText}${' '.repeat(blockCol - visibleLen(tryText))}${blocks1}` },
    { label: '', value: `${helpHintText}${' '.repeat(blockCol - visibleLen(helpHintText))}${blocks2}` },
  ];

  // The info labels share one phase-sampled ink per render (see
  // infoLabelColor): same clock as the nav/h2 colorcycle, floored for
  // contrast. Values stay static-colored by design.
  const labelInk = infoLabelColor();

  // Collect rows before printing (same bytes) so the ticker below knows the
  // Uptime row index and the screen rows beneath it.
  const renderedRows = [];
  let uptimeRowIndex = -1;
  let uptimeValueColumn = 9; // visible width of 'Uptime: ' + 1
  if (SHOW_TERMINAL_ART) {
    for (let index = 0; index < Math.max(artHeight + 2, infoLines.length + 2); index++) {
      const line = ASCII_ART[index] || '';
      const coloredArt = index < artHeight ? line : ' '.repeat(maxArtW);
      const infoIdx = index - 2;
      let infoPart = '';
      if (infoIdx >= 0 && infoIdx < infoLines.length) {
        const info = infoLines[infoIdx];
        const labelPart = info.label ? `${labelInk}${info.label}${ANSI_RESET}: ` : '';
        if (info.label === 'Uptime') {
          uptimeRowIndex = renderedRows.length;
          uptimeValueColumn = visibleLen(coloredArt) + gap + visibleLen(labelPart) + 1;
        }
        infoPart = `${' '.repeat(gap)}${labelPart}${info.value}`;
      }
      renderedRows.push(coloredArt + infoPart);
    }
  } else {
    // Portrait hidden — a blank spacer separates the boot log from the banner,
    // then the compact info block follows.
    renderedRows.push('');
    renderedRows.push(`${ANSI_BOLD}${SITE_WHITE}db@${getTerminalHost()}${ANSI_RESET}`);
    for (const info of infoLines.slice(1)) {
      const labelPart = info.label ? `${labelInk}${info.label}${ANSI_RESET}: ` : '';
      if (info.label === 'Uptime') {
        uptimeRowIndex = renderedRows.length;
        uptimeValueColumn = visibleLen(labelPart) + 1;
      }
      renderedRows.push(`${labelPart}${info.value}`);
    }
  }
  for (const renderedRow of renderedRows) term.writeln(renderedRow);

  // Live Uptime: rewrite the value segment in place every 1s (save, up,
  // rewrite + clear tail, restore). Single-flight: re-render replaces it,
  // next submit stops it. Write-only terms (no cols) stay static. The
  // rows-below offset is a thunk over live term.cols (see
  // startLiveUptimeBelow): a webfont refit between arming and a tick
  // reflows wrapped rows with no container resize (no ResizeObserver, no
  // freeze), so a frozen count would address a stale row and rewrite the
  // divider tail every tick.
  const termCols = typeof term?.cols === 'number' && term.cols > 0 ? term.cols : 80;
  let uptimeScreenRows = 1;
  const belowLens = [];
  if (uptimeRowIndex >= 0) {
    // +8 headroom for value growth so a later tick never wraps the row.
    uptimeScreenRows = Math.max(1, Math.ceil((visibleLen(renderedRows[uptimeRowIndex]) + 8) / termCols));
    for (let rowIndex = uptimeRowIndex + 1; rowIndex < renderedRows.length; rowIndex += 1) {
      belowLens.push(visibleLen(renderedRows[rowIndex]));
    }
  }
  const renderEpoch = uptimeEpochMillis();
  // Per-tick offset over live cols; -1 stops the ticker when the Uptime
  // row itself no longer fits one screen row (live value length, same +8
  // headroom: 8 cells of 'Uptime: ' label plus value).
  const liveRowsBelow = () => {
    const liveCols = typeof term?.cols === 'number' && term.cols > 0 ? term.cols : 80;
    if (Math.max(1, Math.ceil((8 + uptimeStr(renderEpoch).length + 8) / liveCols)) !== 1) return -1;
    let below = 0;
    for (const rowLen of belowLens) below += Math.max(1, Math.ceil(rowLen / liveCols));
    return below;
  };
  // A wrapped Uptime row can't rewrite segment-only, so narrow screens stay static.
  if (uptimeRowIndex >= 0 && belowLens.length >= 1 && uptimeScreenRows === 1) {
    startLiveUptimeBelow(term, liveRowsBelow, () => `\x1b[${uptimeValueColumn}G${uptimeStr(renderEpoch)}`);
  } else {
    stopLiveUptime();
  }
}

async function getLocation(runSignal) {
  try {
    const pos = await new Promise((res, rej) => {
      if (!navigator.geolocation) { rej(new Error('no geo')); return; }
      navigator.geolocation.getCurrentPosition(position => res(position), () => rej(new Error('denied')), { timeout: 8000, enableHighAccuracy: false });
    });
    const geoResp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`,
      { headers: { 'User-Agent': navigator.userAgent }, signal: combinedTimeoutSignal(runSignal, 10000) }
    );
    if (!geoResp.ok) throw new Error(`geo HTTP ${geoResp.status}`);
    const geoData = await geoResp.json();
    const address = geoData.address || {};
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      city: address.city || address.town || address.village || address.county || null,
      region: address.state || null,
      country: address.country_code || null,
    };
  } catch (locationError) {
    if (isAbortError(locationError)) throw locationError;
    const ipResp = await fetch('https://ipapi.co/json/', { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!ipResp.ok) throw new Error(`ipapi HTTP ${ipResp.status}`);
    const ipData = await ipResp.json();
    return {
      lat: ipData.latitude,
      lon: ipData.longitude,
      city: ipData.city || null,
      region: ipData.region || null,
      region_code: ipData.region_code || null,
      country: ipData.country_code || null,
    };
  }
}

async function weatherCommand(term, args, runSignal) {
  const isF = args.includes('-f');
  term.writeln(`${SITE_MUTED}Fetching location...${ANSI_RESET}`);
  let loc = null;
  if (_prefetchedLocation) {
    loc = _prefetchedLocation;
  } else {
    try { loc = await getLocation(runSignal); }
    catch (locationError) {
      if (isAbortError(locationError)) throw locationError;
      term.writeln(`${SITE_ERR}Could not determine location.${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: retry \`weather\`, or check your connection and allow location access${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .       .       .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}    .   .   .   .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .  +  .  +  .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}    .   .   .   .${ANSI_RESET}`);
      term.writeln(`${SITE_FAINT}  .       .       .${ANSI_RESET}`);
      return;
    }
  }
  const lat = loc.lat.toFixed(4);
  const lon = loc.lon.toFixed(4);
  const state = loc.region_code || loc.region;
  const locStr = loc.city && state
    ? `${loc.city}, ${state} <${lat}, ${lon}>`
    : `<${lat}, ${lon}>`;

  if (args.includes('--debug')) {
    term.writeln(`${SITE_LABEL}loc:${ANSI_RESET} ${SITE_WHITE}${JSON.stringify(loc)}${ANSI_RESET}`);
    term.writeln(`${SITE_LABEL}locStr:${ANSI_RESET} ${SITE_WHITE}${locStr}${ANSI_RESET}`);
    term.writeln(`${SITE_LABEL}prefetched:${ANSI_RESET} ${SITE_WHITE}${_prefetchedLocation !== null}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Fetching raw ipapi response...${ANSI_RESET}`);
    try {
      const debugResp = await fetch('https://ipapi.co/json/', { signal: combinedTimeoutSignal(runSignal, 10000) });
      if (!debugResp.ok) throw new Error(`ipapi HTTP ${debugResp.status}`);
      const debugData = await debugResp.json();
      for (const fieldName of ['city','region','region_code','country','country_code','latitude','longitude']) {
        term.writeln(`  ${SITE_FAINT}${fieldName}:${ANSI_RESET} ${SITE_GREEN}${JSON.stringify(debugData[fieldName])}${ANSI_RESET}`);
      }
    } catch (debugError) {
      if (isAbortError(debugError)) throw debugError;
      term.writeln(`${SITE_ERR}ipapi.co error: ${debugError.message}${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: retry \`weather --debug\` or check your connection${ANSI_RESET}`);
    }
    return;
  }

  term.writeln(`${SITE_MUTED}Fetching weather for ${locStr}...${ANSI_RESET}`);
  try {
    const wResp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min&timezone=auto`, { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!wResp.ok) throw new Error(`weather HTTP ${wResp.status}`);
    const wData = await wResp.json();
    const currentWeather = wData.current_weather;
    const tempUnit = isF ? '°F' : '°C';
    const temp = isF ? (currentWeather.temperature * 9 / 5 + 32).toFixed(1) : currentWeather.temperature;
    const wmoCodes = {
      0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Moderate drizzle',
      55: 'Dense drizzle', 61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
      80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
      95: 'Thunderstorm', 96: 'Thunderstorm w/ slight hail', 99: 'Thunderstorm w/ heavy hail',
    };
    const cond = wmoCodes[currentWeather.weathercode] || `Code ${currentWeather.weathercode}`;
    const windKmh = (currentWeather.windspeed * 3.6).toFixed(1);
    const highTemp = isF ? (wData.daily.temperature_2m_max[0] * 9/5 + 32).toFixed(1) : wData.daily.temperature_2m_max[0];
    const lowTemp = isF ? (wData.daily.temperature_2m_min[0] * 9/5 + 32).toFixed(1) : wData.daily.temperature_2m_min[0];
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
    term.writeln(`${SITE_BLUE}  ${locStr}${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
    term.writeln(`${SITE_WHITE}  ${cond}   ${temp}${tempUnit}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}  H: ${highTemp}${tempUnit}  L: ${lowTemp}${tempUnit}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}  Wind: ${windKmh} km/h${ANSI_RESET}`);
    term.writeln(`${SITE_CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━${ANSI_RESET}`);
  } catch (weatherError) {
    if (isAbortError(weatherError)) throw weatherError;
    term.writeln(`${SITE_ERR}Failed to fetch weather data${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`weather\` or try again shortly${ANSI_RESET}`);
  }
}

function timeAgo(epoch) {
  const diff = Date.now() / 1000 - epoch;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 2592000)}mo ago`;
}

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

// Strip terminal control characters from untrusted text (guestbook posts,
// HN titles/comments, search results, model output) so remote content can't
// inject ANSI escape sequences into the viewer's xterm (display spoofing).
// Keeps \n \r \t; drops all other C0 controls (incl. ESC and BEL), DEL, and
// Unicode bidi/isolate overrides.
// Range checks (no regex literal) avoid JS-0004 control-char escapes.

function stripAnsi(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  let out = '';
  for (const char of str) {
    const codePoint = char.codePointAt(0);
    const isBad = codePoint < 0x20
      ? codePoint !== 0x0A && codePoint !== 0x0D && codePoint !== 0x09
      : codePoint === 0x7F || (codePoint >= 0x202A && codePoint <= 0x202E) || (codePoint >= 0x2066 && codePoint <= 0x2069) || codePoint === 0xFEFF;
    if (!isBad) out += char;
  }
  return out;
}

// WAVE 9a guestbook foundation: moniker display shape (no collection yet).
// Wave 9b assembles the canonical moniker server-side at POST as
// visitor-<maskedip>@<city> (IPv4 first two octets e.g. 203.0.xx.xx, IPv6
// first hextet e.g. 2001:xx, never a full IP; visitor-<maskedip>@handle or
// visitor@handle fallback when the city is unknown, never trusting a
// client-sent moniker field). Until then the existing name field is mapped
// here: a masked moniker or legacy visitor@city-slug renders as-is,
// anything else renders as visitor@<slug-of-name> (visitor@anonymous empty).
function formatWallMoniker(displayName) {
  const rawText = String(displayName ?? '').trim().toLowerCase();
  const maskedShape = /^visitor-[0-9a-z.:]{1,32}@[a-z0-9-]{1,32}$/.test(rawText);
  if (maskedShape) {
    return rawText.slice(0, 64);
  }
  if (rawText.includes('@')) {
    return rawText.slice(0, 48);
  }
  const slugChars = [];
  for (const glyph of rawText) {
    const codePoint = glyph.codePointAt(0);
    const isLowerLetter = codePoint >= 0x61 && codePoint <= 0x7A;
    const isDigitChar = codePoint >= 0x30 && codePoint <= 0x39;
    if (isLowerLetter || isDigitChar) {
      slugChars.push(glyph);
    } else if (glyph === ' ' || glyph === '_' || glyph === '-' || glyph === '.') {
      slugChars.push('-');
    }
  }
  const slugText = slugChars.join('').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  if (!slugText) {
    return 'visitor@anonymous';
  }
  return `visitor@${slugText}`;
}

function renderComment(term, item, depth) {
  if (!item || item.deleted || item.dead) return;
  const indent = '  '.repeat(depth);
  const ago = item.time ? timeAgo(item.time) : '';
  term.writeln(`${indent}${SITE_GREEN}${stripAnsi(item.by) || 'anonymous'}${ANSI_RESET} ${SITE_FAINT}${ago}${ANSI_RESET}`);
  if (item.text) {
    const text = stripAnsi(stripHtml(item.text));
    const wrap = Math.max(20, 72 - indent.length);
    const lines = text.match(new RegExp(`.{1,${wrap}}`, 'g')) || [];
    lines.forEach(line => term.writeln(`${indent}${line}`));
  }
  if (depth < 2 && item._replies && item._replies.length > 0) {
    for (const reply of item._replies) {
      renderComment(term, reply, depth + 1);
    }
  }
}

function fetchHnItem(itemId, runSignal) {
  return fetch(`https://hacker-news.firebaseio.com/v0/item/${itemId}.json`, { signal: combinedTimeoutSignal(runSignal, 10000) }).then((itemResp) => itemResp.ok ? itemResp.json() : null);
}

function renderHnStoryHeader(term, story) {
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}${stripAnsi(story.title)}${ANSI_RESET}`);
  const authorName = stripAnsi(story.by) || 'anonymous';
  const pts = story.score || 0;
  const cmts = story.descendants || 0;
  const ago = story.time ? timeAgo(story.time) : '';
  term.writeln(`${SITE_MUTED}by ${SITE_GREEN}${authorName}${SITE_MUTED} | ${pts} points | ${cmts} comments | ${ago}${ANSI_RESET}`);
  if (story.url) {
    term.writeln(`${SITE_BLUE}${stripAnsi(story.url)}${ANSI_RESET}`);
  }
  if (story.text) {
    term.writeln('');
    term.writeln(stripAnsi(stripHtml(story.text)));
  }
}

async function renderHnStoryComments(term, story, runSignal) {
  if (!story.kids || story.kids.length === 0) {
    term.writeln(`${SITE_MUTED}No comments yet${ANSI_RESET}`);
    return;
  }
  term.writeln('');
  const commentIds = story.kids.slice(0, 10);
  const comments = await Promise.all(commentIds.map((commentId) => fetchHnItem(commentId, runSignal)));
  for (const comment of comments) {
    if (comment?.kids && comment.kids.length > 0) {
      const replyIds = comment.kids.slice(0, 3);
      comment._replies = (await Promise.all(
        replyIds.map((replyId) => fetchHnItem(replyId, runSignal))
      )).filter(Boolean);
    }
  }
  for (const comment of comments) {
    renderComment(term, comment, 0);
    term.writeln('');
  }
}

async function runHnStoryCommand(term, item, runSignal) {
  term.writeln(`${SITE_MUTED}Fetching story #${item.id}...${ANSI_RESET}`);
  try {
    const storyResp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${item.id}.json`, { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!storyResp.ok) throw new Error(`story HTTP ${storyResp.status}`);
    const story = await storyResp.json();
    if (!story) throw new Error('empty');
    renderHnStoryHeader(term, story);
    await renderHnStoryComments(term, story, runSignal);
  } catch (storyError) {
    if (isAbortError(storyError)) throw storyError;
    term.writeln(`${SITE_ERR}Failed to fetch story #${item.id}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry the story, or run \`hn\` to refresh the list${ANSI_RESET}`);
  }
}

function renderHnTopList(term, items) {
  term.writeln(`${SITE_CYAN}┌────┬──────────────────────────────────────────────────┬───────┬────────┐${ANSI_RESET}`);
  term.writeln(`${SITE_CYAN}│${SITE_FAINT} #  ${SITE_CYAN}│${SITE_FAINT} Title                                            ${SITE_CYAN}│${SITE_FAINT} Score ${SITE_CYAN}│${SITE_FAINT} Comments${SITE_CYAN}│${ANSI_RESET}`);
  term.writeln(`${SITE_CYAN}├────┼──────────────────────────────────────────────────┼───────┼────────┤${ANSI_RESET}`);
  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const listItem = items[itemIndex];
    if (!listItem) continue;
    const num = String(itemIndex + 1).padStart(2);
    const title = (listItem.title || 'Untitled').slice(0, 48).padEnd(48);
    const score = String(listItem.score || 0).padStart(5);
    const comments = String(listItem.descendants || 0).padStart(6);
    term.writeln(`${SITE_CYAN}│${SITE_GREEN}${num} ${SITE_CYAN}│${SITE_WHITE} ${title} ${SITE_CYAN}│${SITE_MUTED} ${score}${SITE_CYAN}│${SITE_MUTED} ${comments}${SITE_CYAN}│${ANSI_RESET}`);
  }
  term.writeln(`${SITE_CYAN}└────┴──────────────────────────────────────────────────┴───────┴────────┘${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}Type ${SITE_WHITE}hn <number>${SITE_MUTED} to view a story${ANSI_RESET}`);
}

async function runHnTopListCommand(term, runSignal) {
  term.writeln(`${SITE_MUTED}Fetching top stories...${ANSI_RESET}`);
  try {
    const idsResp = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json', { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!idsResp.ok) throw new Error(`topstories HTTP ${idsResp.status}`);
    const ids = await idsResp.json();
    const topIds = ids.slice(0, 30);
    const items = await Promise.all(topIds.map((topId) => fetchHnItem(topId, runSignal)));
    _hnItems = items;
    renderHnTopList(term, items);
  } catch (listError) {
    if (isAbortError(listError)) throw listError;
    term.writeln(`${SITE_ERR}Failed to fetch Hacker News${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`hn\` or check your connection${ANSI_RESET}`);
  }
}

async function hnCommand(term, args, runSignal) {
  if (args.length === 0) {
    await runHnTopListCommand(term, runSignal);
    return;
  }
  const idx = parseInt(args[0], 10);
  if (isNaN(idx) || idx < 1 || idx > _hnItems.length) {
    term.writeln(`${SITE_ERR}hn: invalid index${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`hn\` to refresh the list, then \`hn <number>\`${ANSI_RESET}`);
    return;
  }
  const item = _hnItems[idx - 1];
  if (!item) {
    term.writeln(`${SITE_ERR}hn: item not found${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`hn\` to refresh the list, then \`hn <number>\`${ANSI_RESET}`);
    return;
  }
  await runHnStoryCommand(term, item, runSignal);
}

async function mdCommand(term, args, runSignal) {
  if (!args.length) { term.writeln(`${SITE_ERR}md: missing URL${ANSI_RESET}`); term.writeln(`${SITE_MUTED}Next: run \`md <url>\` with a markdown URL${ANSI_RESET}`); return; }
  let url = args[0];
  if (!url.startsWith('http://') && !url.startsWith('https://')) url = `https://${url}`;
  // Probe the URL first: reachable markdown still opens the fullscreen
  // viewer (primary path, output unchanged); a fetch failure falls back to
  // the shared inline terminal renderer with fixed strings only, so the
  // fallback stays deterministic across environments. Flag-like tokens
  // (e.g. `--help`) are not URLs: they keep the legacy viewer path so the
  // `md-help` golden stays byte-identical.
  const flagToken = String(args[0]).startsWith('-');
  let markdownSource = null;
  if (flagToken === false) {
    try {
      const fetchResp = await fetch(url, { signal: combinedTimeoutSignal(runSignal, 10000) });
      if (fetchResp.ok) markdownSource = await fetchResp.text();
    } catch (fetchError) {
      if (isAbortError(fetchError)) throw fetchError;
      markdownSource = null;
    }
  }
  if (markdownSource === null && flagToken === false) {
    const fallbackWidth = Number(term.cols) || 80;
    const fallbackDoc = `# Markdown unavailable\n\nCould not fetch ${url}.\n\nThe fullscreen viewer is the primary markdown surface; this inline render is the offline fallback.\n\n- Check the URL and retry \`md <url>\`\n- Keep the file under 5 MB for the viewer`;
    for (const fallbackLine of renderMarkdown(fallbackDoc, fallbackWidth)) {
      term.writeln(fallbackLine);
    }
    return;
  }
  term.writeln(`${SITE_MUTED}Opening ${url} in markdown viewer...${ANSI_RESET}`);
  try {
    const existing = document.getElementById('md-viewer-iframe');
    if (existing) existing.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'md-viewer-iframe';
    iframe.src = `md-viewer.html?url=${encodeURIComponent(url)}`;
    // Sandboxed (scripts allowed, same-origin denied) so a compromised or
    // malicious markdown payload can't reach the parent page. The viewer only
    // needs fetch + DOMPurify + a click/Enter toolbar (no forms/storage).
    iframe.sandbox = 'allow-scripts';
    iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:9999;border:none;background:oklch(0 0 0)';
    document.body.appendChild(iframe);
    const closeBtn = document.createElement('button');
    closeBtn.id = 'md-viewer-close';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'position:fixed;top:16px;right:16px;z-index:10000;width:36px;height:36px;border-radius:50%;border:1px solid oklch(0.3 0.02 260);background:oklch(0.1 0.01 260 / 0.8);color:oklch(0.9 0.01 260);font-size:18px;cursor:pointer;backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center';
    // Single close path (✕ button or Esc) so the keydown listener never leaks.
    function closeViewer() {
      iframe.remove();
      closeBtn.remove();
      document.removeEventListener('keydown', onEsc);
    }
    function onEsc(event) { if (event.key === 'Escape') closeViewer(); }
    closeBtn.addEventListener('click', closeViewer);
    document.body.appendChild(closeBtn);
    term.writeln(`${SITE_GREEN}md viewer opened. Press ✕ or Esc to close${ANSI_RESET}`);
    document.addEventListener('keydown', onEsc);
  } catch {
    term.writeln(`${SITE_ERR}Failed to open markdown viewer${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: check the URL and retry \`md <url>\`${ANSI_RESET}`);
  }
}

// Quote-aware command-line splitter shared by the shell dispatcher and the
// AI tool-call gate: `search "foo bar"` tokenises to ["search", "foo bar"].
function tokenizeCommandLine(lineText) {
  return String(lineText).match(/(?:[^\s"]+|"[^"]*")+/g) || [];
}

function runWhoamiCommand(term) {
  term.writeln(`${SITE_WHITE}db${ANSI_RESET}`);
  return;
}
function runHostnameCommand(term) {
  term.writeln(`${SITE_CYAN}${getTerminalHost()}${ANSI_RESET}`);
  return;
}
function runDateCommand(term) {
  term.writeln(`${SITE_WHITE}${new Date().toString()}${ANSI_RESET}`);
  return;
}
async function runUptimeCommand(term) {
  await loadBuildInfo();
  const renderEpoch = uptimeEpochMillis();
  const uptimeLine = `\r${SITE_GREEN} up ${uptimeStr(renderEpoch)}${ANSI_RESET}`;
  term.writeln(uptimeLine);
  // Live view: the shared ticker rewrites that line in place every 1s
  // (frozen by keystroke/resize/submit hooks). Static when wrapped or
  // write-only (export capture, no cols); +8 headroom.
  const termCols = typeof term?.cols === 'number' && term.cols > 0 ? term.cols : 80;
  if (Math.max(1, Math.ceil((visibleLen(uptimeLine) + 8) / termCols)) === 1) {
    startLiveUptimeBelow(term, 0, () => `\r${SITE_GREEN} up ${uptimeStr(renderEpoch)}${ANSI_RESET}`);
  }
  return;
}
// OSC-8 hyperlink wrapper for xterm output: link-aware terminals render
// `text` as a clickable link to `url`; every other terminal shows the plain
// (ANSI-colored) text fallback. Pair with the terminal `linkHandler`.
function osc8Link(url, text) {
  return `\x1b]8;;${String(url)}\x1b\\${String(text)}\x1b]8;;\x1b\\`;
}

// PR1 build metadata: CI writes build-info.json ({sha, run_number,
// built_at}) between PDF verification and sitemap generation; the terminal
// consumes it at runtime with fetch no-store. Absent (fresh clone,
// ungenerated) every consumer falls back to static text, so goldens stay
// deterministic.
let cachedBuildInfo = null;
let buildInfoPromise = null;
function loadBuildInfo() {
  if (cachedBuildInfo !== null) return Promise.resolve(cachedBuildInfo);
  if (buildInfoPromise !== null) return buildInfoPromise;
  buildInfoPromise = (async () => {
    try {
      const infoResp = await fetch('build-info.json', { cache: 'no-store' });
      if (!infoResp.ok) return null;
      const infoData = await infoResp.json();
      cachedBuildInfo = infoData !== null && typeof infoData === 'object' ? infoData : null;
    } catch {
      cachedBuildInfo = null;
    }
    return cachedBuildInfo;
  })();
  return buildInfoPromise;
}

function buildInfoLine() {
  const info = cachedBuildInfo;
  if (info === null || typeof info.sha !== 'string' || info.sha.length < 7) return null;
  const shortSha = info.sha.slice(0, 12);
  const runNumber = info.run_number === undefined || info.run_number === null ? 'unknown run' : `#${info.run_number}`;
  const builtAt = typeof info.built_at === 'string' && info.built_at.length > 0 ? info.built_at : 'unknown date';
  return { shortSha, runNumber, builtAt };
}

// Live-uptime clock shared by neofetch and `uptime`: epoch is the last
// commit (build-info.json built_at, once cached; CI writes deploy time,
// local previews generate it from git log). Missing/invalid falls back to
// the session pageLoadTime so the clock still ticks.
function uptimeEpochMillis() {
  const builtAt = cachedBuildInfo !== null && cachedBuildInfo !== undefined ? cachedBuildInfo.built_at : null;
  const builtMillis = typeof builtAt === 'string' && builtAt.length > 0 ? Date.parse(builtAt) : NaN;
  return Number.isFinite(builtMillis) ? builtMillis : pageLoadTime;
}

function uptimeStr(epochMillis) {
  const epoch = typeof epochMillis === 'number' ? epochMillis : uptimeEpochMillis();
  const totalSeconds = Math.max(0, Math.floor((Date.now() - epoch) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
}

// Single-flight live ticker: starting a region stops the previous one, so
// handoffs never leak intervals. Each tick rewrites one row segment in
// place (no new lines); synchronous writes can't interleave mid-sequence.
let liveUptimeTimerId = null;
function stopLiveUptime() {
  if (liveUptimeTimerId !== null) {
    clearInterval(liveUptimeTimerId);
    liveUptimeTimerId = null;
  }
}
// Real xterm only: write-only terms (export capture) expose no cols, so
// they print once statically instead of leaking a background tick.
function canTickLive(term) {
  return term !== null && term !== undefined && typeof term.write === 'function' && typeof term.cols === 'number';
}
function startLiveUptime(term, rowsUp, paintRow) {
  stopLiveUptime();
  if (canTickLive(term) === false) return false;
  // rowsUp is a count or a thunk re-evaluated per tick: neofetch passes a
  // thunk over live term.cols so a webfont refit (reflow, no container
  // resize, ticker still armed) between arming and a tick can't strand a
  // stale offset on the divider. A per-tick value below 1 stops the ticker
  // instead of misaddressing a row.
  const rowsUpFn = typeof rowsUp === 'function' ? rowsUp : () => rowsUp;
  const firstUp = rowsUpFn();
  if (Number.isInteger(firstUp) === false || firstUp < 1) return false;
  liveUptimeTimerId = setInterval(() => {
    try {
      const tickUp = rowsUpFn();
      if (Number.isInteger(tickUp) === false || tickUp < 1) { stopLiveUptime(); return; }
      term.write(`\x1b7\x1b[${tickUp}A${paintRow()}\x1b[K\x1b8`);
    } catch {
      stopLiveUptime();
    }
  }, 1000);
  return true;
}
// Shared by neofetch + uptime: writePrompt's blank and prompt rows land
// pre-tick, so add 2 (ticks hit the target, never the input row). A
// rowsBelow thunk is re-evaluated per tick (see startLiveUptime); a stop
// signal (-1) passes through without the +2.
function startLiveUptimeBelow(term, rowsBelow, paintRow) {
  if (typeof rowsBelow === 'function') {
    return startLiveUptime(term, () => {
      const below = rowsBelow();
      return Number.isInteger(below) && below >= 0 ? below + 2 : -1;
    }, paintRow);
  }
  return startLiveUptime(term, rowsBelow + 2, paintRow);
}

// Client-side hardware/browser probe with guarded fallbacks: Chromium
// exposes User-Agent Client Hints (getHighEntropyValues), deviceMemory and
// the unmasked WebGL renderer; Firefox/Safari hide most of it, so every
// probe fails closed to an "unknown (...)" label instead of throwing.
function readWebglRenderer() {
  try {
    if (typeof document === 'undefined') return 'unknown (no DOM)';
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl') || probeCanvas.getContext('experimental-webgl');
    if (!gl) return 'unknown (WebGL unavailable)';
    let renderer = null;
    try {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch {
      renderer = null;
    }
    try {
      const loseContext = gl.getExtension('WEBGL_lose_context');
      if (loseContext) loseContext.loseContext();
    } catch {
      // best-effort context release; ignore errors
    }
    return typeof renderer === 'string' && renderer.length > 0 ? renderer : 'unknown (masked by browser)';
  } catch {
    return 'unknown (probe failed)';
  }
}

async function runHostCommand(term) {
  const nav = typeof navigator !== 'undefined' ? navigator : null;
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Client hardware / browser${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}userAgent:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(nav?.userAgent ?? 'unknown')}${ANSI_RESET}`);
  let clientHints = 'unknown (Firefox/Safari: no User-Agent Client Hints)';
  const userAgentData = nav?.userAgentData ?? null;
  if (userAgentData) {
    try {
      const brands = Array.isArray(userAgentData.brands)
        ? userAgentData.brands.map((brand) => `${brand.brand} ${brand.version}`).join('; ')
        : '';
      const platform = typeof userAgentData.platform === 'string' ? userAgentData.platform : 'unknown platform';
      let highEntropy = '';
      try {
        const highValues = await userAgentData.getHighEntropyValues(['architecture', 'bitness', 'platformVersion', 'model']);
        const highParts = [`arch ${highValues.architecture ?? '?'}`, `${highValues.bitness ?? '?'}`, `platform ${highValues.platformVersion ?? '?'}`];
        if (highValues.model) highParts.push(`model ${highValues.model}`);
        highEntropy = ` (${highParts.join(' · ')})`;
      } catch {
        highEntropy = ' (high-entropy values unavailable)';
      }
      clientHints = `${platform}${brands ? ` — ${brands}` : ''}${highEntropy}`;
    } catch {
      clientHints = 'unknown (client-hints probe failed)';
    }
  }
  term.writeln(`  ${SITE_LABEL}clientHints:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(clientHints)}${ANSI_RESET}`);
  const coreCount = nav !== null && typeof nav.hardwareConcurrency === 'number' ? `${nav.hardwareConcurrency} logical cores` : 'unknown (unavailable in this browser)';
  term.writeln(`  ${SITE_LABEL}cpu:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(coreCount)}${ANSI_RESET}`);
  const memoryLabel = nav !== null && typeof nav.deviceMemory === 'number' ? `~${nav.deviceMemory} GB (approximate bucket)` : 'unknown (Chromium-only API)';
  term.writeln(`  ${SITE_LABEL}memory:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(memoryLabel)}${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}gpu:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(readWebglRenderer())}${ANSI_RESET}`);
  return;
}

async function runChangelogCommand(term) {
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Build changelog${ANSI_RESET}`);
  await loadBuildInfo();
  const infoLine = buildInfoLine();
  if (infoLine === null) {
    term.writeln(`  ${SITE_MUTED}no build-info.json — local preview build; CI deploys record the commit and run number here${ANSI_RESET}`);
    return;
  }
  term.writeln(`  ${SITE_LABEL}commit:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(cachedBuildInfo.sha)}${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}run:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(String(infoLine.runNumber))}${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}built:${ANSI_RESET} ${SITE_WHITE}${sanitizeTerminalText(infoLine.builtAt)}${ANSI_RESET}`);
  return;
}

function runUnameCommand(term, args) {
  if (!args.includes('-a')) {
    term.writeln(`${SITE_WHITE}Linux${ANSI_RESET}`);
    return Promise.resolve();
  }
  return loadBuildInfo().then(() => {
    const infoLine = buildInfoLine();
    if (infoLine !== null) {
      term.writeln(`${SITE_WHITE}Linux ${getTerminalHost()} ${infoLine.shortSha} ${infoLine.runNumber} ${infoLine.builtAt} x86_64 GNU/Linux${ANSI_RESET}`);
    } else {
      term.writeln(`${SITE_WHITE}Linux ${getTerminalHost()} 7.x-LTS #1 dvxb v2 x86_64 GNU/Linux${ANSI_RESET}`);
    }
  });
}
function runPwdCommand(term) {
  term.writeln(`${SITE_BLUE}/home/db${ANSI_RESET}`);
  return;
}
function runCatCommand(term, args) {
  if (!args.length) { term.writeln(`${SITE_ERR}cat: missing operand${ANSI_RESET}`); return; }
  const normalizedCatPath = normalizeVfsPath(args[0]);
  if (isVfsDirectory(normalizedCatPath)) {
    term.writeln(`${SITE_ERR}cat: ${args[0]}: Is a directory${ANSI_RESET}`);
    return;
  }
  const catContent = lookupVfsPath(args[0]);
  if (catContent === undefined) {
    term.writeln(`${SITE_ERR}cat: ${args[0]}: No such file or directory${ANSI_RESET}`);
  } else if (String(args[0]).toLowerCase().endsWith('.md')) {
    const catWidth = Number(term.cols) || 80;
    for (const renderedLine of renderMarkdown(catContent, catWidth)) {
      term.writeln(renderedLine);
    }
  } else {
    catContent.split('\n').forEach(line => term.writeln(`${SITE_WHITE}${line}${ANSI_RESET}`));
  }
  return;
}
function runLsCommand(term, args) {
  const lsPath = args[0] || VFS_HOME_DIR;
  const normalizedLsPath = normalizeVfsPath(lsPath);
  if (isVfsDirectory(normalizedLsPath)) {
    listVfsDirectory(normalizedLsPath).forEach((listedItem) => {
      const isLink = listedItem.includes('.pdf');
      const isDir = listedItem.endsWith('/');
      term.writeln(`${isLink ? SITE_RED : (isDir ? SITE_BLUE : SITE_CYAN)}${listedItem}${ANSI_RESET}`);
    });
    return;
  }
  const lsContent = lookupVfsPath(lsPath);
  if (lsContent === undefined) {
    term.writeln(`${SITE_ERR}ls: ${lsPath}: No such file or directory${ANSI_RESET}`);
    return;
  }
  // GNU ls on a file operand prints the name, not the contents.
  term.writeln(`${SITE_CYAN}${baseNameOfPath(normalizedLsPath)}${ANSI_RESET}`);
  return;
}
function runEchoCommand(term, args) {
  term.writeln(`${SITE_WHITE}${args.join(' ')}${ANSI_RESET}`);
  return;
}
function runClearCommand(term) {
  term.clear();
  return;
}
function runAboutCommand(term) {
  term.writeln(`${SITE_WHITE}Devkumar Banerjee${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}───────────────${ANSI_RESET}`);
  term.writeln(`${SITE_WHITE}CS Honors @ Texas A&M University${ANSI_RESET}`);
  term.writeln(`Builder of terminal-themed portfolios with ${SITE_CYAN}xterm.js${ANSI_RESET}`);
  term.writeln(`frosted glass UI, ${SITE_CYAN}Three.js${ANSI_RESET} particle effects, and a`);
  term.writeln(`networked AI assistant (${SITE_CYAN}Groq${ANSI_RESET} cloud default, local option)`);
  term.writeln(`${SITE_MUTED}Cloud default sends prompt + portfolio context to Groq via Worker proxy; local runs on-device after download${ANSI_RESET}`);
  term.writeln('Systems tinkerer, researcher, and open-source');
  term.writeln('contributor. Interested in ML infrastructure, developer tooling,');
  term.writeln('and building things that feel alive.');
  term.writeln(`cv: ${osc8Link('https://dvxb.io', `${SITE_BLUE}https://dvxb.io${ANSI_RESET}`)}`);
  term.writeln(`gh: ${osc8Link('https://github.com/aptitudepi', `${SITE_BLUE}https://github.com/aptitudepi${ANSI_RESET}`)}`);
  return;
}
function runFortuneCommand(term) {
  if (FORTUNES.length) {
    term.writeln(`${SITE_WHITE}${FORTUNES[Math.floor(Math.random() * FORTUNES.length)]}${ANSI_RESET}`);
  } else {
    term.writeln(`${SITE_ERR}No fortunes available${ANSI_RESET}`);
  }
  return;
}
function runCowsayCommand(term, args) {
  const cowMsg = args.join(' ') || 'Moo!';
  const MAX_W = 58;
  const words = cowMsg.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    if (cur && cur.length + word.length + 1 > MAX_W) { lines.push(cur); cur = ''; }
    cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  if (!lines.length) lines.push('');
  const maxW = Math.min(Math.max(...lines.map(line => line.length)), MAX_W);
  const bar = '\u2500'.repeat(maxW + 2);
  const side = '\u2502';
  term.writeln(` ${SITE_GREEN} ${bar}${ANSI_RESET}`);
  for (const line of lines) {
    term.writeln(` ${SITE_GREEN}${side} ${line.padEnd(maxW)} ${side}${ANSI_RESET}`);
  }
  term.writeln(` ${SITE_GREEN} ${bar}${ANSI_RESET}`);
  term.writeln(`${SITE_GREEN}   \\   ^__^${ANSI_RESET}`);
  term.writeln(`${SITE_GREEN}    \\  (oo)\\_______${ANSI_RESET}`);
  term.writeln(`${SITE_GREEN}       (__)\\       )\\/\\${ANSI_RESET}`);
  term.writeln(`${SITE_GREEN}           ||----w |${ANSI_RESET}`);
  term.writeln(`${SITE_GREEN}           ||     ||${ANSI_RESET}`);
  return;
}
function runMatrixCommand(term) {
  if (typeof window.stopMatrixRain === 'function' && typeof window.isMatrixActive === 'function' && window.isMatrixActive()) {
    window.stopMatrixRain();
    term.writeln(`${SITE_MUTED}Matrix rain stopped${ANSI_RESET}`);
  } else if (typeof window.startMatrixRain === 'function') {
    window.startMatrixRain();
    term.writeln(`${SITE_GREEN}Matrix rain started. Press Escape to exit.${ANSI_RESET}`);
  } else {
    term.writeln(`${SITE_ERR}Matrix rain module not loaded${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}Next: reload the page and retry \`matrix\`${ANSI_RESET}`);
  }
  return;
}
function runVmCommand(term, args, runSignal) {
  term.writeln(`${SITE_MUTED}Run Linux in your browser — booting Buildroot Linux (5–15s to boot)...${ANSI_RESET}`);
  if (typeof window.bootVM === 'function') {
    return window.bootVM(term, runSignal);
  }
  term.writeln(`${SITE_ERR}VM module not loaded${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}Next: reload the page and retry \`vm\`${ANSI_RESET}`);
  return null;
}
async function runAiCommand(term, args, runSignal) {
  return (await import('./ai.js')).generateOutput(args.join(' '), term, runSignal);
}
async function runAiModelsCommand(term) {
  (await import('./ai.js')).showModelSelector(term);
  return;
}
async function runAiModelCommand(term, args) {
  if (args.length) {
    (await import('./ai.js')).switchModel(args[0], term);
  } else {
    (await import('./ai.js')).showModelSelector(term);
  }
  return;
}
async function runAiMemoryCommand(term, args) {
  const memoryModule = await import('./memory.js');
  const leadToken = String(args[0] ?? '').toLowerCase();
  const tailFact = args.slice(1).join(' ').trim();
  if (leadToken === 'on') {
    memoryModule.setMemoryEnabled(true);
    term.writeln(`${SITE_GREEN}\x1b[1mAI memory ON — saved facts and recent turns feed the next prompt.${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Cloud default sends prompt + portfolio context to Groq via Worker proxy; local runs on-device after download${ANSI_RESET}`);
    return;
  }
  if (leadToken === 'off') {
    memoryModule.setMemoryEnabled(false);
    term.writeln(`${SITE_GREEN}\x1b[1mAI memory OFF — stored facts and turns stay on this device and are NOT sent.${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Verify with \`ai details\`: memory shows OFF and the sends line drops memory.${ANSI_RESET}`);
    return;
  }
  if (leadToken === 'clear') {
    memoryModule.clearMemory();
    term.writeln(`${SITE_GREEN}\x1b[1mAI memory cleared — facts and conversation turns wiped from this browser.${ANSI_RESET}`);
    return;
  }
  if (leadToken === 'save') {
    if (!tailFact) {
      term.writeln(`${SITE_MUTED}Usage: ai-memory save <fact>${ANSI_RESET}`);
      return;
    }
    memoryModule.saveUserFact(tailFact);
    const factTotal = memoryModule.getStoredMemory().facts.length;
    term.writeln(`${SITE_GREEN}\x1b[1mSaved fact (${factTotal} stored): ${sanitizeTerminalText(tailFact)}${ANSI_RESET}`);
    return;
  }
  if (leadToken === '--json') {
    const exportPayload = {
      enabled: memoryModule.isMemoryEnabled(),
      facts: memoryModule.getStoredMemory().facts,
      history: memoryModule.getStoredHistory(),
    };
    term.writeln(JSON.stringify(exportPayload));
    return;
  }
  if (leadToken !== '') {
    term.writeln(`${SITE_ERR}ai-memory: unknown subcommand "${sanitizeTerminalText(args[0])}"${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Usage: ai-memory [on|off|clear|save <fact>|--json]${ANSI_RESET}`);
    return;
  }
  const memoryOn = memoryModule.isMemoryEnabled();
  const storedMemory = memoryModule.getStoredMemory();
  const storedHistory = memoryModule.getStoredHistory();
  term.writeln(`${SITE_GREEN}\x1b[1mPortfolio AI Assistant Memory & Conversation Turns:${ANSI_RESET}`);
  if (memoryOn) {
    term.writeln(`${SITE_MUTED}memory: ON — ${storedMemory.facts.length} facts, ${storedHistory.length} turns feed the next prompt (\`ai-memory off\` stops injection)${ANSI_RESET}`);
  } else {
    term.writeln(`${SITE_MUTED}memory: OFF — ${storedMemory.facts.length} facts, ${storedHistory.length} turns stored but NOT sent${ANSI_RESET}`);
  }
  if (!storedMemory.facts.length) {
    term.writeln(`${SITE_MUTED}No saved facts. Save one with \`ai-memory save <fact>\`.${ANSI_RESET}`);
  } else {
    term.writeln(`${SITE_GREEN}Saved facts (${storedMemory.facts.length}):${ANSI_RESET}`);
    for (let factIndex = 0; factIndex < storedMemory.facts.length; factIndex++) {
      term.writeln(`  ${SITE_FAINT}[${factIndex + 1}]${ANSI_RESET} ${sanitizeTerminalText(storedMemory.facts[factIndex])}`);
    }
  }
  if (!storedHistory.length) {
    term.writeln(`${SITE_MUTED}No conversation history stored.${ANSI_RESET}`);
  } else {
    // Real-only view: legacy empty/whitespace turns (stored before the
    // append guard) are hidden, never rendered as blank lines.
    const realTurns = storedHistory.filter((t) => t && typeof t.content === 'string' && t.content.trim().length > 0);
    if (!realTurns.length) {
      term.writeln(`${SITE_MUTED}No conversation history stored.${ANSI_RESET}`);
    } else {
      for (let turnIndex = 0; turnIndex < realTurns.length; turnIndex++) {
        const turn = realTurns[turnIndex];
        term.writeln(`  ${SITE_FAINT}[${turnIndex + 1}] ${turn.role.toUpperCase()}:${ANSI_RESET} ${sanitizeTerminalText(String(turn.content).trim())}`);
      }
    }
  }
  term.writeln(`${SITE_MUTED}Cloud default sends prompt + portfolio context to Groq via Worker proxy; local runs on-device after download${ANSI_RESET}`);
  return;
}
function runHistoryCommand(term) {
  if (CMD_HISTORY.length === 0) {
    term.writeln(`${SITE_MUTED}No commands in history${ANSI_RESET}`);
  } else {
    for (let index = 0; index < CMD_HISTORY.length; index++) {
      const idx = String(index + 1).padStart(3, ' ');
      term.writeln(`${SITE_FAINT}${idx}  ${ANSI_RESET}${SITE_WHITE}${stripAnsi(CMD_HISTORY[index])}${ANSI_RESET}`);
    }
  }
  return;
}
function runCrtCommand(term) {
  const crtOverlay = document.getElementById('crt-overlay');
  if (crtOverlay) {
    crtOverlay.classList.toggle('active');
    term.writeln(`${SITE_GREEN}crt overlay ${crtOverlay.classList.contains('active') ? 'enabled' : 'disabled'}${ANSI_RESET}`);
  }
  return;
}
function runNoiseCommand(term) {
  const noiseOverlay = document.getElementById('noise-overlay');
  if (noiseOverlay) {
    noiseOverlay.classList.toggle('active');
    term.writeln(`${SITE_GREEN}noise overlay ${noiseOverlay.classList.contains('active') ? 'enabled' : 'disabled'}${ANSI_RESET}`);
  }
  return;
}

// PR4 `sparkline` is unlisted the same way: the chart module (and its CDN
// import of lightweight-charts) loads only when the command runs.
async function runSparklineCommand(term, args, runSignal) {
  return (await import('./sparkline.js')).runSparklineCommand(term, runSignal);
}
async function runPgCommand(term, args, runSignal) {
  const demoArg = String(args[0] ?? '').trim().toLowerCase();
  if (!demoArg) {
    term.writeln(`${SITE_MUTED}Playgrounds: life — run \`pg <demo>\`${ANSI_RESET}`);
    return;
  }
  if (demoArg !== 'life') {
    term.writeln(`${SITE_ERR}pg: unknown demo ${sanitizeTerminalText(demoArg)}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Playgrounds: life — run \`pg life\`${ANSI_RESET}`);
    return;
  }
  const lifeModule = await import('./pg-life.js');
  await lifeModule.runLife(term, runSignal);
}
// `spark` follows the same lazy pattern: the terminal-native renderer module
// (no CDN — pure Unicode/ANSI) loads only when the command runs.
async function runSparkCommand(term, args, runSignal) {
  return (await import('./spark.js')).runSparkCommand(term, args, runSignal);
}
async function runBackgroundCommand(term, args) {
  const modeArg = String(args[0] ?? '').trim().toLowerCase();
  const backgroundsModule = await import('./backgrounds.js');
  if (!modeArg) {
    const currentMode = backgroundsModule.getBackgroundMode();
    term.writeln(`${SITE_WHITE}Background mode: ${currentMode.effective}${ANSI_RESET}`);
    if (currentMode.effective !== currentMode.requested) {
      term.writeln(`${SITE_MUTED}Requested ${currentMode.requested}, held to ${currentMode.effective} by the motion policy${ANSI_RESET}`);
    }
    term.writeln(`${SITE_MUTED}Next: run \`background <off|static|ambient|expressive>\`${ANSI_RESET}`);
    return;
  }
  const appliedMode = backgroundsModule.setBackgroundMode(modeArg);
  if (!appliedMode) {
    term.writeln(`${SITE_ERR}background: unknown mode ${sanitizeTerminalText(modeArg)}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`background <off|static|ambient|expressive>\`${ANSI_RESET}`);
    return;
  }
  term.writeln(`${SITE_GREEN}Background mode: ${appliedMode.effective}${ANSI_RESET}`);
  if (appliedMode.effective !== appliedMode.requested) {
    term.writeln(`${SITE_MUTED}Requested ${appliedMode.requested}, held to ${appliedMode.effective} by the motion policy${ANSI_RESET}`);
  }
  return;
}
// `imgcat` lazy-loads the vendored sixel decoder + @xterm/image addon from
// vendor/xterm/ on first use only, then streams the image as one iTerm2
// inline-image escape (repo-relative paths only; base64 has no newlines).
const IMGCAT_SIXEL_URL = 'vendor/xterm/sixel-full.js';
const IMGCAT_ADDON_URL = 'vendor/xterm/xterm-image-addon.js';
const IMGCAT_DEFAULT_IMAGE = 'assets/imgcat-sample.png';
const IMGCAT_PATH_PATTERN = /^(assets|images)\/[\w./-]+\.(png|gif|jpe?g|webp)$/i;
let imgcatSetupPromise = null;
function imgcatLoadScript(scriptSrc) {
  return new Promise((resolveLoad, rejectLoad) => {
    const scriptTag = document.createElement('script');
    scriptTag.src = scriptSrc;
    scriptTag.onload = resolveLoad;
    scriptTag.onerror = () => rejectLoad(new Error(`load failed: ${scriptSrc}`));
    document.head.appendChild(scriptTag);
  });
}
async function runImgcatCommand(term, args, runSignal) {
  const targetPath = String(args[0] || IMGCAT_DEFAULT_IMAGE).trim();
  if (!IMGCAT_PATH_PATTERN.test(targetPath) || targetPath.includes('..')) {
    term.writeln(`${SITE_ERR}imgcat: path must be a repo-relative image under assets/ or images/${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: try \`imgcat\` or \`imgcat ${IMGCAT_DEFAULT_IMAGE}\`${ANSI_RESET}`);
    return;
  }
  try {
    if (!imgcatSetupPromise) {
      imgcatSetupPromise = (async () => {
        await imgcatLoadScript(IMGCAT_SIXEL_URL); // decoder ready before addon registers its sequences
        await imgcatLoadScript(IMGCAT_ADDON_URL);
        const ImageAddonCtor = window.ImageAddon?.ImageAddon || window.ImageAddon;
        const realTerminal = (await import('./terminal.js')).getTerm();
        if (typeof ImageAddonCtor !== 'function' || !realTerminal || !window.sixel) {
          throw new Error('inline images not supported in this terminal');
        }
        const imageAddon = new ImageAddonCtor();
        realTerminal.loadAddon(imageAddon);
        return { realTerminal, imageAddon };
      })();
    }
    await imgcatSetupPromise; // throws with a graceful message if the addon/decoder failed to load
    const imgResp = await fetch(encodeURI(targetPath), { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!imgResp.ok) throw new Error(`HTTP ${imgResp.status}`);
    const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
    let imgBinary = '';
    for (const byte of imgBytes) imgBinary += String.fromCharCode(byte);
    term.write(`\r\n\x1b]1337;File=inline=1:${btoa(imgBinary)}\x07\r\n`);
    term.writeln(`${SITE_MUTED}${targetPath} (${imgBytes.length} bytes)${ANSI_RESET}`);
  } catch (imgcatError) {
    imgcatSetupPromise = null; // a failed load/registration is retried on the next run
    term.writeln(`${SITE_ERR}imgcat: ${imgcatError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: check the network and retry \`imgcat\`${ANSI_RESET}`);
  }
  return;
}
async function runWallDeleteCommand(term, args, runSignal) {
  const targetId = String(args[1] ?? '').trim();
  if (targetId.length === 0) {
    term.writeln(`${SITE_ERR}Usage: wall delete <post-id> [delete-token]${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: paste the id from your post; the token was shown once at submit (also kept in browser storage)${ANSI_RESET}`);
    return;
  }
  let deleteToken = String(args[2] ?? '').trim();
  if (deleteToken.length === 0) {
    try {
      deleteToken = String(localStorage.getItem(`guestbook:delete:${targetId}`) ?? '');
    } catch {
      term.writeln(`${SITE_FAINT}Browser storage unavailable; paste the delete token explicitly.${ANSI_RESET}`);
      deleteToken = '';
    }
  }
  if (deleteToken.length === 0) {
    term.writeln(`${SITE_ERR}No delete token found for that post.${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: rerun with the token, or contact the site owner for manual review${ANSI_RESET}`);
    return;
  }
  term.writeln(`${SITE_FAINT}Requesting deletion...${ANSI_RESET}`);
  try {
    const deleteResp = await fetch(`https://0.supernovadkb.workers.dev/api/guestbook/${encodeURIComponent(targetId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: deleteToken }),
      signal: combinedTimeoutSignal(runSignal, 10000),
    });
    if (!deleteResp.ok) throw new Error(`delete HTTP ${deleteResp.status}`);
    const deleteData = await deleteResp.json();
    if (deleteData.success) {
      term.writeln(`${SITE_GREEN}\x1b[1mEntry deleted from the guestbook.${ANSI_RESET}`);
      try {
        localStorage.removeItem(`guestbook:delete:${targetId}`);
      } catch {
        term.writeln(`${SITE_FAINT}Browser storage kept a stale token copy; the server entry is gone.${ANSI_RESET}`);
      }
    } else {
      term.writeln(`${SITE_ERR}Delete failed: ${stripAnsi(deleteData.error || 'Unknown error')}${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: check the id/token, or contact the site owner for manual review${ANSI_RESET}`);
    }
  } catch (postError) {
    if (isAbortError(postError)) throw postError;
    term.writeln(`${SITE_ERR}Delete error: ${postError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`wall delete <post-id>\` or check your connection${ANSI_RESET}`);
  }
  return;
}
async function runWallCommand(term, args, runSignal) {
  const leadArg = String(args[0] ?? '').toLowerCase();
  if (leadArg === 'delete') {
    await runWallDeleteCommand(term, args, runSignal);
    return;
  }
  const msg = args.join(' ');
  if (!msg) {
    term.writeln(`${SITE_FAINT}Fetching global visitor wall...${ANSI_RESET}`);
    try {
      const wallResp = await fetch('https://0.supernovadkb.workers.dev/wall', { signal: combinedTimeoutSignal(runSignal, 10000) });
      if (!wallResp.ok) throw new Error(`wall HTTP ${wallResp.status}`);
      const wallData = await wallResp.json();
      const posts = wallData.posts || [];
      term.writeln(`${SITE_GREEN}\x1b[1mdvxb.io Global Visitor Guestbook:\x1b[0m${ANSI_RESET}`);
      if (!posts.length) {
        term.writeln(`${SITE_MUTED}No entries yet. Be the first to leave a message using: wall <your message>${ANSI_RESET}`);
      } else {
        for (const post of posts) {
          term.writeln(`  ${SITE_CYAN}[${stripAnsi(post.timestamp)}] ${stripAnsi(formatWallMoniker(post.name))}:${ANSI_RESET} "${stripAnsi(post.message)}"`);
        }
      }
      term.writeln(`\n${SITE_MUTED}Tip: Leave your own message using: wall <message>${ANSI_RESET}`);
    } catch (wallError) {
      if (isAbortError(wallError)) throw wallError;
      term.writeln(`${SITE_ERR}Failed to load wall: ${wallError.message}${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: retry \`wall\` or check your connection${ANSI_RESET}`);
    }
    return;
  }
  term.writeln(`${SITE_FAINT}Posting message to global wall...${ANSI_RESET}`);
  const trimmedMessage = msg.trim();
  if (trimmedMessage.length === 0) {
    term.writeln(`${SITE_ERR}Message cannot be empty${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`wall <message>\` or run \`wall\` to read the wall${ANSI_RESET}`);
    return;
  }
  if (Array.from(trimmedMessage).length > 280) {
    term.writeln(`${SITE_ERR}Message is too long (kept to 280 characters)${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: shorten the message and retry \`wall <message>\`${ANSI_RESET}`);
    return;
  }
  try {
    // WAVE 9b private telemetry: allowlist device signals encrypted in the
    // browser to the owner's public key (fail-closed — any throw drops the
    // telemetry blob and the public post still submits). openpgp loads lazily
    // here, after validation, so the initial bundle never carries it.
    // Disclosure budget: exactly ONE submit-time line covers the public plus
    // encrypted-to-owner intent and the coarse-geo note. The
    // telemetry failure path stays silent in-terminal (console.warn only),
    // so both success and failure cost one line total (max two on failure).
    term.writeln(`${SITE_MUTED}Entries are public; device signals are encrypted to the owner for abuse prevention (coarse city-level geo only; posts submit regardless).${ANSI_RESET}`);
    let armoredTelemetry = null;
    try {
      const telemetryModule = await import('./wall-telemetry.js');
      const telemetryRecord = await telemetryModule.collectWallTelemetry(telemetryModule.newWallNonce());
      const canonicalText = JSON.stringify(telemetryRecord);
      armoredTelemetry = await telemetryModule.encryptWallTelemetry(canonicalText, telemetryModule.wallTelemetryVendorUrl());
    } catch (telemetryError) {
      console.warn('wall telemetry skipped', telemetryError);
      armoredTelemetry = null;
    }
    const postResp = await fetch('https://0.supernovadkb.workers.dev/wall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Terminal Visitor', message: trimmedMessage, gpg: armoredTelemetry }),
      signal: combinedTimeoutSignal(runSignal, 10000),
    });
    if (!postResp.ok) throw new Error(`wall HTTP ${postResp.status}`);
    const postData = await postResp.json();
    if (postData.post) {
      term.writeln(`${SITE_GREEN}\x1b[1mMessage posted to global wall!${ANSI_RESET}`);
      term.writeln(`  ${SITE_CYAN}${stripAnsi(formatWallMoniker(postData.post.name))}:${ANSI_RESET} "${stripAnsi(postData.post.message)}"`);
      if (typeof postData.deleteToken === 'string' && postData.deleteToken.length > 0) {
        term.writeln(`  ${SITE_MUTED}Delete token (shown once — save it): ${stripAnsi(postData.deleteToken)}${ANSI_RESET}`);
        try {
          localStorage.setItem(`guestbook:delete:${String(postData.post.id)}`, postData.deleteToken);
        } catch {
          term.writeln(`${SITE_MUTED}Browser storage blocked the delete-token backup; keep the token above.${ANSI_RESET}`);
        }
      }
    } else {
      term.writeln(`${SITE_ERR}Failed to post: ${postData.error || 'Unknown error'}${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: retry \`wall <message>\` or run \`wall\` to read the wall${ANSI_RESET}`);
    }
  } catch (postError) {
    if (isAbortError(postError)) throw postError;
    term.writeln(`${SITE_ERR}Wall post error: ${postError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`wall <message>\` or run \`wall\` to read the wall${ANSI_RESET}`);
  }
  return;
}
async function runSearchCommand(term, args, runSignal) {
  const query = args.join(' ');
  if (!query) {
    term.writeln(`${SITE_MUTED}Usage: search <query>${ANSI_RESET}`);
    return;
  }
  term.writeln(`${SITE_FAINT}Searching web via Cloudflare Worker...${ANSI_RESET}`);
  try {
    const searchResp = await fetch(`https://0.supernovadkb.workers.dev/search?q=${encodeURIComponent(query)}`, { signal: combinedTimeoutSignal(runSignal, SEARCH_TIMEOUT_MILLIS) });
    if (!searchResp.ok) throw new Error(`search HTTP ${searchResp.status}`);
    const searchData = await searchResp.json();
    if (!searchData.results || !searchData.results.length) {
      term.writeln(`${SITE_MUTED}No search results found.${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: try different keywords or retry the search${ANSI_RESET}`);
    } else {
      term.writeln(`${SITE_GREEN}\x1b[1mSearch Results for "${stripAnsi(query)}":\x1b[0m${ANSI_RESET}`);
      for (let resultIndex = 0; resultIndex < searchData.results.length; resultIndex++) {
        const result = searchData.results[resultIndex];
        term.writeln(`  ${SITE_GREEN}[${resultIndex + 1}] ${stripAnsi(result.title)}${ANSI_RESET}`);
        term.writeln(`      ${SITE_FAINT}${stripAnsi(result.snippet)}${ANSI_RESET}`);
        term.writeln(`      \x1b[34m\x1b[4m${stripAnsi(result.url)}\x1b[0m\n`);
      }
    }
  } catch (searchError) {
    if (isAbortError(searchError)) throw searchError;
    term.writeln(`${SITE_ERR}Search error: ${searchError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry the search or check your connection${ANSI_RESET}`);
  }
  return;
}
async function runMyipCommand(term, args, runSignal) {
  term.writeln(`${SITE_FAINT}Pinging Cloudflare Worker gateway...${ANSI_RESET}`);
  const startMillis = performance.now();
  try {
    const pingResp = await fetch('https://0.supernovadkb.workers.dev/ip', { signal: combinedTimeoutSignal(runSignal, 10000) });
    if (!pingResp.ok) throw new Error(`ping HTTP ${pingResp.status}`);
    const pingInfo = await pingResp.json();
    const latency = Math.round(performance.now() - startMillis);
    term.writeln(`${SITE_GREEN}\x1b[1mNetwork Diagnostics & IP Location:\x1b[0m${ANSI_RESET}`);
    term.writeln(`  \x1b[36mPublic IP:\x1b[0m ${stripAnsi(pingInfo.ip)}`);
    term.writeln(`  \x1b[36mLocation:\x1b[0m ${stripAnsi(pingInfo.city)}, ${stripAnsi(pingInfo.country)} (${stripAnsi(pingInfo.continent)})`);
    term.writeln(`  \x1b[36mISP / ASN:\x1b[0m ${stripAnsi(pingInfo.asOrganization)} (AS${stripAnsi(pingInfo.asn)})`);
    term.writeln(`  \x1b[36mLatency:\x1b[0m ${latency}ms`);
    term.writeln(`  \x1b[36mRay ID:\x1b[0m ${stripAnsi(pingInfo.ray)}`);
  } catch (pingError) {
    if (isAbortError(pingError)) throw pingError;
    term.writeln(`${SITE_ERR}Ping error: ${pingError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: retry \`ping\` or check your connection${ANSI_RESET}`);
  }
  return;
}
function runProjectsCommand(term, args) {
  const jsonMode = args.includes('--json');
  const filterWords = args.filter((argText) => argText !== '--json');
  const filterText = sanitizeTerminalText(filterWords.join(' ')).toLowerCase();
  const matchedProjects = PORTFOLIO_PROJECTS.filter((project) => {
    if (filterText.trim() === '') {
      return true;
    }
    const haystackText = `${project.name} ${project.tags.join(' ')} ${project.description}`.toLowerCase();
    return haystackText.includes(filterText);
  });
  if (jsonMode) {
    const jsonPayload = matchedProjects.map((project) => ({ name: project.name, tags: project.tags, description: project.description, repo: project.repo }));
    term.writeln(JSON.stringify(jsonPayload));
    return;
  }
  if (matchedProjects.length === 0) {
    term.writeln(`${SITE_ERR}No projects match "${filterText}"${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`projects\` to list everything${ANSI_RESET}`);
    return;
  }
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Portfolio projects (${matchedProjects.length})${ANSI_RESET}`);
  for (const project of matchedProjects) {
    term.writeln(`  ${SITE_GREEN}${project.name}${ANSI_RESET} ${SITE_FAINT}${project.tags.join(' · ')}${ANSI_RESET}`);
    term.writeln(`    ${SITE_MUTED}${project.description}${ANSI_RESET}`);
    term.writeln(`    ${osc8Link(project.repo, `${SITE_BLUE}${project.repo}${ANSI_RESET}`)}`);
  }
  term.writeln(`${SITE_MUTED}Next: run \`case <name>\` for a deep dive, e.g. \`case pcpg\`${ANSI_RESET}`);
  return;
}

function runCaseCommand(term, args) {
  const queryKey = sanitizeTerminalText(args.join(' ')).toLowerCase().replace(/[^a-z0-9]/g, '');
  const caseProject = PORTFOLIO_PROJECTS.find((project) => {
    const projectKey = project.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return projectKey.includes(queryKey) && queryKey !== '';
  });
  if (caseProject === undefined) {
    const knownKeys = PORTFOLIO_PROJECTS.map((project) => project.key).join(', ');
    term.writeln(`${SITE_ERR}case: unknown project "${sanitizeTerminalText(args.join(' '))}"${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Available cases: ${knownKeys}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`case <name>\`, e.g. \`case pcpg\`${ANSI_RESET}`);
    return;
  }
  const caseDoc = `## ${caseProject.name}\n\n**Stack:** ${caseProject.tags.join(' · ')}\n\n### Problem\n\n${caseProject.description}\n\n### Role\n\n${caseProject.role}\n\n### Outcome\n\n${caseProject.outcome}\n\n### Links\n\n- [Source](${caseProject.repo})\n- Demo: see the Source link`;
  const caseWidth = Number(term.cols) || 80;
  for (const caseLine of renderMarkdown(caseDoc, caseWidth)) {
    term.writeln(caseLine);
  }
  return;
}

function runSkillsCommand(term) {
  const skillNames = RESUME.Skills;
  const nameWidth = Math.max(...skillNames.map((skillText) => skillText.length));
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Technical skills (${skillNames.length})${ANSI_RESET}`);
  for (const skillName of skillNames) {
    term.writeln(`  ${SITE_CYAN}${skillName.padEnd(nameWidth)}${ANSI_RESET} ${SITE_GREEN}${'█'.repeat(10)}${ANSI_RESET}`);
  }
  term.writeln(`${SITE_MUTED}Full bars show coverage from the resume skill list, not a ranking${ANSI_RESET}`);
  return;
}

function runTimelineCommand(term) {
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Career timeline${ANSI_RESET}`);
  for (let entryIndex = 0; entryIndex < TIMELINE_ENTRIES.length; entryIndex++) {
    const timelineEntry = TIMELINE_ENTRIES[entryIndex];
    const branchMark = entryIndex === TIMELINE_ENTRIES.length - 1 ? '└──' : '├──';
    term.writeln(`  ${SITE_GREEN}${branchMark}${ANSI_RESET} ${SITE_CYAN}${timelineEntry.date}${ANSI_RESET} — ${SITE_WHITE}${timelineEntry.title}${ANSI_RESET} ${SITE_MUTED}@ ${timelineEntry.org}${ANSI_RESET}`);
  }
  term.writeln(`${SITE_MUTED}Source: resume page and about section${ANSI_RESET}`);
  return;
}

function triggerFileDownload(fileName, fileText) {
  try {
    const fileBlob = new Blob([fileText], { type: 'text/plain' });
    const downloadUrl = URL.createObjectURL(fileBlob);
    const anchorNode = document.createElement('a');
    anchorNode.href = downloadUrl;
    anchorNode.download = fileName;
    document.body.appendChild(anchorNode);
    anchorNode.click();
    anchorNode.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 4000);
  } catch (downloadError) {
    console.warn(`export download skipped: ${downloadError.message}`);
  }
}

function saveExportFile(term, baseName, fileText) {
  const safeBase = String(baseName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'output';
  const exportPath = `/home/db/exports/${safeBase}.txt`;
  vfs.set(normalizeVfsPath(exportPath), fileText);
  triggerFileDownload(`${safeBase}.txt`, fileText);
  const lineCount = fileText.split('\n').length;
  term.writeln(`${SITE_GREEN}Saved output to ${exportPath} (${lineCount} lines)${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}Next: run \`cat ${exportPath}\` to read it back${ANSI_RESET}`);
}

async function runExportCommand(term, args, runSignal) {
  if (args.length === 0) {
    const previousOutput = stripAnsi(readLastCommandOutput());
    if (previousOutput.trim() === '') {
      term.writeln(`${SITE_ERR}export: no previous command output to save${ANSI_RESET}`);
      term.writeln(`${SITE_MUTED}Next: run a command first, e.g. \`export neofetch\`${ANSI_RESET}`);
      return;
    }
    saveExportFile(term, 'last', previousOutput);
    return;
  }
  const headName = String(args[0]).toLowerCase();
  const exportEntry = resolveCommand(headName);
  if (exportEntry === null) {
    term.writeln(`${SITE_ERR}export: unknown command ${sanitizeTerminalText(args[0])}${ANSI_RESET}`);
    const exportSuggestion = suggestCommand(headName);
    if (exportSuggestion) {
      term.writeln(`${SITE_MUTED}Did you mean \`${SITE_WHITE}${exportSuggestion}${SITE_MUTED}\`?${ANSI_RESET}`);
    }
    term.writeln(`${SITE_MUTED}Next: type \`help\` for the full command list${ANSI_RESET}`);
    return;
  }
  if (exportEntry.name === 'export' || exportEntry.name === 'clear' || exportEntry.name === 'vm') {
    term.writeln(`${SITE_ERR}export: '${exportEntry.name}' needs the live terminal and cannot be captured${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: export a read-only command, e.g. \`export neofetch\`${ANSI_RESET}`);
    return;
  }
  const capturedChunks = [];
  const captureTerm = {
    write(chunkText) {
      capturedChunks.push(String(chunkText));
      term.write(chunkText);
    },
    writeln(lineText) {
      capturedChunks.push(`${String(lineText ?? '')}\n`);
      term.writeln(lineText);
    },
    clear() {
      capturedChunks.length = 0;
      term.clear();
    },
  };
  await exportEntry.run(captureTerm, args.slice(1), runSignal);
  const capturedOutput = stripAnsi(capturedChunks.join(''));
  if (capturedOutput.trim() === '') {
    term.writeln(`${SITE_ERR}export: '${exportEntry.name}' produced no output to save${ANSI_RESET}`);
    return;
  }
  saveExportFile(term, exportEntry.name, capturedOutput);
  return;
}

async function runDevmodeCommand(term) {
  term.writeln(`${SITE_MUTED}Loading dev panel…${ANSI_RESET}`);
  try {
    const devtools = await import('./devtools.js');
    devtools.toggleDevPanel();
  } catch (devError) {
    term.writeln(`${SITE_ERR}Failed to load dev panel: ${devError.message}${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: reload the page and retry \`devmode\`${ANSI_RESET}`);
  }
  return;
}

// Easter egg: Aggie Ring milestone. Unlisted on purpose (like the WAVE 8
// portfolio set) so `help` output and the COMMANDS count stay byte-identical
// to the goldens; the palette, tab completion and `man` pick it up from the
// registry automatically. Post is still a draft — the link 404s until publish.
// Responsive ring art: 65-wide detailed crest on wide terminals, 52-wide
// compact crest below 75 cols (or when width is unknown — compact never
// wraps). Facts/link order, unlisted status and mono SITE_WHITE unchanged.
const RING_ART_WIDE = [
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣀⣤⣤⣤⣤⣴⣶⣶⣶⣶⣶⣶⣶⣶⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⣶⣶⣤⣤⣤⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⣠⣴⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣶⣦⣤⣀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⠿⠾⠛⠛⠛⢛⣿⠛⣿⡟⣹⣿⣤⣧⡌⣩⣭⣝⠛⡛⠛⠛⠿⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⡄⠀⠀⠀⠀',
  '⠀⠀⠀⣠⣴⣿⣿⡿⠿⠿⠿⠟⠛⠛⣋⠉⠉⠠⠒⠖⣂⠴⢊⢡⣶⣏⣿⠏⠺⠛⠙⣫⠉⠛⠛⠛⢻⠋⠻⠿⢿⣮⣍⡛⠳⣶⠠⣤⠈⣉⡙⡛⠛⠿⠿⠿⢿⣿⣿⣿⣇⠀⠀⠀⠀',
  '⠀⠀⣼⣡⡞⠛⢻⠷⢶⣤⣄⣠⡀⠈⢁⣒⣀⣤⠔⢚⣥⣺⣿⠸⢛⡀⠁⠘⡟⢦⠞⣿⠀⠀⠀⠀⢸⡟⠀⡰⠚⣏⠉⣴⣶⠄⠑⠄⠀⢥⢄⡍⢈⠃⠀⢠⣤⣶⣦⣭⣯⢻⣦⠀⠀',
  '⠀⣼⣿⠏⡀⠚⡱⠖⢦⣄⣉⠛⢷⣴⠾⠟⡉⠀⣠⣾⡿⠉⢡⣎⡡⢴⣆⠀⠷⠀⠀⣛⡃⠀⠀⠀⠘⠧⠴⠃⡔⢻⡇⢠⠀⠾⠷⠀⠙⢶⣶⡄⣠⣴⠞⢋⣉⠉⠁⣴⣿⡿⢿⣧⠀',
  '⢰⣿⡿⠀⠟⢋⡡⠜⢁⠤⢘⡤⠊⢈⡀⠀⢡⣄⡟⢉⡀⠀⠀⠻⠷⠚⣡⣤⣴⠶⠾⠛⠛⠛⠷⠶⢶⣦⣄⡈⠁⢸⡷⠁⣠⡷⠜⠻⠆⠀⠘⠱⢫⡰⢾⡏⢀⣴⣾⡟⢿⠳⠾⢦⡆',
  '⣿⣿⣇⣤⢴⠻⡵⠚⣉⠔⠋⣠⣴⠋⠝⢠⣼⡏⢴⠛⡿⢷⠖⢀⣠⡾⠛⠉⠀⢠⣄⠀⠉⠒⠂⠀⠀⠀⠉⠻⢶⣄⠀⠺⠋⢀⡾⠖⠻⡦⠀⢢⡀⠙⠳⣌⠻⠿⠟⣿⣾⣇⢠⣿⣷',
  '⣿⣿⣿⣿⡄⠀⡠⠊⣡⣴⡿⠋⢀⡶⢀⣼⠏⠀⠀⢻⡀⠀⣰⡿⣋⣤⣤⡄⠀⠃⠈⠛⣶⣾⣾⠃⠀⠀⣶⣦⢄⠙⢷⣄⠀⢿⡡⠤⢆⠻⡦⠀⠤⡄⠀⢠⣼⣷⣿⡿⣿⣿⣿⣿⣿',
  '⣿⣿⣯⣿⣆⣠⣶⣿⠿⠋⠀⢀⣧⠀⢸⡏⠀⠀⠀⠀⠀⣼⠏⠀⢡⣿⣿⡇⠀⠀⠀⠸⣿⣿⡟⠃⠀⠀⣿⣿⡦⠠⠀⢻⣆⠀⢤⣴⠞⣦⢿⡄⠠⣆⣠⠿⠟⣿⠁⠀⣹⣿⣿⣿⠿',
  '⠙⣿⣿⣿⡿⢛⣩⣤⣄⣀⡄⡀⠛⠀⡟⣻⢻⡟⡆⢀⣼⠃⠎⡀⠀⠠⠿⢇⠀⠤⠀⣊⠽⢯⣁⠳⠠⣴⡏⠃⠀⠀⠐⠀⢻⣇⠘⣆⠁⠞⡠⣶⠈⢉⠉⣴⣸⡟⢠⣾⣿⣿⣿⣿⡇',
  '⠀⣽⣿⣿⣿⣄⢻⣿⣿⣏⡞⡴⠁⢸⠓⠧⠾⣰⠃⣼⡏⠀⠀⠛⠁⡀⢰⠒⠒⠊⣉⠀⣤⡠⢈⠉⠓⠒⢢⠀⠀⠈⠃⡀⠀⣿⡄⢰⣶⠚⡇⣬⡀⠋⢸⢟⡡⠼⢿⣿⣿⣿⣿⣿⠁',
  '⠀⠸⠏⠙⣿⣿⣆⠙⢿⢸⢰⡇⠀⣼⣦⣤⣤⣤⢀⣿⠀⣸⢀⣠⠀⠀⢸⠀⠿⠂⠛⠃⠋⠃⠘⠃⠸⠟⢸⠀⠀⢀⠀⠱⠀⢸⣧⠀⡾⠶⠃⣨⡁⠧⠀⠁⠀⠀⠀⠈⣿⣿⠟⠋⠀',
  '⠀⠀⢳⣷⡟⢿⣿⣷⡀⠛⢎⠇⠀⣳⠚⠤⣇⡀⢸⣿⠀⠓⢷⠟⢄⠀⠸⡉⢸⡇⣿⠉⡏⢹⠉⡏⢹⠉⢹⠀⠀⠀⠲⠀⠑⢸⣿⠀⡆⡖⢣⢙⠃⣼⡷⠿⣷⣿⡇⢠⣿⡟⡜⠀⠀',
  '⠀⠀⠈⢿⣿⣌⢻⣿⣷⡀⠀⡀⠀⢹⡱⣄⢀⣅⢸⣿⠀⠀⢰⣆⠀⢰⠆⣇⢸⠇⣿⢸⡇⢸⠀⡇⢸⢀⠇⣶⠀⢠⡀⢣⠀⢸⣿⠀⡧⠇⠎⠻⠀⡔⠁⢊⡐⣯⢻⣦⣿⡿⠁⠀⠀',
  '⠀⠀⠀⠈⢿⡏⣡⣿⣿⣿⡄⠺⣇⠸⡁⣶⠟⢭⠈⣿⠀⠀⠘⠿⠀⢸⡷⠈⢺⠀⣿⢸⡇⢸⠀⡇⢸⠋⠰⡛⠀⠀⠁⠈⠀⢸⡟⢰⠶⠶⠇⡶⢀⢻⠓⢾⣗⠃⣸⣟⡿⠃⠀⠀⠀',
  '⠀⠀⠀⠀⠈⢻⡹⣿⣿⣯⡿⣄⠠⠄⢏⢠⠄⠲⡄⢻⣇⠀⢲⣒⠄⡤⣅⠐⠆⠑⢟⢸⡇⢸⢀⠗⠁⢀⠄⣴⣔⢖⠒⠓⢀⣿⢃⣄⣐⡖⣴⠁⡋⠈⣠⠏⢽⣷⠉⡿⠃⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠻⣿⣍⡛⢷⡝⢾⡂⠈⡇⢢⠷⠿⠌⢿⡄⠀⠤⣪⠔⢠⠀⡌⠂⠀⠙⠣⠞⠁⠀⠀⠀⢦⠀⠈⠓⠀⠀⣼⠏⠈⠉⡽⢡⠍⠚⢀⣾⡻⠅⣀⣴⡞⠁⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠘⢷⣍⠓⠿⢦⡀⠒⡘⡆⢶⣀⣴⣌⢻⣄⠀⠁⠀⠁⠘⠀⡴⠒⢢⡀⣴⠒⠒⣆⠀⠀⠁⠀⠀⢀⣼⠏⢾⡶⠶⢣⠌⠜⣡⣟⣡⠔⣂⣽⠋⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣿⣦⣉⠸⣿⡇⠈⢆⠫⠄⠀⠀⠙⢦⡀⠀⠀⠀⠀⡴⠖⠛⠀⠉⠒⠚⡿⠀⠀⠀⠀⣠⡾⠃⠀⠀⠱⡶⢈⣴⡾⣯⢌⣤⣾⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⣷⣿⣻⣷⠦⢑⡆⢀⣱⣦⡎⠙⠶⣄⡀⠀⠓⠒⠚⠀⠈⠒⠊⠁⢀⣠⡴⠞⢉⣶⡾⠥⣠⢎⠁⡊⠁⣸⣷⡿⠟⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⣿⣿⣧⣬⣿⣓⣆⠛⠉⠀⠠⣬⠍⢛⣲⡶⠶⢶⣶⡶⠶⢟⣿⢿⣂⠀⠈⣈⠡⢂⣌⣴⣾⣶⣿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠻⢿⣿⣿⣿⣿⣥⣤⡜⠃⠀⡿⠀⣽⠀⠋⣩⡿⠃⠘⢿⠄⣯⢄⣞⣥⡶⢿⣻⡿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠛⠻⠿⣿⣿⣿⣿⣶⣾⣦⡶⣾⠴⠿⠂⠚⠛⢛⣛⣩⡭⠶⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠙⠛⠛⠛⠛⠛⠛⠛⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
];
const RING_ART_COMPACT = [
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣀⣀⣀⣀⣀⣀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⣀⣠⣤⣴⣶⣶⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣶⣶⣶⣤⣤⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⢰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠿⠿⠿⢿⠿⣿⡟⣿⣛⣛⠛⣛⡿⠿⠿⠿⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⣄⠀⠀⠀⠀',
  '⠀⠀⢀⣤⣾⣿⠿⠿⠿⠛⠛⣛⠉⠉⠄⠖⡢⢔⡀⣴⣺⡿⢰⠛⢘⡍⠛⠛⠻⡟⠻⠿⣷⣥⡒⠶⡄⢬⢉⣉⢛⠛⠿⠿⠿⢿⣿⣯⡀⠀⠀⠀',
  '⠀⢠⣯⠞⣉⢛⠓⠶⢦⣤⠀⢡⣮⡤⠖⢩⣶⡿⢉⠩⠀⠀⠟⠳⢹⡇⠀⠀⠀⡟⠀⡞⢹⡍⠾⢗⣈⠃⣀⠖⠰⠈⠁⣀⣶⠶⠦⢾⣝⣦⡀⠀',
  '⢀⣿⡏⢰⠥⢋⠍⢓⠦⢉⠟⠉⠁⠂⣸⠿⠃⠀⢷⣎⠿⢂⢈⣀⣤⣦⣤⣄⣀⣉⠋⠰⢉⣇⠜⢨⡉⣥⡈⠙⠷⡶⢋⣡⠖⢂⣸⣿⣿⣹⣃⠀',
  '⣼⣿⣁⣤⢞⡩⠚⡩⠊⣁⡴⠲⢀⣾⢡⠞⣶⡤⠀⣠⡶⠛⠉⢡⡀⠀⠠⠄⠈⠉⠛⠶⣄⠁⢴⠋⣡⡦⢶⡄⠠⡈⠳⢍⠰⢿⢿⣾⣇⢀⣿⡄',
  '⣿⣿⣿⡆⠀⠔⣉⣴⡿⠋⡴⠀⣾⠁⠀⢻⠀⢠⡞⣫⣤⣤⠀⠁⠉⢲⣶⣾⠀⠀⣶⡦⠌⠳⣄⠰⠯⠤⢆⠳⠀⠠⠄⢀⣴⣷⡿⢿⣿⣿⣿⡇',
  '⢻⣿⣿⣧⣴⠿⠛⠁⠀⢸⠄⣸⣥⣠⡀⠀⣰⠏⠀⠰⢻⣿⠀⠀⢀⢻⡿⠏⡀⠀⣹⡟⠂⠀⠹⣦⠰⡶⠛⡞⢓⠐⡧⠎⠋⣿⠀⣬⣿⣿⣿⠃',
  '⠈⣻⣿⣿⡐⣾⣿⣶⡔⡠⢀⡧⣇⡞⡝⢰⡏⠈⠴⠀⠈⣩⠤⠤⠐⢊⠉⠒⠤⠉⡁⠁⠀⠄⠀⢹⡆⢑⣠⢴⢙⡂⠆⢸⠗⣣⣾⣿⣿⣿⣿⠀',
  '⠀⢻⠛⢿⣷⡘⠿⣿⢰⠁⢸⣦⣤⣬⠁⣿⠀⡆⣠⠀⠀⡅⠶⠀⠓⠘⠃⠘⠂⠶⢸⠀⠀⠀⠠⠀⣿⠈⡵⠼⢉⡃⠄⠉⠁⠀⠈⢹⣿⡟⠃⠀',
  '⠀⠈⢷⣾⢻⣿⣆⠙⠾⠄⢸⡞⠰⢤⠀⡟⠘⠹⠟⠂⠀⠃⢈⠁⡇⡏⢸⢸⠁⡇⠸⠀⠀⠐⠀⠁⣿⠀⣶⡞⣌⡃⢾⠚⠷⣿⡆⢸⣟⡌⠀⠀',
  '⠀⠀⠘⣿⡧⢹⣿⣦⠀⣤⠘⡎⣢⣴⠀⣷⠀⠀⣷⠀⢾⡘⣤⠀⡇⡇⢸⢸⠀⣧⢃⡇⠀⠆⠰⠀⣿⢀⣛⣈⢈⠁⣦⣈⣄⡟⢹⣿⡟⠀⠀⠀',
  '⠀⠀⠀⠈⢷⢾⣿⣿⣧⠘⡀⠓⢋⠈⡅⢻⡄⠠⡌⠀⣙⠁⡌⢠⡇⡇⢸⢸⡔⠁⡈⣠⣠⣤⠄⢠⡟⡈⠩⣍⡘⠐⠘⡨⢳⣦⢻⡞⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠈⢳⣯⣛⢯⡳⡖⠘⡆⠴⠾⠌⢷⡀⠨⣪⠆⡄⡀⠀⠀⠃⠜⠀⠀⠀⢢⠀⠑⠄⠀⣼⠁⠉⡝⡤⠑⢃⣾⠯⢀⣭⠞⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠙⣮⣙⠻⣄⣀⡘⣖⢦⠴⠌⢷⡀⠀⠀⠀⠀⠖⢑⡆⢰⡉⣱⠀⠀⠀⠀⢀⡾⠓⢷⠚⠱⢐⣡⢿⠔⣊⡼⠃⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠈⠻⣷⣬⣻⢧⣈⢠⡁⠀⣀⣙⢦⣀⠀⠀⠏⠉⠄⠠⠀⠼⠀⠀⣀⡴⣏⣠⠀⣀⠟⡴⠛⣿⣵⡾⠋⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠿⣿⣷⣐⣷⢮⠹⠓⠀⢨⡗⠲⣤⣤⣤⣤⣤⠤⣶⣿⠁⠀⠛⠫⢌⣃⣴⣧⣾⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⠻⢿⣿⣿⣧⣤⣞⣀⡼⠈⠇⠘⣩⡟⠀⣻⣄⣯⣰⣯⢶⣛⡿⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
  '⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠛⠛⠿⠿⠿⣿⣖⣛⣒⣋⣈⣭⠭⠭⠖⠚⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀',
];
function runRingCommand(term) {
  const termCols = term && typeof term.cols === 'number' ? term.cols : 0;
  const ringArt = termCols >= 75 ? RING_ART_WIDE : RING_ART_COMPACT;
  term.writeln(`${SITE_WHITE}${ANSI_RESET}`);
  for (const ringLine of ringArt) term.writeln(`${SITE_WHITE}${ringLine}${ANSI_RESET}`);
  term.writeln(`  ${SITE_WHITE}Ordered May 18, 2026 · picked up Oct 9, 2026${ANSI_RESET}`);
  term.writeln(`  ${SITE_WHITE}Texas A&M University · Class of 2029${ANSI_RESET}`);
  term.writeln(`  ${SITE_MUTED}Full story: /blog/aggie-ring/ (first post, publishing soon)${ANSI_RESET}`);
  return;
}

const COMMAND_REGISTRY = [
  {
    name: "whoami",
    aliases: [],
    aliasOf: null,
    plain: "Show the current terminal user",
    category: "CORE",
    argsSpec: "",
    examples: ["whoami"],
    helpDisplay: "whoami",
    helpDesc: "Display current user",
    helpPos: 1,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runWhoamiCommand,
  },
  {
    name: "hostname",
    aliases: [],
    aliasOf: null,
    plain: "Show the system hostname",
    category: "CORE",
    argsSpec: "",
    examples: ["hostname"],
    helpDisplay: "hostname",
    helpDesc: "Show system hostname",
    helpPos: 2,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runHostnameCommand,
  },
  {
    name: "date",
    aliases: [],
    aliasOf: null,
    plain: "Show the current date and time",
    category: "CORE",
    argsSpec: "",
    examples: ["date"],
    helpDisplay: "date",
    helpDesc: "Show current date/time",
    helpPos: 3,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runDateCommand,
  },
  {
    name: "uptime",
    aliases: [],
    aliasOf: null,
    plain: "Show how long this terminal session has been alive",
    category: "CORE",
    argsSpec: "",
    examples: ["uptime"],
    helpDisplay: "uptime",
    helpDesc: "Live session uptime",
    helpPos: 4,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runUptimeCommand,
  },
  {
    name: "uname",
    aliases: [],
    aliasOf: null,
    plain: "Print system information",
    category: "CORE",
    argsSpec: "[-a]",
    examples: ["uname", "uname -a"],
    helpDisplay: "uname [-a]",
    helpDesc: "Print system information",
    helpPos: 5,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runUnameCommand,
  },
  {
    name: "pwd",
    aliases: [],
    aliasOf: null,
    plain: "Print the working directory",
    category: "CORE",
    argsSpec: "",
    examples: ["pwd"],
    helpDisplay: "pwd",
    helpDesc: "Print working directory",
    helpPos: 6,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runPwdCommand,
  },
  {
    name: "cat",
    aliases: [],
    aliasOf: null,
    plain: "Display file contents",
    category: "CORE",
    argsSpec: "<file>",
    examples: ["cat about.txt", "cat resume.md"],
    helpDisplay: "cat <file>",
    helpDesc: "Display file contents",
    helpPos: 7,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runCatCommand,
  },
  {
    name: "ls",
    aliases: [],
    aliasOf: null,
    plain: "List directory contents",
    category: "CORE",
    argsSpec: "[path]",
    examples: ["ls", "ls links", "ls about.txt"],
    helpDisplay: "ls [path]",
    helpDesc: "List directory contents",
    helpPos: 8,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runLsCommand,
  },
  {
    name: "echo",
    aliases: [],
    aliasOf: null,
    plain: "Print text",
    category: "CORE",
    argsSpec: "<text>",
    examples: ["echo hello world"],
    helpDisplay: "echo <text>",
    helpDesc: "Print text",
    helpPos: 9,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runEchoCommand,
  },
  {
    name: "clear",
    aliases: [],
    aliasOf: null,
    plain: "Clear the terminal screen",
    category: "CORE",
    argsSpec: "",
    examples: ["clear"],
    helpDisplay: "clear",
    helpDesc: "Clear terminal",
    helpPos: 10,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runClearCommand,
  },
  {
    name: "neofetch",
    aliases: ["cv", "resfetch"],
    aliasOf: null,
    plain: "Display system and resume info",
    category: "CORE",
    argsSpec: "",
    examples: ["neofetch"],
    helpDisplay: "neofetch",
    helpDesc: "Display system & resume info",
    helpPos: 11,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: neofetch,
  },
  {
    name: "resfetch",
    aliases: [],
    aliasOf: "neofetch",
    plain: "Alias for neofetch",
    category: "CORE",
    argsSpec: "",
    examples: ["resfetch"],
    helpDisplay: "resfetch",
    helpDesc: "Alias for neofetch",
    helpPos: 14,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: neofetch,
  },
  {
    name: "about",
    aliases: [],
    aliasOf: null,
    plain: "Show a longer bio",
    category: "CORE",
    argsSpec: "",
    examples: ["about"],
    helpDisplay: "about",
    helpDesc: "Show a longer bio about me",
    helpPos: 12,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runAboutCommand,
  },
  {
    name: "fortune",
    aliases: [],
    aliasOf: null,
    plain: "Print a random programming quote",
    category: "CORE",
    argsSpec: "",
    examples: ["fortune"],
    helpDisplay: "fortune",
    helpDesc: "Random programming quote",
    helpPos: 15,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runFortuneCommand,
  },
  {
    name: "cowsay",
    aliases: [],
    aliasOf: null,
    plain: "Have the cow say your message",
    category: "CORE",
    argsSpec: "<message>",
    examples: ["cowsay hello world"],
    helpDisplay: "cowsay <msg>",
    helpDesc: "Cow says your message",
    helpPos: 16,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runCowsayCommand,
  },
  {
    name: "help",
    aliases: [],
    aliasOf: null,
    plain: "Show the command list",
    category: "CORE",
    argsSpec: "",
    examples: ["help"],
    helpDisplay: "help",
    helpDesc: "Show this help",
    helpPos: 32,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: helpText,
  },
  {
    name: "matrix",
    aliases: [],
    aliasOf: null,
    plain: "Toggle the matrix rain overlay",
    category: "CORE",
    argsSpec: "",
    examples: ["matrix"],
    helpDisplay: "matrix",
    helpDesc: "Toggle matrix rain overlay",
    helpPos: 17,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runMatrixCommand,
  },
  {
    name: "vm",
    aliases: [],
    aliasOf: null,
    plain: "Run Linux in your browser (5–15s to boot)",
    category: "ADDITIONAL",
    argsSpec: "",
    examples: ["vm"],
    helpDisplay: "vm",
    helpDesc: "Run Linux in your browser (5–15s to boot)",
    helpPos: 18,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runVmCommand,
  },
  {
    name: "ai",
    aliases: ["llm"],
    aliasOf: null,
    plain: "Portfolio AI assistant (Groq cloud default, local option)",
    category: "CORE",
    argsSpec: "<prompt>",
    examples: ["ai what did Devkumar research?", "ai status", "ai details", "ai sources pcpg analyzer", "ai web latest kernel news"],
    helpDisplay: "ai <prompt>",
    helpDesc: "Portfolio AI assistant (Groq/Local); ai status for backend",
    helpPos: 26,
    extraHelpRows: [["ai web <q>", "Live Web-augmented AI search"]],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: true,
    run: runAiCommand,
  },
  {
    name: "ai-models",
    aliases: [],
    aliasOf: null,
    plain: "List the available AI models",
    category: "CORE",
    argsSpec: "",
    examples: ["ai-models"],
    helpDisplay: "ai-models",
    helpDesc: "List AI models",
    helpPos: 29,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runAiModelsCommand,
  },
  {
    name: "ai-model",
    aliases: [],
    aliasOf: null,
    plain: "Switch the active AI model",
    category: "ADDITIONAL",
    argsSpec: "<id>",
    examples: ["ai-model 0", "ai-model 2"],
    helpDisplay: "ai-model <id>",
    helpDesc: "Switch AI model (0-5)",
    helpPos: 30,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runAiModelCommand,
  },
  {
    name: "ai-memory",
    aliases: [],
    aliasOf: null,
    plain: "Show and control AI assistant memory (on/off/clear/save/--json)",
    category: "ADDITIONAL",
    argsSpec: "[on|off|clear|save <fact>|--json]",
    examples: ["ai-memory", "ai-memory off", "ai-memory save prefers concise answers", "ai-memory --json"],
    helpDisplay: "ai-memory",
    helpDesc: "Show AI assistant conversation memory",
    helpPos: 31,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runAiMemoryCommand,
  },
  {
    name: "history",
    aliases: [],
    aliasOf: null,
    plain: "Show command history",
    category: "CORE",
    argsSpec: "",
    examples: ["history"],
    helpDisplay: "history",
    helpDesc: "Show command history",
    helpPos: 21,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runHistoryCommand,
  },
  {
    name: "crt",
    aliases: [],
    aliasOf: null,
    plain: "Toggle the CRT scanline overlay",
    category: "ADDITIONAL",
    argsSpec: "",
    examples: ["crt"],
    helpDisplay: "crt",
    helpDesc: "Toggle CRT scanline overlay",
    helpPos: 19,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runCrtCommand,
  },
  {
    name: "noise",
    aliases: [],
    aliasOf: null,
    plain: "Toggle the noise texture overlay",
    category: "ADDITIONAL",
    argsSpec: "",
    examples: ["noise"],
    helpDisplay: "noise",
    helpDesc: "Toggle noise texture overlay",
    helpPos: 20,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runNoiseCommand,
  },
  {
    name: "background",
    aliases: [],
    aliasOf: null,
    plain: "Set the background motion mode",
    category: "ADDITIONAL",
    argsSpec: "<mode>",
    examples: ["background", "background ambient", "background off"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runBackgroundCommand,
  },
  // Playground: lazy demos. Unlisted + no help row, so the 36/34 golden pins
  // stay byte-identical; it joins the documented UNLISTED_EXECUTABLE set.
  {
    name: "pg",
    aliases: [],
    aliasOf: null,
    plain: "Run a lazy-loaded playground demo (pg life)",
    category: "ADDITIONAL",
    argsSpec: "<demo>",
    examples: ["pg", "pg life"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runPgCommand,
  },
  {
    name: "imgcat",
    aliases: [],
    aliasOf: null,
    plain: "Render an image inline in the terminal (lazy @xterm/addon-image)",
    category: "ADDITIONAL",
    argsSpec: "[image]",
    examples: ["imgcat", "imgcat assets/imgcat-sample.png"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runImgcatCommand,
  },
  {
    name: "sparkline",
    aliases: [],
    aliasOf: null,
    plain: "Render a commit-activity sparkline (lightweight-charts over CDN)",
    category: "ADDITIONAL",
    argsSpec: "",
    examples: ["sparkline"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runSparklineCommand,
  },
  {
    name: "spark",
    aliases: [],
    aliasOf: null,
    plain: "Render commit activity inline (Unicode sparkline; `graph` = activity grid)",
    category: "ADDITIONAL",
    argsSpec: "[graph]",
    examples: ["spark", "spark graph"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runSparkCommand,
  },
  {
    name: "weather",
    aliases: [],
    aliasOf: null,
    plain: "Show local weather via geolocation and Open-Meteo",
    category: "CORE",
    argsSpec: "[-f] [city]",
    examples: ["weather", "weather -f"],
    helpDisplay: "weather [-f] [city]",
    helpDesc: "Geolocation-nominatim (ipapi fallback)-open-meteo (-f °F)",
    helpPos: 22,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: weatherCommand,
  },
  {
    name: "hn",
    aliases: [],
    aliasOf: null,
    plain: "Show Hacker News top stories",
    category: "CORE",
    argsSpec: "[number]",
    examples: ["hn", "hn 1"],
    helpDisplay: "hn",
    helpDesc: "Show Hacker News top stories",
    helpPos: 23,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: hnCommand,
  },
  {
    name: "md",
    aliases: [],
    aliasOf: null,
    plain: "Render markdown from a URL in a viewer overlay",
    category: "ADDITIONAL",
    argsSpec: "<url>",
    examples: ["md https://example.com/post.md"],
    helpDisplay: "md <url>",
    helpDesc: "Render markdown from URL",
    helpPos: 24,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: mdCommand,
  },
  {
    name: "wall",
    aliases: ["guestbook"],
    aliasOf: null,
    plain: "View or post on the global guestbook wall",
    category: "CORE",
    argsSpec: "[message]",
    examples: ["wall", "wall hello from the terminal!"],
    helpDisplay: "wall [msg]",
    helpDesc: "View/post on global guestbook wall",
    helpPos: 25,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: true,
    aiQueue: false,
    run: runWallCommand,
  },
  {
    name: "cv",
    aliases: [],
    aliasOf: "neofetch",
    plain: "Alias for neofetch",
    category: "CORE",
    argsSpec: "",
    examples: ["cv"],
    helpDisplay: "cv",
    helpDesc: "Alias for neofetch",
    helpPos: 13,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: neofetch,
  },
  {
    name: "search",
    aliases: ["google", "ddg"],
    aliasOf: null,
    plain: "Live web search via the Cloudflare Worker",
    category: "CORE",
    argsSpec: "<query>",
    examples: ["search terminal portfolios"],
    helpDisplay: "search <q>",
    helpDesc: "Live web search via Worker",
    helpPos: 27,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runSearchCommand,
  },
  {
    name: "google",
    aliases: [],
    aliasOf: "search",
    plain: "Alias for search",
    category: "CORE",
    argsSpec: "<query>",
    examples: ["google terminal portfolios"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runSearchCommand,
  },
  {
    name: "ddg",
    aliases: [],
    aliasOf: "search",
    plain: "Alias for search",
    category: "CORE",
    argsSpec: "<query>",
    examples: ["ddg terminal portfolios"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runSearchCommand,
  },
  {
    name: "myip",
    aliases: ["ping"],
    aliasOf: null,
    plain: "Show public IP, geo location and latency",
    category: "CORE",
    argsSpec: "",
    examples: ["myip", "ping"],
    helpDisplay: "myip",
    helpDesc: "Show public IP, geo location & latency",
    helpPos: 28,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runMyipCommand,
  },
  {
    name: "ping",
    aliases: [],
    aliasOf: "myip",
    plain: "Alias for myip",
    category: "CORE",
    argsSpec: "",
    examples: ["ping"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: true,
    allow: true,
    bareOnly: false,
    aiQueue: false,
    run: runMyipCommand,
  },
  {
    name: "devmode",
    aliases: [],
    aliasOf: null,
    plain: "Toggle the developer sidebar",
    category: "ADDITIONAL",
    argsSpec: "",
    examples: ["devmode"],
    helpDisplay: "devmode",
    helpDesc: "Toggle developer sidebar",
    helpPos: 33,
    extraHelpRows: [],
    listed: true,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runDevmodeCommand,
  },
  {
    name: "llm",
    aliases: [],
    aliasOf: "ai",
    plain: "Alias for ai",
    category: "CORE",
    argsSpec: "<prompt>",
    examples: ["llm what did Devkumar research?"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: true,
    run: runAiCommand,
  },
  {
    name: "guestbook",
    aliases: [],
    aliasOf: "wall",
    plain: "View or post on the global guestbook",
    category: "CORE",
    argsSpec: "[message]",
    examples: ["guestbook", "guestbook hello from the terminal!"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runWallCommand,
  },
  {
    name: "man",
    aliases: [],
    aliasOf: null,
    plain: "Show the manual page for a command",
    category: "CORE",
    argsSpec: "<command>",
    examples: ["man ai", "man wall"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runManCommand,
  },
  // WAVE 8 portfolio commands. Unlisted on purpose (like man/llm/guestbook)
  // so `help` output and the COMMANDS count stay byte-identical to the
  // goldens; the palette, tab completion and `man` pick them up from the
  // registry automatically.
  {
    name: "projects",
    aliases: [],
    aliasOf: null,
    plain: "Browse projects",
    category: "CORE",
    argsSpec: "[filter] [--json]",
    examples: ["projects", "projects python", "projects --json"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runProjectsCommand,
  },
  {
    name: "case",
    aliases: [],
    aliasOf: null,
    plain: "Read a project case study",
    category: "CORE",
    argsSpec: "<name>",
    examples: ["case pcpg", "case aggiemap"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runCaseCommand,
  },
  {
    name: "skills",
    aliases: [],
    aliasOf: null,
    plain: "Show technical skills",
    category: "CORE",
    argsSpec: "",
    examples: ["skills"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runSkillsCommand,
  },
  {
    name: "timeline",
    aliases: [],
    aliasOf: null,
    plain: "Show career timeline",
    category: "CORE",
    argsSpec: "",
    examples: ["timeline"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runTimelineCommand,
  },
  {
    name: "export",
    aliases: [],
    aliasOf: null,
    plain: "Save command output to a file",
    category: "ADDITIONAL",
    argsSpec: "<command>",
    examples: ["export neofetch", "export projects --json"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runExportCommand,
  },
  // PR1 client/build introspection. Unlisted on purpose (like the WAVE 8
  // portfolio set) so `help` output and the COMMANDS count stay
  // byte-identical to the goldens; the palette, tab completion and `man`
  // pick them up from the registry automatically. `dmesg` shares the
  // changelog run (dmesg-style view of the same build metadata).
  {
    name: "host",
    aliases: [],
    aliasOf: null,
    plain: "Show client hardware and browser info",
    category: "CORE",
    argsSpec: "",
    examples: ["host"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runHostCommand,
  },
  {
    name: "changelog",
    aliases: ["dmesg"],
    aliasOf: null,
    plain: "Show the deployed build metadata",
    category: "CORE",
    argsSpec: "",
    examples: ["changelog", "dmesg"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runChangelogCommand,
  },
  {
    name: "dmesg",
    aliases: [],
    aliasOf: "changelog",
    plain: "Alias for changelog",
    category: "CORE",
    argsSpec: "",
    examples: ["dmesg"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runChangelogCommand,
  },
  {
    name: "ring",
    aliases: [],
    aliasOf: null,
    plain: "Show the Aggie Ring milestone (first blog post, publishing soon)",
    category: "CORE",
    argsSpec: "",
    examples: ["ring"],
    helpDisplay: null,
    helpDesc: null,
    helpPos: null,
    extraHelpRows: [],
    listed: false,
    allow: false,
    bareOnly: false,
    aiQueue: false,
    run: runRingCommand,
  },
];

// gh-CLI style manual renderer: NAME / CATEGORY / USAGE / EXAMPLES.
function renderMan(term, target) {
  const query = String(target ?? '').trim();
  if (!query) {
    term.writeln(`${SITE_ERR}man: missing command${ANSI_RESET}`);
    term.writeln(`${SITE_MUTED}Next: run \`man <command>\`, e.g. \`man ai\`${ANSI_RESET}`);
    return;
  }
  const entry = resolveCommand(query);
  if (!entry) {
    const suggestion = suggestCommand(query.toLowerCase());
    term.writeln(`${SITE_ERR}man: no entry for ${query}${ANSI_RESET}`);
    if (suggestion) {
      term.writeln(`${SITE_MUTED}Did you mean \`${SITE_WHITE}${suggestion}${SITE_MUTED}\`?${ANSI_RESET}`);
    }
    term.writeln(`${SITE_MUTED}Next: type \`help\` for the full command list${ANSI_RESET}`);
    return;
  }
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}${entry.name}${ANSI_RESET}${SITE_MUTED} — ${ANSI_RESET}${SITE_WHITE}${entry.plain}${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}CATEGORY${ANSI_RESET}  ${SITE_WHITE}${entry.category}${ANSI_RESET}`);
  if (entry.aliasOf) {
    term.writeln(`  ${SITE_LABEL}ALIAS OF${ANSI_RESET}  ${SITE_WHITE}${entry.aliasOf}${ANSI_RESET}`);
  } else if (entry.aliases.length > 0) {
    term.writeln(`  ${SITE_LABEL}ALIASES${ANSI_RESET}   ${SITE_WHITE}${entry.aliases.join(' · ')}${ANSI_RESET}`);
  }
  const usageSpec = entry.argsSpec ? `${entry.name} ${entry.argsSpec}` : entry.name;
  term.writeln(`  ${SITE_LABEL}USAGE${ANSI_RESET}      ${SITE_WHITE}${usageSpec}${ANSI_RESET}`);
  term.writeln(`  ${SITE_LABEL}EXAMPLES${ANSI_RESET}`);
  for (const example of entry.examples) {
    term.writeln(`    ${SITE_FAINT}$${ANSI_RESET} ${SITE_WHITE}${example}${ANSI_RESET}`);
  }
  if (entry.aliasOf) {
    term.writeln(`  ${SITE_MUTED}See also: man ${entry.aliasOf}${ANSI_RESET}`);
  }
}

function runManCommand(term, args) {
  renderMan(term, args[0] ?? '');
}

const COMMANDS = COMMAND_REGISTRY.filter((entry) => entry.listed).map((entry) => entry.name);

// Help rendering lives below the registry/COMMANDS definitions (JS-0129):
// both run only after module init, and `function` declarations hoist, so the
// `run: helpText` reference inside the literal above stays valid.
function commandCount() {
  return COMMANDS.length;
}

function helpText(term) {
  term.writeln(`${ANSI_BOLD}${SITE_WHITE}Available commands (${commandCount()})${ANSI_RESET}`);
  term.writeln(`${SITE_MUTED}────────────────────${ANSI_RESET}`);
  const rows = COMMAND_REGISTRY.filter((entry) => entry.helpDisplay !== null);
  rows.sort((first, second) => first.helpPos - second.helpPos);
  for (const entry of rows) {
    term.writeln(`  ${SITE_GREEN}${entry.helpDisplay.padEnd(14)}${ANSI_RESET}${SITE_WHITE}${entry.helpDesc}${ANSI_RESET}`);
    for (const extraRow of entry.extraHelpRows) {
      term.writeln(`  ${SITE_GREEN}${extraRow[0].padEnd(14)}${ANSI_RESET}${SITE_WHITE}${extraRow[1]}${ANSI_RESET}`);
    }
  }
}

const COMMAND_COMPLETION_NAMES = [
  ...COMMANDS,
  ...COMMAND_REGISTRY.filter((entry) => !entry.listed).map((entry) => entry.name),
];

const TOOL_ALLOWLIST_NAMES = COMMAND_REGISTRY.filter((entry) => entry.allow).map((entry) => entry.name);

const TOOL_ALLOWLIST_BARE_ONLY = COMMAND_REGISTRY.filter((entry) => entry.bareOnly).map((entry) => entry.name);

function resolveCommand(nameText) {
  const key = String(nameText).toLowerCase();
  for (const entry of COMMAND_REGISTRY) {
    if (entry.name === key) return entry;
  }
  for (const entry of COMMAND_REGISTRY) {
    if (entry.aliases.includes(key)) return entry;
  }
  return null;
}

function suggestCommand(input) {
  let best = null;
  let bestDist = Infinity;
  for (const candidate of COMMAND_COMPLETION_NAMES) {
    const dist = levenshtein(input, candidate);
    if (dist < bestDist && dist <= 2) { bestDist = dist; best = candidate; }
  }
  return best;
}

function isAiCommandName(commandName) {
  const entry = resolveCommand(commandName);
  return entry !== null && entry.aiQueue === true;
}

export {
  ASCII_ART, vfs, RESUME, CMD_HISTORY, SHOW_TERMINAL_ART, neofetch, uptimeStr,
  stopLiveUptime, startLiveUptimeBelow,
  ansiRGB, stripAnsi, ANSI_RESET, ANSI_BOLD, SITE_GREEN, SITE_CYAN, SITE_WHITE,
  SITE_BLUE, SITE_MUTED, SITE_OK, SITE_ERR, SITE_LABEL, SITE_FAINT, COMMANDS,
  BOOT_SCRIPT, TERMINAL_HOST_FALLBACK, getTerminalHost, setTerminalHost,
  COMMAND_REGISTRY, resolveCommand, suggestCommand, tokenizeCommandLine,
  COMMAND_COMPLETION_NAMES, TOOL_ALLOWLIST_NAMES, TOOL_ALLOWLIST_BARE_ONLY,
  NEOFETCH_TRY_COMMANDS, isAiCommandName, renderMan, setPrefetchedLocation,
  getPrefetchedCity,
  commandCount, helpText, recordCommandOutput, readLastCommandOutput,
  formatWallMoniker,
};

// Runnable check: `node js/commands.js` verifies the uptime math (split,
// future clamp, deploy-epoch parse, invalid-date fallback). Entry-point only,
// so importers never hit it.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('commands.js')) {
  const checkEpoch = Date.now() - ((2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000);
  if (uptimeStr(checkEpoch) !== '2 days, 3 hours, 4 minutes, 5 seconds') throw new Error(`uptime split wrong: ${uptimeStr(checkEpoch)}`);
  if (uptimeStr(Date.now() + 60000) !== '0 days, 0 hours, 0 minutes, 0 seconds') throw new Error('uptime future epoch not clamped');
  cachedBuildInfo = { sha: 'abc123456789', run_number: 7, built_at: '2026-01-02T03:04:05Z' };
  if (uptimeEpochMillis() !== Date.parse('2026-01-02T03:04:05Z')) throw new Error('uptime deploy epoch not parsed');
  cachedBuildInfo = { sha: 'abc123456789', built_at: 'not-a-date' };
  if (uptimeEpochMillis() !== pageLoadTime) throw new Error('uptime invalid built_at did not fall back');
  cachedBuildInfo = null;
  process.stdout.write('commands uptime self-check ok\n');
}
