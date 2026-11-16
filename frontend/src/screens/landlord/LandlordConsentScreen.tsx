import ConsentScreen from '../../components/ConsentScreen';
import { useLandlordDemo } from '../../context/LandlordDemoContext';

type Props = { onReadPolicy?: () => void };

const sections = [
  {
    title: "What you'll see",
    body: 'Photos and videos your tenant records for the unit, with the date and area each one covers.',
  },
  {
    title: 'Who can see it',
    body: 'Only you and the tenant of that unit.',
  },
  {
    title: 'How AI is used',
    body: "Photos are sent to Google Gemini to compare against the baseline. AI flags possible changes and suggests a severity. It's advisory. You make the final call.",
  },
  {
    title: 'Your responsibility',
    body: "Use tenant photos only to document the unit's condition, and don't share them outside LeaseGuard.",
  },
];

export default function LandlordConsentScreen({ onReadPolicy }: Props) {
  const { acceptConsent } = useLandlordDemo();
  return (
    <ConsentScreen
      intro="LeaseGuard keeps a shared condition record for each unit you manage. Here is how tenant photos and videos are handled."
      sections={sections}
      footnote="Camera, properties and tenant photos stay locked until you accept."
      onAccept={acceptConsent}
      onReadPolicy={onReadPolicy}
    />
  );
}
