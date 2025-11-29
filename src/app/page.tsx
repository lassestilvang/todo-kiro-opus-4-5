import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect to Today view as the default landing page
  redirect('/today');
}
