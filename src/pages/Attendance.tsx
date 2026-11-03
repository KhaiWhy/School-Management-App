import ComingSoon from '../components/ComingSoon';

export default function Attendance() {
  return (
    <ComingSoon
      icon="attendance"
      title="Attendance"
      intro="Take the register for each lesson and see attendance over time."
      items={['Mark present, late or absent', 'Attendance per student and per class']}
    />
  );
}
