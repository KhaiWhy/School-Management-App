import ComingSoon from '../components/ComingSoon';

export default function Reports() {
  return (
    <ComingSoon
      icon="report"
      title="School reports"
      intro="Write end-of-term reports for your students."
      items={['Grades and comments per subject', 'Share reports with students']}
    />
  );
}
