import ComingSoon from '../components/ComingSoon';

export default function Calendar() {
  return (
    <ComingSoon
      icon="calendar"
      title="School calendar"
      intro="Term dates, holidays, exams and school events."
      items={['Month view', 'Upcoming events list']}
    />
  );
}
