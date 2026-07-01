/** Detect admin requests to register the current chat for QA triage updates. */
export function isAllowQaChannelRequest(rest: string): boolean {
  const normalized = rest.trim().toLowerCase();
  if (normalized === 'allow-qa' || normalized === 'qa-add' || normalized === 'qa allow') {
    return true;
  }
  if (/add.*(this )?channel.*qa/i.test(rest)) return true;
  if (/qa channel allow/i.test(rest)) return true;
  if (/add.*to.*qa.*allow/i.test(rest)) return true;
  if (/add.*channel.*allowance/i.test(rest)) return true;
  return false;
}
