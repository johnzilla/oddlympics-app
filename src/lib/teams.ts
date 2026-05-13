import teams from '../../references/teams.json' with { type: 'json' };

export type TeamEntry = {
  slug: string;
  label: string;
  confederation: 'UEFA' | 'CONMEBOL' | 'CONCACAF' | 'CAF' | 'AFC' | 'OFC';
};

export const TEAMS: readonly TeamEntry[] = teams as TeamEntry[];
export const VALID_TEAMS: ReadonlySet<string> = new Set(TEAMS.map((t) => t.slug));

export function isValidTeamSlug(slug: string): boolean {
  return VALID_TEAMS.has(slug);
}
