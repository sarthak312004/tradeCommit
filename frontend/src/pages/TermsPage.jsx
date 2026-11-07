import { Link } from 'react-router'
import LegalLayout, {
  inlineLinkCls,
  LegalCallout,
  LegalField,
  LegalSection,
} from '../components/legal/LegalLayout'
import { LEGAL_CONFIG } from '../config/legal'

const SECTIONS = [
  { id: 'service', title: 'The service' },
  { id: 'accounts', title: 'Your account and content' },
  { id: 'subscriptions', title: 'Subscriptions, billing and cancellation' },
  { id: 'trading-risk', title: 'Trading and AI disclaimer' },
  { id: 'contact', title: 'Contact' },
]

export default function TermsPage() {
  return (
    <LegalLayout
      category="Legal"
      title="Terms & Conditions"
      description="The basic terms for using TradeCommit and purchasing a subscription."
      sections={SECTIONS}
    >
      <LegalSection number={1} id="service" title="The service">
        <p>
          TradeCommit provides tools for recording trades, planning, reviewing performance, and organizing trading
          notes. Features and plan limits are shown in the app and may change over time.
        </p>
        <p>
          By using TradeCommit, you agree to use the service lawfully and not to misuse it, interfere with its
          operation, or access another person&apos;s account or data.
        </p>
      </LegalSection>

      <LegalSection number={2} id="accounts" title="Your account and content">
        <p>
          Keep your sign-in details secure. You are responsible for activity on your account and for keeping copies of
          any records you need.
        </p>
        <p>
          You keep responsibility for the trading notes and records you add. You allow TradeCommit to store and process
          them only to provide the app and features you choose to use.
        </p>
      </LegalSection>

      <LegalSection number={3} id="subscriptions" title="Subscriptions, billing and cancellation">
        <p>
          Paid subscriptions are processed by Dodo Payments. The checkout shows the price and billing period before you
          pay. Subscriptions renew automatically unless cancelled before the next renewal.
        </p>
        <p>
          You can manage or cancel a subscription from the Plan &amp; billing page or the Dodo customer portal.
          Cancellation stops future renewals; it does not automatically refund a payment already made. Refund requests
          are handled under our{' '}
          <Link to="/refund-policy" className={inlineLinkCls}>Refund Policy</Link>. See the{' '}
          <Link to="/cancellation-policy" className={inlineLinkCls}>Cancellation Policy</Link> for what happens to
          access and saved data.
        </p>
      </LegalSection>

      <LegalSection number={4} id="trading-risk" title="Trading and AI disclaimer">
        <LegalCallout label="Important">
          <p>
            TradeCommit is a journaling and planning tool, not a broker or financial adviser. Nothing in the app,
            including analytics, market data, or AI-generated content, is financial or trading advice or a promise of
            results. Trading involves risk; you make your own decisions.
          </p>
        </LegalCallout>
      </LegalSection>

      <LegalSection number={5} id="contact" title="Contact">
        <p>
          Questions about these terms? Contact us at{' '}
          <LegalField field={LEGAL_CONFIG.supportEmail} mailto />.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
