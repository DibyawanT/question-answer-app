/**
 * The XAT mandala: goal → 8 sections → 64 topics → 512 concepts, 8 children at every level.
 * Topic lines are "Name [bank-topic]: concept | concept | …"; the bank topic (if any) is the
 * question-bank topic whose study set quizzes every concept under it.
 */
const TREE = `
# Decision Making
Ethical dilemmas [ethics]: Honesty vs loyalty | Whistleblowing | Conflict of interest | Fairness vs efficiency | Rules vs compassion | Short-term vs long-term good | Corporate social responsibility | Least-harm choice
Business situations [business-strategy]: Pricing decisions | Market entry & exit | Cost cutting vs quality | Vendor & supplier choice | Crisis response | Product launch trade-offs | Partnership & negotiation | Brand & reputation risk
HR & people conflicts [hr-people]: Hiring & selection | Layoffs & downsizing | Performance appraisal | Promotion disputes | Team conflict resolution | Complaint & harassment handling | Motivation & incentives | Manager–subordinate trust
Stakeholder analysis [stakeholder-conflict]: Listing all stakeholders | Primary vs secondary | Interest & power mapping | Shareholders vs society | Employee interests | Customer interests | Government & regulators | Win-win solutions
Data-based allocation [operations-math]: Resource allocation | Budget constraints | Scheduling with rules | Ranking & selection | Cost minimisation | Profit maximisation | Tabular condition sets | Multi-constraint checks
Rule-based cases [operations-math]: Reading eligibility criteria | Exceptions & waivers | Applying rules to candidates | Conflicting rules | Missing-data cases | Referral to authority | Step-by-step filtering | Edge-case traps
Best course of action [stakeholder-conflict]: Immediate vs long-term action | Proportional response | Escalation ladder | Reversible vs irreversible | Root cause vs symptom | Communicate first | Most vs least appropriate | Ranking actions
Option elimination [ethics]: Extreme options | Illegal or unethical options | Out-of-scope options | Assumption-heavy options | Partially correct options | Do-nothing options | Over-reaction options | Choosing between last two
# Reading Comprehension
Philosophy & abstract [reading-comprehension]: Existentialism basics | Ethics & morality | Theory of knowledge | Aesthetics & art theory | Eastern philosophy | Free will vs determinism | Language & meaning | Dense abstract prose
Economics & business [reading-comprehension]: Markets & demand | Inflation & monetary policy | Globalisation & trade | Behavioural economics | Corporate strategy | Inequality & development | Innovation & disruption | Policy arguments
Science & technology [reading-comprehension]: Evolution & biology | Neuroscience & psychology | Climate & environment | AI & tech ethics | Physics & cosmology | Medicine & public health | Research-method passages | Decoding jargon
Main idea [reading-comprehension]: Central theme | Primary purpose | Best title | Argument structure | Role of a paragraph | Summary questions | Topic vs scope | Too broad vs too narrow
Inference [reading-comprehension]: Implied meaning | Must be true | Could vs must be true | Author would agree | Applying to a new case | Logical consequence | Inference from examples | No outside knowledge
Tone & author's view [reading-comprehension]: Critical tone | Appreciative tone | Sarcastic or ironic tone | Neutral tone | Ambivalent tone | Author vs others' views | Tone vocabulary | Evidence for tone
Arguments within RC [critical-reasoning]: Locating the claim | Locating evidence | Strengthen | Weaken | Hidden assumption | Analogous reasoning | Resolving a paradox | Evaluating the argument
Reading habit [reading-comprehension]: Daily newspaper editorial | Long-form essays | One-line summaries | Timed reading drills | Reading speed (wpm) | Main idea per paragraph | Unfamiliar topics weekly | Weekly RC set review
# Verbal & Critical Reasoning
Para jumbles [para-jumble]: Opening sentence clues | Closing sentence clues | Pronoun links | Connector words | Chronological order | General to specific | Mandatory pairs | Option elimination
Odd sentence out [odd-sentence]: Theme mismatch | Tone mismatch | Scope shift | Pair linking | Partial-fit distractors | Chronology break | Finding the core group | Re-reading the full paragraph
Para completion: Flow of argument | Concluding sentence | Filling a middle gap | Tone continuity | No new information | Keyword traps | Logical next step | Comparing options
Critical reasoning [critical-reasoning]: Premise & conclusion | Assumption | Strengthen | Weaken | Inference | Flaw | Paradox & discrepancy | Evaluate the argument
Vocabulary in context [vocab-usage]: Root words | Prefixes & suffixes | Confusing word pairs | Contextual meaning | Synonyms & antonyms | Idioms & phrases | Phrasal verbs | Daily word list
Grammar [fill-in-blank]: Subject-verb agreement | Tenses | Modifiers | Parallelism | Pronouns | Prepositions | Articles | Redundancy
Poems & quotes [poem]: Literal vs figurative | Metaphor & imagery | Theme of the poem | Poet's tone | Paraphrasing a quote | Symbolism | Irony & paradox | Eliminating by theme
Word usage [vocab-usage]: One word, many meanings | Single-blank fill-ins | Double-blank fill-ins | Collocations | Correct usage in a sentence | Analogies | Misuse traps | Formal vs informal register
# Arithmetic
Percentages [arithmetic]: Fraction–percent table | Percentage change | Successive changes | Change of base | Growth & decay | Price × consumption | Elections & votes | Points vs percent
Profit & loss [arithmetic]: Cost, selling & marked price | Profit & loss % | Discounts | Successive discounts | Faulty weights | Markup | Buy x get y free | Dishonest dealer
Interest [arithmetic]: Simple interest | Compound interest | Half-yearly & quarterly | CI minus SI | Instalments (EMI) | Effective annual rate | Depreciation | Doubling time
Ratio & proportion [arithmetic]: Ratio basics | Compounded ratios | Direct & inverse proportion | Variation | Componendo-dividendo | Age problems | Partnership | Dividing money
Mixtures & alligation [arithmetic]: Weighted average | Alligation rule | Mixing two solutions | Repeated replacement | Milk & water | Three-way mixtures | Price of a mixture | Concentration %
Averages [arithmetic]: Simple average | Weighted average | Adding or removing items | Average speed | Deviation method | Consecutive numbers | Runs & innings | Age averages
Time & work [arithmetic]: Unit-work method | Efficiency | Combined work | Work & wages | Pipes & cisterns | Alternate days | Man-days formula | Leaks & negative work
Time, speed & distance [arithmetic]: Speed basics | Relative speed | Trains | Boats & streams | Races & head starts | Circular tracks | Meeting points | Clocks
# Algebra & Numbers
Equations [algebra]: Linear in two or three variables | Roots of a quadratic | Sum & product of roots | Discriminant | Forming equations | Word problems | Max & min of a quadratic | Integer solutions
Inequalities & modulus [algebra]: Linear inequalities | Quadratic inequalities | Wavy-curve method | AM-GM inequality | Modulus basics | Modulus equations | Modulus graphs | Range of expressions
Functions & graphs [algebra]: Domain & range | Composite functions | Inverse functions | Even & odd functions | Graph transformations | Max & min functions | Greatest integer function | Functional equations
Logarithms [algebra]: Definition | Product & quotient rules | Power rule | Change of base | Log equations | Log inequalities | Number of digits | Comparing logs
Progressions [algebra]: AP nth term | AP sum | GP term & sum | Infinite GP | Harmonic progression | AM ≥ GM ≥ HM | Sums of n, n², n³ | Arithmetico-geometric series
Remainders & divisibility [number-system]: Divisibility rules | Remainder theorem | Last-digit cyclicity | Euler & Fermat | Negative remainders | Factorial remainders | Chinese remainder idea | Highest power in n!
Factors, HCF & LCM [number-system]: Prime factorisation | Number of factors | Sum of factors | HCF & LCM rules | HCF & LCM word problems | Co-primes | Trailing zeros | Odd, even & square factors
Indices & surds [number-system]: Laws of exponents | Comparing powers | Simplifying surds | Rationalising | Square roots of surds | Exponential equations | Unit digit of powers | Last two digits
# Geometry & Modern Maths
Triangles & circles [geometry]: Triangle properties | Similarity & congruence | Pythagorean triplets | Centroid, incentre, circumcentre | Circle theorems | Tangents & chords | Inscribed & circumscribed | Heron's formula
Polygons [geometry]: Interior & exterior angles | Parallelograms | Rhombus & rectangle | Trapezium | Regular hexagon | Number of diagonals | Polygon areas | Cyclic quadrilaterals
Mensuration [geometry]: Cube & cuboid | Cylinder | Cone & frustum | Sphere & hemisphere | Prism & pyramid | Surface area | Unit conversions | Melting & recasting
Coordinate geometry [geometry]: Distance & section formula | Slope & line equations | Parallel & perpendicular lines | Area of a triangle | Point-to-line distance | Circle equation | Intercepts | Reflection & locus
Trigonometry [geometry]: Ratios & identities | Standard angles | Heights & distances | Elevation & depression | Max & min of expressions | Sine & cosine rules | Trig in triangles | Signs by quadrant
Permutations & combinations [probability]: Counting principle | Permutations | Combinations | Circular arrangements | Identical objects | Distributing objects | Derangements | Rank of a word
Probability [probability]: Classical probability | Addition rule | Multiplication rule | Conditional probability | Independent events | Dice & coins | Playing cards | Expected value & odds
Sets & Venn diagrams: Set notation | Union & intersection | Two-set Venn | Three-set Venn | Max & min overlaps | Exactly one / exactly two | Neither cases | Set word problems
# DI & LR
Tables [data-interpretation]: Large tables | Percent calculations | Growth rates | Ratio comparisons | Missing values | Totals & averages | Linking two tables | Unit traps
Charts [data-interpretation]: Bar charts | Line charts | Pie charts | Stacked bars | Scatter plots | Combination charts | Reading scales | Pie angle to percent
Caselets [data-interpretation]: Text to table | Setting up variables | Conditional information | Case-based percentages | Multiple scenarios | Consistency checks | Partial information | Time-boxing a set
Data sufficiency [data-interpretation]: The five answer options | Statement I alone | Statement II alone | Both together | Neither is enough | Number-property DS | Geometry DS | Don't solve fully
Arrangements: Linear | Circular | Two rows facing | Floors & buildings | Ranking & order | Matrix grids | Conditional cases | Case branching
Scheduling puzzles: Days of the week | Meeting slots | Task sequencing | Selection with conditions | Team formation | Tournaments | Games & points | Grid puzzles
Logic puzzles: Max-min puzzles | Number puzzles | Weighing & balances | Routes & networks | Cubes & dice | Truth-tellers & liars | Quant-logic hybrids | Selection puzzles
Calculation speed: Squares to 30 | Cubes to 15 | Fractions to 1/20 | Multiplication shortcuts | Approximation | Percent estimation | Comparing fractions | Mental division
# GK & Exam Strategy
Current affairs [international]: National news | International news | Science & tech news | Environment | Defence | Government schemes | Summits & treaties | Books & obituaries
Business & economy [economy]: Union Budget | RBI & monetary policy | Mergers & acquisitions | Startups & unicorns | CEOs & appointments | Indices & rankings | Brand taglines | Economic terms
Static GK [polity]: Indian history | World history | Geography | Indian polity | Constitution | International bodies | Art & culture | Firsts & superlatives
Awards & sports [awards]: Nobel prizes | Bharat Ratna & Padma | Literary awards | Film awards | Sports events & winners | Sports terms | Key appointments | Books & authors
Sectional mocks: Decision Making sets | Verbal sets | Quant & DI sets | Time per section | Accuracy log | Topic-wise tests | Previous-year papers | Weekly review
Full mocks: Mock calendar | Score log | Error log | Question-selection review | Re-attempt skipped ones | Compare with toppers | Fix two weak topics | Stamina check
Negative marking: Minus 0.25 per wrong | Penalty for skips beyond 8 | Expected value of guessing | Guess after eliminating two | When to skip | Attempt target | Accuracy vs attempts | Final-minute strategy
Time management: Section order | Two-pass approach | Two-minute rule | Skip hard ones early | Review buffer | Exam-day routine | Sleep & mock timing | Staying calm
`

