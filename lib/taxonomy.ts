// The full official SAT (Digital) taxonomy: Test -> Domain -> Skills.
// Used both for building the practice filters and for parsing the domain
// out of the PDF metadata line.

export interface DomainDef {
  domain: string;
  skills: string[];
}

export interface TestDef {
  test: string;
  domains: DomainDef[];
}

export const TAXONOMY: TestDef[] = [
  {
    test: "Reading and Writing",
    domains: [
      {
        domain: "Information and Ideas",
        skills: ["Central Ideas and Details", "Inferences", "Command of Evidence"],
      },
      {
        domain: "Craft and Structure",
        skills: ["Words in Context", "Text Structure and Purpose", "Cross-Text Connections"],
      },
      {
        domain: "Expression of Ideas",
        skills: ["Rhetorical Synthesis", "Transitions"],
      },
      {
        domain: "Standard English Conventions",
        skills: ["Boundaries", "Form, Structure, and Sense"],
      },
    ],
  },
  {
    test: "Math",
    domains: [
      {
        domain: "Algebra",
        skills: [
          "Linear equations in one variable",
          "Linear equations in two variables",
          "Linear functions",
          "Systems of two linear equations in two variables",
          "Linear inequalities in one or two variables",
        ],
      },
      {
        domain: "Advanced Math",
        skills: [
          "Equivalent expressions",
          "Nonlinear equations in one variable and systems of equations in two variables",
          "Nonlinear functions",
        ],
      },
      {
        domain: "Problem-Solving and Data Analysis",
        skills: [
          "Ratios, rates, proportional relationships, and units",
          "Percentages",
          "One-variable data: distributions and measures of center and spread",
          "Two-variable data: models and scatterplots",
          "Probability and conditional probability",
          "Inference from sample statistics and margin of error",
          "Evaluating statistical claims: observational studies and experiments",
        ],
      },
      {
        domain: "Geometry and Trigonometry",
        skills: [
          "Area and volume",
          "Lines, angles, and triangles",
          "Right triangles and trigonometry",
          "Circles",
        ],
      },
    ],
  },
];

export const TESTS = TAXONOMY.map((t) => t.test);

export const DOMAINS = TAXONOMY.flatMap((t) => t.domains.map((d) => d.domain));

export const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;

export function domainsForTest(test: string): string[] {
  return TAXONOMY.find((t) => t.test === test)?.domains.map((d) => d.domain) ?? [];
}

export function skillsForDomain(test: string, domain: string): string[] {
  return (
    TAXONOMY.find((t) => t.test === test)?.domains.find((d) => d.domain === domain)?.skills ?? []
  );
}

export const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Medium: "bg-amber-100 text-amber-800 border-amber-200",
  Hard: "bg-rose-100 text-rose-800 border-rose-200",
};
