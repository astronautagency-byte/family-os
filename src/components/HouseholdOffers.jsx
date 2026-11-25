import { AI_OFFERS } from '../data/aiOffers';
import './billing-plans.css';

export default function HouseholdOffers() {
  return <div className="billing-plans">
    <header><h3>Start with Free Core</h3><p>Shared calendars, tasks, shopping lists and family messaging for up to five household members.</p></header>
    <p>Optional AI plans are priced per household in USD. These are the planned monthly totals with Free Core, before applicable taxes.</p>
    <div className="billing-plan-grid">
      {AI_OFFERS.map(offer => <article className="billing-plan-option" key={offer.id}>
        <h4>{offer.name}</h4>
        <p className="billing-plan-price">${offer.priceMonthly.toFixed(2)}<small> USD/month</small></p>
        <ul className="billing-plan-inclusions">{offer.features.map(feature => <li key={feature}>{feature}</li>)}</ul>
        <strong>Coming soon</strong>
      </article>)}
    </div>
    <p>Usage limits will be shown before purchase. AI plans become available after usage controls and billing are verified.</p>
  </div>;
}
