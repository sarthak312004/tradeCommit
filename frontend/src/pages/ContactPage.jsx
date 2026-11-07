import { Link } from 'react-router'
import LegalLayout, {
  inlineLinkCls,
  LegalField,
  LegalSection,
} from '../components/legal/LegalLayout'
import { LEGAL_CONFIG } from '../config/legal'

const SECTIONS = [
  { id: 'support', title: 'Support and billing' },
  { id: 'privacy', title: 'Privacy and account requests' },
]

export default function ContactPage() {
  return (
    <LegalLayout
      category="Support"
      title="Contact & Support"
      description="Contact TradeCommit about the app, a payment, or your account."
      sections={SECTIONS}
    >
      <LegalSection number={1} id="support" title="Support and billing">
        <p>
          For help with TradeCommit or a Dodo Payments charge, email{' '}
          <LegalField field={LEGAL_CONFIG.supportEmail} mailto />. Include your account email and a short description
          of the issue. For payment questions, include the receipt or invoice if you have it.
        </p>
        <p>
          You can manage subscriptions from the <Link to="/billing" className={inlineLinkCls}>Plan &amp; billing</Link>{' '}
          page. Read the <Link to="/refund-policy" className={inlineLinkCls}>Refund Policy</Link> or{' '}
          <Link to="/cancellation-policy" className={inlineLinkCls}>Cancellation Policy</Link> for details.
        </p>
      </LegalSection>

      <LegalSection number={2} id="privacy" title="Privacy and account requests">
        <p>
          For data questions or account deletion requests, email{' '}
          <LegalField field={LEGAL_CONFIG.supportEmail} mailto /> from your account email. We may ask you to verify
          account ownership before handling a request.
        </p>
        <p>
          See our <Link to="/privacy" className={inlineLinkCls}>Privacy Policy</Link>.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
