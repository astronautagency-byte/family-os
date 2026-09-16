import { describe, it, expect } from 'vitest';
import { checkoutOffer } from '../../../supabase/functions/_shared/checkoutPolicy.ts';
import { PRICING_PLAN } from '../../data/pricingPlan';

describe('card-upfront Pro trial policy', () => {
  it('forces Pro for new onboarding even with a stale Plus client', () => {
    expect(checkoutOffer({onboarding:true,feature:'plus'})).toMatchObject({feature:'pro',billing:'monthly',trial:{trial_period_days:7}});
  });
  it('cancels instead of starting a paid subscription if a payment method is missing', () => {
    expect(checkoutOffer({onboarding:true}).trial.trial_settings.end_behavior.missing_payment_method).toBe('cancel');
  });
  it('leaves ordinary upgrades without a fresh trial', () => {
    expect(checkoutOffer({feature:'plus',billing:'yearly'})).toMatchObject({feature:'plus',billing:'yearly',trial:{}});
    expect(checkoutOffer({onboarding:'true'}).trial).toEqual({});
  });
  it('normalizes annual billing without changing the trial duration', () => {
    expect(checkoutOffer({onboarding:true,billing:'annual'})).toMatchObject({billing:'yearly',trial:{trial_period_days:7}});
  });
  it('advertises the same card requirement, trial and Pro price', () => {
    expect(PRICING_PLAN.trial).toMatchObject({days:7,cardRequired:true,plan:'pro'});
    expect(PRICING_PLAN.plans.find(plan => plan.id === 'pro').price.monthly).toBe(19.99);
  });
});
