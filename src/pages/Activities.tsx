import ComingSoon from '../components/ComingSoon';

export default function Activities() {
  return (
    <ComingSoon
      icon="activity"
      title="Activities"
      intro="Your CCAs and after-school activities."
      items={['Your activities and when they meet', 'Activity announcements']}
    />
  );
}
