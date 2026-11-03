import ComingSoon from '../components/ComingSoon';

export default function Timetable() {
  return (
    <ComingSoon
      icon="timetable"
      title="Timetable"
      intro="Your lessons for the week, with rooms and teachers."
      items={['Day and week view', 'Your next lesson on the home page']}
    />
  );
}
