// Everything you are likely to tweak lives here.
export const config = {
  // Gmail search. Label "Job Alerts" becomes label:job-alerts in Gmail queries.
  gmailQuery:
    'newer_than:2d (label:job-alerts OR from:linkedin.com OR from:indeed.com OR from:naukri.com)',
  minScore: 0.35, // hide anything scoring below this
  topN: 20, // max jobs in the digest

  // Titles/keywords that disqualify a job outright.
  exclude:
    /\b(intern|internship|trainee|fresher|manager|principal|director|head of|vp|qa|test engineer|sdet|data scientist|android|ios|devops|salesforce|sap)\b/i,

  // Location fit: matches Hyderabad or remote variants.
  locationOk: /\b(hyderabad|telangana|remote|work from home|wfh|anywhere)\b/i,
};

// Skill name -> regex that detects it in title/snippet text.
export const CORE_SKILLS: Record<string, RegExp> = {
  React: /\breact(\.?js)?\b/i,
  Node: /\bnode(\.?js)?\b/i,
  NestJS: /\bnest\.?js\b/i,
  Express: /\bexpress(\.?js)?\b/i,
  TypeScript: /\btypescript\b|\bts\b/i,
  JavaScript: /\bjavascript\b|\bjs\b/i,
  PostgreSQL: /\bpostgres(ql)?\b/i,
  GraphQL: /\bgraphql\b/i,
  AWS: /\baws\b|\bamazon web services\b/i,
  Redux: /\bredux\b/i,
  Microservices: /\bmicro[\s-]?services?\b/i,
  REST: /\brest(ful)?\b|\bapis?\b/i,
};

export const BONUS_SKILLS: Record<string, RegExp> = {
  AI: /\b(ai|llm|genai|generative ai|claude|copilot|cursor)\b/i,
  'HTML/CSS': /\bhtml5?\b|\bcss3?\b/i,
  'Spec-driven': /\bspec[\s-]?driven\b/i,
};

// Title fit: strong = exactly your target roles, medium = adjacent.
export const TITLE_STRONG =
  /\b(software (engineer|developer)|sde|full[\s-]?stack|fullstack|mern)\b/i;
export const TITLE_MEDIUM =
  /\b(react|node(\.?js)?|nest(\.?js)?|front[\s-]?end|back[\s-]?end|web|javascript|typescript)\b.*\b(engineer|developer)\b/i;
