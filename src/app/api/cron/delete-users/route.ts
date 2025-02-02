export const dynamic = 'force-dynamic'
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@/src/db';
import { headers } from 'next/headers';
import { stripe } from '@/src/lib/stripe';
import { subDays } from 'date-fns';

// Vercel specific authorization
const CRON_SECRET = process.env.CRON_SECRET;

async function cleanupDeletedUsers() {
 // For testing in development, use current date instead of 30 days
 const deletionDate = subDays(new Date(), 30); // Critical line - always 30 days back
 console.log('Cleanup threshold date:', deletionDate.toISOString());

  try {
    // Find users marked for deletion at least 30 days ago
    const usersToDelete = await db.user.findMany({
      where: {
        isDeleted: true,
        deletedAt: {
          lte: deletionDate // Only users deleted 30+ days ago
        }
      },
      include: {
       groupMemberships: true,
       groupsCreated: true,
     }
   });

   console.log(`Found ${usersToDelete.length} users to permanently delete`);
   console.log('Users to delete:', usersToDelete.map(u => ({ id: u.id, email: u.email, deletedAt: u.deletedAt })));

   let deletedCount = 0;

   for (const user of usersToDelete) {
     console.log(`Processing deletion for user ${user.id}`);

     try {
       await db.$transaction(async (tx) => {
         // Delete all notifications
         await tx.notification.deleteMany({
           where: { userId: user.id }
         });

         // Delete all messages
         await tx.message.deleteMany({
           where: { senderId: user.id }
         });

         // Delete all feedback
         await tx.feedback.deleteMany({
           where: { userId: user.id }
         });

         // Delete all ticket responses
         await tx.ticketResponse.deleteMany({
           where: { userId: user.id }
         });

         // Delete all support tickets
         await tx.supportTicket.deleteMany({
           where: { userId: user.id }
         });

         // Delete all contracts
         await tx.contract.deleteMany({
           where: { userId: user.id }
         });

         // Delete all transactions
         await tx.transaction.deleteMany({
           where: { userId: user.id }
         });

         // Delete all payments
         await tx.payment.deleteMany({
           where: { userId: user.id }
         });

         // Delete all payouts
         await tx.payout.deleteMany({
           where: { userId: user.id }
         });

         // Delete all subscriptions
         await tx.subscription.deleteMany({
           where: { userId: user.id }
         });

         // Delete all group memberships
         await tx.groupMembership.deleteMany({
           where: { userId: user.id }
         });

         // Delete all created groups (that are not active)
         await tx.group.deleteMany({
           where: {
             createdById: user.id,
             cycleStarted: false,
           }
         });

         // Finally delete the user
         await tx.user.delete({
           where: { id: user.id }
         });

         deletedCount++;
         console.log(`Successfully deleted user ${user.id} and all related data`);
       });

       // Clean up Stripe customer if exists
       if (user.stripeCustomerId) {
         try {
           await stripe.customers.del(user.stripeCustomerId);
           console.log(`Deleted Stripe customer ${user.stripeCustomerId}`);
         } catch (stripeError) {
           console.error(`Failed to delete Stripe customer: ${stripeError}`);
         }
       }
     } catch (error) {
       console.error(`Failed to delete user ${user.id}:`, error);
       // Continue with next user even if one fails
     }
   }

   const result = {
     success: true,
     deletedCount,
     message: `Successfully processed ${deletedCount} users`
   };
   
   console.log('Cleanup completed:', result);
   return result;

 } catch (error) {
   console.error('Failed to cleanup deleted users:', error);
   throw error;
 }
}

export async function GET(request: Request) {
 console.log('Cron endpoint hit');
 
 const headersList = headers();
 const authHeader = headersList.get('authorization');
 
 console.log('Auth header received:', authHeader);
 console.log('Expected:', `Bearer ${CRON_SECRET}`);

 if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
   console.log('Unauthorized attempt');
   return new NextResponse(
     JSON.stringify({ error: 'Unauthorized' }),
     { status: 401 }
   );
 }

 try {
   const result = await cleanupDeletedUsers();
   return NextResponse.json(result);
 } catch (error) {
   console.error('User deletion cron job failed:', error);
   return new NextResponse(
     JSON.stringify({ 
       error: 'Internal server error',
       details: error instanceof Error ? error.message : 'Unknown error' 
     }),
     { status: 500 }
   );
 }
}