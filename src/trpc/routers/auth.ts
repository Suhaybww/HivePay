import { router, publicProcedure } from '../trpc';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { SubscriptionStatus } from '@prisma/client';

export const authRouter = router({
  // authCallback: Handles user auth callback logic
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();
  
    if (!user || !user.id || !user.email) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
  
    try {
      let dbUser = await db.user.findFirst({
        where: { id: user.id },
      });
  
      if (dbUser) {
        // If user exists, just return success
        return {
          success: true,
          isNewUser: false,
        };
      }
  
      // Check for existing email
      const existingUserWithEmail = await db.user.findFirst({
        where: { email: user.email },
      });
  
      if (existingUserWithEmail) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'An account with this email already exists'
        });
      }
  
      // Create new user if no conflicts
      dbUser = await db.user.create({
        data: {
          id: user.id,
          email: user.email,
          firstName: user.given_name ?? '',
          lastName: user.family_name ?? '',
          phoneNumber: '',
          subscriptionStatus: SubscriptionStatus.Inactive,
        },
      });
  
      return {
        success: true,
        isNewUser: true,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      console.error('Error in authCallback:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create/update user',
      });
    }
  }),
});

export type AuthRouter = typeof authRouter;
