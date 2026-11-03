import ComingSoon from '../components/ComingSoon';

export default function Messages() {
  return (
    <ComingSoon
      icon="message"
      title="Messages"
      intro="Direct messages with your teachers and classmates."
      items={['One-to-one chats', 'New-message alerts']}
    />
  );
}
