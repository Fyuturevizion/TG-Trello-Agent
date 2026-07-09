/** Detect keeper requests to register the current chat for dojo work. */
export function isAllowQaChannelRequest(rest: string): boolean {
  const normalized = rest.trim().toLowerCase();
  if (
    normalized === 'allow-qa' ||
    normalized === 'qa-add' ||
    normalized === 'qa allow' ||
    normalized === 'allow-content' ||
    normalized === 'content-add' ||
    normalized === 'allow channel'
  ) {
    return true;
  }
  if (/add.*(this )?channel.*qa/i.test(rest)) return true;
  if (/qa channel allow/i.test(rest)) return true;
  if (/add.*to.*qa.*allow/i.test(rest)) return true;
  if (/add.*channel.*allowance/i.test(rest)) return true;
  if (/add.*(this )?channel.*content/i.test(rest)) return true;
  if (/content channel allow/i.test(rest)) return true;
  return false;
}
