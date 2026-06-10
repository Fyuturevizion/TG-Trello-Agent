import { miniAppWebButton } from '../mini-app-buttons';
import { parseQaChatIds } from '../qa-chats';
import { escapeHtml } from '../telegram-format';
import { sendMessage } from '../telegram';
import { productListLabel } from './lists';
import { phaseGoal, getProductDefinition } from './catalog';
import type { ActiveProductCampaign } from './types';
import type { Env } from '../types';

export function productFeedbackKeyboard(env: Env, label: string, slug: string) {
  return {
    inline_keyboard: [[miniAppWebButton(env, `Feedback: ${label}`, { product: slug })]],
  };
}

export async function announceProductPhase(
  env: Env,
  campaign: ActiveProductCampaign,
): Promise<void> {
  const chatIds = parseQaChatIds(env);
  if (chatIds.length === 0) return;

  const def = getProductDefinition(campaign.slug);
  const goal = def ? phaseGoal(def, campaign.phase) : undefined;
  const listLine = productListLabel(env, campaign.phase);
  const lines = [
    `<b>Product QA opened</b> · ${escapeHtml(campaign.label)}`,
    `<b>Phase ${campaign.phase}</b>${goal ? ` · ${escapeHtml(goal.title)}` : ''}`,
    '',
  ];
  if (goal?.goal) {
    lines.push(escapeHtml(goal.goal), '');
  }
  lines.push(
    `<b>Queue:</b> ${escapeHtml(listLine)}`,
    '',
    'Reporters: tap the button below or send <code>/product</code> to submit feedback on this build.',
  );

  const keyboard = productFeedbackKeyboard(env, campaign.label, campaign.slug);

  for (const chatId of chatIds) {
    await sendMessage(env, chatId, lines.join('\n'), {
      parseMode: 'HTML',
      replyMarkup: keyboard,
    });
  }
}
