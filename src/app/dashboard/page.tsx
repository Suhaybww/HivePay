import Dashboard from '@/src/components/Dashboard'
import { db } from '@/src/db'
// import { getUserSubscriptionPlan } from '@/lib/stripe'
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server'
import { redirect } from 'next/navigation'

const Page = async () => {
    const session = await getKindeServerSession();
    const user = await session.getUser();
  
    // Redirect to the auth callback page if the user session is not available
    if (!user || !user.id) redirect('/auth-callback?origin=dashboard');
  
    // Fetch the user from the database using the user ID
    const dbUser = await db.user.findFirst({
      where: {
        id: user.id,
      },
    });
  
    // Redirect to the auth callback page if the user is not found in the database
    if (!dbUser) redirect('/auth-callback?origin=dashboard');
  

  
    // Render the Dashboard component with the user data from the database
    return <Dashboard user={dbUser} />;
  };
  
  export default Page;