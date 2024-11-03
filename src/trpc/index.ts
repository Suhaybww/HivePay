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

      let isNewUser = false;

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

        isNewUser = true;
        console.log('Created new user:', dbUser);
      }

      // Check if user needs onboarding (missing phone number)
      const needsOnboarding = !dbUser.phoneNumber;

      return { 
        success: true, 
        isNewUser: isNewUser,
        needsOnboarding: needsOnboarding 
      };

    } catch (error) {
      console.error('Error in authCallback:', error);
      throw new TRPCError({ 
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create/update user'
      });
    }
  }),

  updateUserDetails: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        age: z.number().min(18).max(120).optional(),
        gender: z.enum(['Male', 'Female']).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { getUser } = getKindeServerSession();
      const user = await getUser();

      if (!user?.id) {
        throw new TRPCError({ code: 'UNAUTHORIZED' });
      }

      try {
        const updatedUser = await db.user.update({
          where: { id: user.id },
          data: {
            phoneNumber: input.phoneNumber,
            age: input.age,
            gender: input.gender,
          },
        });

        return {
          success: true,
          user: updatedUser,
        };
      } catch (error) {
        console.error('Failed to update user:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user details',
        });
      }
    }),
});

export type AppRouter = typeof appRouter;