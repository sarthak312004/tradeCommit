import { Link } from 'react-router'
import LegalLayout, {
  inlineLinkCls,
  LegalSection,
} from '../components/legal/LegalLayout'

const SECTIONS = [
  { id: 'cancel', title: 'How to cancel' },
  { id: 'access', title: 'What happens after cancellation' },
  { id: 'data', title: 'Your data' },
]

export default function CancellationPolicyPage() {
  return (
    <LegalLayout
      category="Billing Policies"
      title="Cancellation Policy"
      description="How to stop a TradeCommit Pro subscription and what happens to your account."
      sections={SECTIONS}
    >
      <LegalSection number={1} id="cancel" title="How to cancel">
        <p>
          Cancel from the <Link to="/billing" className={inlineLinkCls}>Plan &amp; billing</Link> page in your
          workspace or use the Dodo customer portal. Cancellation stops future renewals.
        </p>
      </LegalSection>

      <LegalSection number={2} id="access" title="What happens after cancellation">
        <p>
          Your paid features remain available through the period you have paid for. A short grace period may apply if a
          renewal payment is delayed. Cancelling does not automatically refund a payment. For refund questions, see our{' '}
          <Link to="/refund-policy" className={inlineLinkCls}>Refund Policy</Link>.
        </p>
        <p>
          When paid access ends, your account returns to the Free plan. Some features may become limited, but
          cancellation alone does not delete your saved journals or trades.
        </p>
      </LegalSection>

      <LegalSection number={3} id="data" title="Your data">
        <p>
          To request account or data deletion, contact us using the details on the{' '}
          <Link to="/contact" className={inlineLinkCls}>Contact &amp; Support</Link> page.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
