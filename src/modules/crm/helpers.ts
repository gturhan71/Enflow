import { Opportunity, Proposal } from '../../types';

export const getContentJson = (proposal: Proposal): Record<string, unknown> => {
  if (!proposal.content) return {};
  if (typeof proposal.content === 'string') {
    try { return JSON.parse(proposal.content); } catch { return {}; }
  }
  return proposal.content as Record<string, unknown>;
};

export const getCustomerStats = (customerId: string, opportunities: Opportunity[], proposals: Proposal[]) => {
  const customerOpps = opportunities.filter(o => o.customerId === customerId);
  const wonOpps = customerOpps.filter(o => o.status === 'WON');
  const lostOpps = customerOpps.filter(o => o.status === 'LOST');
  const activeOpps = customerOpps.filter(o => !['WON', 'LOST', 'WITHDRAWN'].includes(o.status));

  const getBestValue = (opp: Opportunity) => {
    const oppProposals = proposals.filter(p => p.opportunityId === opp.id && p.totalPrice);
    if (oppProposals.length === 0) return opp.value ?? 0;
    return [...oppProposals].sort((a, b) => (b.version || 0) - (a.version || 0))[0].totalPrice!;
  };

  const wonValue = wonOpps.reduce((s, o) => s + getBestValue(o), 0);
  const lostValue = lostOpps.reduce((s, o) => s + getBestValue(o), 0);

  return { wonOpps, lostOpps, activeOpps, wonValue, lostValue, getBestValue };
};

export type CustomerStats = ReturnType<typeof getCustomerStats>;
