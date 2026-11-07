import { Link } from 'react-router'
import LegalLayout, {
  inlineLinkCls,
  LegalField,
  LegalList,
  LegalSection,
} from '../components/legal/LegalLayout'
import { LEGAL_CONFIG } from '../config/legal'

const SECTIONS = [
  { id: 'information', title: 'Information we use' },
  { id: 'providers', title: 'Service providers' },
  { id: 'cookies', title: 'Cookies and browser storage' },
  { id: 'retention', title: 'Your choices and data requests' },
  { id: 'contact', title: 'Contact' },
]

export default function PrivacyPage() {
  return (
    <LegalLayout
      category="Privacy"
      title="Privacy Policy"
      description="A short overview of the information TradeCommit uses to run your account and provide the features you request."
      sections={SECTIONS}
    >
      <LegalSection number={1} id="information" title="Information we use">
        <p>TradeCommit uses information you provide or create in the app, including:</p>
        <LegalList
          items={[
            'Your email address, name, username, and sign-in information.',
            'Your journals, trades, plans, notes, preferences, and uploaded images.',
            'Basic technical information needed to operate the service, protect accounts, and troubleshoot problems.',
            'Subscription status and payment references. Dodo Payments processes your payment; TradeCommit does not store your full card or bank details.',
          ]}
        />
        <p>
          If you ask for an AI review, relevant journal, trade, and plan information is sent to Google Gemini to create
          that review.
        </p>
      </LegalSection>

      <LegalSection number={2} id="providers" title="Service providers">
        <p>
          TradeCommit uses providers to run specific parts of the app: Google for sign-in and requested AI reviews,
          Dodo Payments for checkout and billing, MongoDB Atlas for database hosting, Cloudinary for images, Brevo for
          email, and Vercel/Render for hosting and site analytics. These providers process information as needed to
          provide their services.
        </p>
      </LegalSection>

      <LegalSection number={3} id="cookies" title="Cookies and browser storage">
        <p>
          TradeCommit uses necessary sign-in cookies and browser storage for preferences and temporary drafts. Vercel
          Analytics is used on the site to understand page visits and performance.
        </p>
      </LegalSection>

      <LegalSection number={4} id="retention" title="Your choices and data requests">
        <p>
          Your account data is kept to provide the service. You can export your records from the app. To ask a question
          about your data or request account/data deletion, contact{' '}
          <LegalField field={LEGAL_CONFIG.supportEmail} mailto />. We may need to verify your account and retain
          limited information where required by law.
        </p>
        <p>
          Cancelling a subscription does not delete your records. Read the{' '}
          <Link to="/cancellation-policy" className={inlineLinkCls}>Cancellation Policy</Link> for more information.
        </p>
      </LegalSection>

      <LegalSection number={5} id="contact" title="Contact">
        <p>
          For privacy questions or requests, email{' '}
          <LegalField field={LEGAL_CONFIG.supportEmail} mailto />.
        </p>
      </LegalSection>
    </LegalLayout>
  )
}