export type MNode = { id: string; code: string; name: string; bank?: string; parent?: MNode; children: MNode[]; leaves: number }
export type MandalaDone = Record<string, { at: string; score: string }>

const node = (name: string, parent?: MNode, bank?: string): MNode => {
  const path = parent ? [...(parent.code ? parent.code.split('.') : []), String(parent.children.length + 1)] : []
  const n: MNode = { id: path.join('-'), code: path.join('.'), name, bank, parent, children: [], leaves: 1 }
  parent?.children.push(n)
  return n
}

export const ROOT = node('XAT 95+ %ile')
for (const line of TREE.split('\n').filter(Boolean)) {
  if (line.startsWith('# ')) { node(line.slice(2), ROOT); continue }
  const [head, rest] = line.split(': ')
  const m = head.match(/^(.*?)(?: \[([a-z-]+)\])?$/)!
  const section = ROOT.children.at(-1)!
  const topic = node(m[1], section, m[2])
  for (const c of rest.split(' | ')) node(c, topic, m[2])
}
;(function count(n: MNode): number {
  return (n.leaves = n.children.length ? n.children.reduce((a, c) => a + count(c), 0) : 1)
})(ROOT)

export const byId = new Map<string, MNode>()
;(function index(n: MNode) { byId.set(n.id, n); n.children.forEach(index) })(ROOT)

/** Concepts done under n (n itself if it is a concept). n is green when this equals n.leaves. */
export const doneCount = (n: MNode, done: MandalaDone): number =>
  n.children.length ? n.children.reduce((a, c) => a + doneCount(c, done), 0) : done[n.id] ? 1 : 0

/** Right answers needed to pass a study set: 4 of 5 (80%, rounded up). */
export const passMark = (total: number) => Math.ceil(total * 0.8)
