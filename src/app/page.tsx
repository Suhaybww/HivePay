/* eslint-disable react/no-unescaped-entities */
import Hero from '../components/Hero';
import Introduction from '../components/Introduction';
import GettingStarted from '../components/GettingStarted';
import FeaturesSpotlight from '../components/FeaturesSpotlight';
import FinalCTA from '../components/FinalCTA';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { redirect } from 'next/navigation';
import { db } from '@/src/db';
import PaymentFlow from '../components/PaymentFlow';
const Home = async () => {
  const { getUser } = getKindeServerSession();
  const user = await getUser();

  // If user is logged in, check if they exist in the database
  if (user) {
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true }
    });

    // If user exists, redirect to dashboard
    if (dbUser) {
      redirect('/dashboard');
    }
  }

  return (
    <div className="white min-h-screen">
      
      {/* Hero Section */}
      <Hero />

      {/* Section 2: Introduction */}
      <Introduction />



      {/* Section 4: How It Works */}
      <GettingStarted />

      {/* Section 5: Features Spotlight */}
      <FeaturesSpotlight />

      <PaymentFlow />


      {/* Section 6: Final Call-to-Action */}
      <FinalCTA />
    </div>
  );
};

export default Home;