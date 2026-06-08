import { getProductDefinition, phaseGoal } from '../product/catalog';
import { loadActiveProductCampaign } from '../product/store';
import type { Env } from '../types';

export async function handleProductContext(
  env: Env,
  slug?: string,
): Promise<
  | {
      ok: true;
      slug: string;
      label: string;
      phase: number;
      phaseTitle?: string;
      phaseGoal?: string;
      featureAreas: { id: string; label: string }[];
    }
  | { ok: false; error: string }
> {
  const active = await loadActiveProductCampaign(env);
  if (!active) {
    return { ok: false, error: 'No product QA campaign is open' };
  }

  const requested = slug?.trim().toLowerCase();
  if (requested && requested !== active.slug) {
    return { ok: false, error: `Only ${active.label} is open for feedback` };
  }

  const def = getProductDefinition(active.slug);
  if (!def) {
    return { ok: false, error: 'Product definition missing' };
  }

  const goal = phaseGoal(def, active.phase);
  return {
    ok: true,
    slug: active.slug,
    label: active.label,
    phase: active.phase,
    phaseTitle: goal?.title,
    phaseGoal: goal?.goal,
    featureAreas: def.featureAreas.map((a) => ({ id: a.id, label: a.label })),
  };
}
