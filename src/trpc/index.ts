import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { privateProcedure, publicProcedure, router } from './trpc';
import { TRPCError } from '@trpc/server';
import { db } from '../db';
import { z } from 'zod';

export const appRouter = router({
  authCallback: publicProcedure.query(async () => {
    const { getUser } = getKindeServerSession();
    const user = await getUser();

    if (!user || !user.id || !user.email) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }

    try {
      // Try to find the user first
      let dbUser = await db.user.findFirst({
        where: {
          id: user.id,
        },
      });

      if (!dbUser) {
        // If user doesn't exist, create them
        const { SubscriptionStatus } = await import('@prisma/client');

        dbUser = await db.user.create({
          data: {
            id: user.id,
            email: user.email,
            firstName: user.given_name ?? '',
            lastName: user.family_name ?? '',
            phoneNumber: '',
            passwordHash: '',
            subscriptionStatus: SubscriptionStatus.Inactive,
            emailVerified: false,
            idVerified: false,
            twoFactorEnabled: false,
            verificationMethod: null,
          },
        });

        console.log('Created new user:', dbUser);
      }

      return { success: true, userId: user.id };
    } catch (error) {
      console.error('Error in authCallback:', error);
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create/update user'
      });
    }
  }),
});

export type AppRouter = typeof appRouter;