import { Link } from 'react-router'
import LegalLayout, {
  inlineLinkCls,
  LegalField,
  LegalList,
  LegalSection,
} from '../components/legal/LegalLayout'
import { LEGAL_CONFIG } from '../config/legal'

const SECTIONS = [
  { id: 'requests', title: 'Refund requests' },
  { id: 'how-to-request', title: 'How to request a refund' },
  { id: 'cancellation', title: 'Cancellation is separate' },
]

export default function RefundPolicyPage() {
  return (
    <LegalLayout
      category="Billing Policies"
      title="Refund Policy"
      description="How to contact TradeCommit about a payment or refund."
      sections={SECTIONS}
    >
      <LegalSection number={1} id="requests" title="Refund requests">
        <p>
          If you believe you were charged incorrectly, charged more than once, or paid without receiving subscription
          access, contact us so we can review the payment. Other refund requests are reviewed individually, subject to
          applicable law and the payment provider&apos;s rules. A refund is not automatic when you cancel.
        </p>
        <p>
          If a refund is approved, it is sent through Dodo Payments to the original payment method. The time it takes to
          appear depends on the payment provider and your bank.
        </p>
      </LegalSection>

      <LegalSection number={2} id="how-to-request" title="How to request a refund">
        <p>
          Email <LegalField field={LEGAL_CONFIG.supportEmail} mailto /> from your account email. Include:
        </p>
        <LegalList
          items={[
            'The email address on your TradeCommit account.',
            'The date and amount of the charge.',
            'The receipt or invoice from Dodo Payments, if available.',
            'A short description of the issue.',
          ]}
        />
        <p>Please do not send full card numbers, passwords, or verification codes.</p>
      </LegalSection>

      <LegalSection number={3} id="cancellation" title="Cancellation is separate">
        <p>
          To stop future renewals, cancel your subscription from the{' '}
          <Link to="/billing" className={inlineLinkCls}>Plan &amp; billing</Link> page or the Dodo customer portal.
          See the <Link to="/cancellation-policy" className={inlineLinkCls}>Cancellation Policy</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
