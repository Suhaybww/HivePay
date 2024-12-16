import { privateProcedure, publicProcedure, router } from '../trpc';
import { getKindeServerSession } from '@kinde-oss/kinde-auth-nextjs/server';
import { TRPCError } from '@trpc/server';
import { db } from '../../db';
import { z } from 'zod';
import { SubscriptionStatus, Frequency, PayoutStatus, TransactionType, Prisma, PaymentStatus } from '@prisma/client'; // Updated import
import { stripe } from '../../lib/stripe';



export const authRouter = router({
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
  
  updateUserDetails: publicProcedure
    .input(
      z.object({
        phoneNumber: z.string(),
        age: z.number().min(18).max(120).optional(),
        gender: z.enum(['Male', 'Female']).optional(),
        onboardingStatus: z.enum(['Pending', 'Completed', 'Failed']).optional(),
        onboardingDate: z.string().datetime().optional(),
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

        return { success: true, user: updatedUser };
      } catch (error) {
        console.error('Failed to update user:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user details',
        });
      }
    }),

  getUser: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNumber: true,
        age: true,
        gender: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        stripeCurrentPeriodEnd: true,
      },
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found in database',
      });
    }

    return dbUser;
  }),

  getUserStatus: privateProcedure.query(async ({ ctx }) => {
    const { userId } = ctx;

    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        onboardingStatus: true,
        stripeAccountId: true,
      },
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    return dbUser;
  }),

  createStripeConnectAccount: privateProcedure
  .mutation(async ({ ctx }) => {
    const { userId } = ctx;

    if (!userId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
    }

    // Fetch user data from the database
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        stripeAccountId: true,
      },
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    try {
      let accountId = dbUser.stripeAccountId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: 'express',
          country: 'AU',
          email: dbUser.email,
          business_type: 'individual',
          individual: {
            first_name: dbUser.firstName,
            last_name: dbUser.lastName,
          },
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
        });

        accountId = account.id;

        await db.user.update({
          where: { id: userId },
          data: {
            stripeAccountId: accountId,
            onboardingStatus: 'Pending', // Set to 'Pending' here
            onboardingDate: null,        // Set to null initially
          },
        });
      }

      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?onboarding=failed`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?onboarding=completed`,
        type: 'account_onboarding',
      });

      return { url: accountLink.url };
    } catch (error) {
      console.error('Stripe Connect account creation error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create Stripe Connect account',
      });
    }
  }),



 // Step 1: Method to allow each user to set up BECS Direct Debit
 setupBECSDirectDebit: privateProcedure
 // Removed the .input() method since no input is needed
 .mutation(async ({ ctx }) => {
   const { userId } = ctx;

   if (!userId) {
     throw new TRPCError({ code: 'UNAUTHORIZED', message: 'User not authenticated' });
   }

   // Fetch the user's Stripe Customer ID or create one if it doesn't exist
   const dbUser = await db.user.findUnique({
     where: { id: userId },
     select: { stripeCustomerId: true, email: true },
   });

   if (!dbUser) {
     throw new TRPCError({
       code: 'NOT_FOUND',
       message: 'User not found',
     });
   }

   let stripeCustomerId = dbUser.stripeCustomerId;

   // Step 1: Create a Stripe Customer if one doesn't exist
   if (!stripeCustomerId) {
     try {
       const customer = await stripe.customers.create({
         email: dbUser.email,
         metadata: { userId },
       });
       stripeCustomerId = customer.id;

       // Save the new Customer ID to the database
       await db.user.update({
         where: { id: userId },
         data: { stripeCustomerId },
       });
     } catch (error) {
       console.error(`Failed to create Stripe customer for user ${userId}:`, error);
       throw new TRPCError({
         code: 'INTERNAL_SERVER_ERROR',
         message: 'Failed to create Stripe customer',
       });
     }
   }

   // Step 2: Create a SetupIntent for BECS direct debit authorization
   try {
     const setupIntent = await stripe.setupIntents.create({
       customer: stripeCustomerId,
       payment_method_types: ['au_becs_debit'],
       usage: 'off_session',
     });

     // Store the SetupIntent ID and mark setup as pending
     await db.user.update({
       where: { id: userId },
       data: {
         stripeSetupIntentId: setupIntent.id,
         becsSetupStatus: 'Pending', // Corrected to match your OnboardingStatus enum
       },
     });

     return {
       success: true,
       setupIntentClientSecret: setupIntent.client_secret,
     };
   } catch (error) {
     console.error(`Failed to create BECS setup intent for user ${userId}:`, error);
     throw new TRPCError({
       code: 'INTERNAL_SERVER_ERROR',
       message: 'Failed to create BECS setup intent',
     });
   }
 }),


// Step 2: Method to start the contribution cycle for a group
startContributionCycle: privateProcedure
  .input(
    z.object({
      groupId: z.string(),
      scheduleDate: z.string().or(z.date()).transform((val) => new Date(val)),
      payoutDate: z.string().or(z.date()).transform((val) => new Date(val)),
    })
  )
  .mutation(async ({ input }) => {
    const { groupId, scheduleDate, payoutDate } = input;

    const group = await db.group.findUnique({
      where: { id: groupId },
      include: {
        groupMemberships: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                stripeCustomerId: true, // Customer ID for BECS debit
              },
            },
          },
        },
      },
    });

    if (!group) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Group not found',
      });
    }

    const { contributionAmount, nextContributionDate, groupMemberships, contributionFrequency } = group;

    if (!contributionAmount || !nextContributionDate || !contributionFrequency) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Contribution settings are incomplete',
      });
    }

    // Ensure each member has a BECS payment method set up
    for (const member of groupMemberships) {
      const { stripeCustomerId, email } = member.user;

      if (!stripeCustomerId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `User ${email} has not completed Stripe setup.`,
        });
      }

      // Check if the BECS payment method is set up for the user
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'au_becs_debit',
      });

      const paymentMethod = paymentMethods.data[0];
      if (!paymentMethod) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `No BECS payment method found for user ${email}.`,
        });
      }

      // Create PaymentIntent for each user in the group
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: contributionAmount.toNumber() * 100, // in cents
          currency: 'aud',
          customer: stripeCustomerId, // Use customer ID here
          payment_method: paymentMethod.id,
          confirm: true,
          off_session: true,
          metadata: {
            groupId: groupId,
            userId: member.user.id,
            scheduleDate: scheduleDate.toISOString(), // Include scheduleDate in metadata
            payoutDate: payoutDate.toISOString(),     // Include payoutDate in metadata
          },
        });

        // Store the payment record in your database
        await db.payment.create({
          data: {
            groupId,
            userId: member.user.id,
            amount: contributionAmount,
            stripePaymentIntentId: paymentIntent.id,
            paymentDate: new Date(),
            status: 'Pending', // Update based on webhook events
          },
        });
      } catch (error) {
        console.error(`Failed to create payment for user ${email}:`, error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create payment for contribution.',
        });
      }
    }

    const updatedNextContributionDate = calculateNextDate(
      nextContributionDate,
      contributionFrequency
    );

    await db.group.update({
      where: { id: groupId },
      data: { nextContributionDate: updatedNextContributionDate },
    });

    return { success: true };
  }),

  processPayout: privateProcedure
    .input(
      z.object({
        groupId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { groupId } = input;

      // Fetch the group and its payments
      const group = await db.group.findUnique({
        where: { id: groupId },
        include: {
          groupMemberships: {
            orderBy: { payoutOrder: 'asc' },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  stripeAccountId: true,
                },
              },
            },
          },
          payments: {
            where: { status: PaymentStatus.Successful },
          },
          payouts: true,
        },
      });

      if (!group) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group not found',
        });
      }

      // Check if all payments have been successful
      const totalMembers = group.groupMemberships.length;
      const successfulPayments = group.payments.length;

      if (successfulPayments < totalMembers) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Not all payments have been completed',
        });
      }

      // Identify the next user to receive the payout
      const lastPayout = await db.payout.findFirst({
        where: { groupId },
        orderBy: { payoutOrder: 'desc' },
      });

      let nextPayoutOrder = 1;
      if (lastPayout) {
        nextPayoutOrder = lastPayout.payoutOrder + 1;
      }

      const nextMember = group.groupMemberships.find(
        (member) => member.payoutOrder === nextPayoutOrder
      );

      if (!nextMember) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No eligible member found for payout',
        });
      }

      const { stripeAccountId } = nextMember.user;

      if (!stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `User ${nextMember.user.email} has not completed Stripe Connect onboarding`,
        });
      }

      // Calculate the total amount collected
      const totalAmount = group.payments.reduce((acc, payment) => {
        return acc + payment.amount.toNumber();
      }, 0);

      // Initiate the transfer via Stripe Connect
      try {
        const transfer = await stripe.transfers.create({
          amount: Math.round(totalAmount * 100), // Convert to cents and round to nearest cent
          currency: 'aud',
          destination: stripeAccountId,
          metadata: {
            groupId,
            userId: nextMember.user.id,
          },
        });

        // Check the connected account's balance
        const connectedAccountBalance = await stripe.balance.retrieve({
          stripeAccount: stripeAccountId,
        });

        const pendingBalance = connectedAccountBalance.pending.find(
          (balance) => balance.currency === 'aud'
        );

        if (
          pendingBalance &&
          pendingBalance.amount >= Math.round(totalAmount * 100)
        ) {
          // Funds are pending in the connected account
          // Create a payout record with status 'Completed'
          const payout = await db.payout.create({
            data: {
              groupId,
              userId: nextMember.user.id,
              scheduledPayoutDate: new Date(),
              amount: new Prisma.Decimal(totalAmount),
              status: PayoutStatus.Completed,
              stripeTransferId: transfer.id,
              payoutOrder: nextPayoutOrder,
            },
          });

          // Create a transaction record
          await db.transaction.create({
            data: {
              userId: nextMember.user.id,
              groupId,
              amount: new Prisma.Decimal(totalAmount),
              transactionType: TransactionType.Credit,
              description: `Payout for group ${group.name}`,
              transactionDate: new Date(),
              relatedPayoutId: payout.id,
            },
          });

          return { success: true };
        } else {
          // Funds are not yet in the connected account's pending balance
          // Handle this case as needed
          console.error('Funds not yet available in connected account');
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Funds not yet available in connected account',
          });
        }
      } catch (error) {
        console.error(
          `Failed to transfer funds to user ${nextMember.user.email}:`,
          error
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to transfer funds',
        });
      }
    }),

    getStripeDashboardLink: privateProcedure
    .mutation(async ({ ctx }) => {  
      const { userId } = ctx;

      // Fetch the user's Stripe Connect account ID
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeAccountId: true,
          onboardingStatus: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      if (!user.stripeAccountId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No Stripe Connect account found for this user',
        });
      }

      if (user.onboardingStatus !== 'Completed') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please complete your Stripe Connect onboarding first',
        });
      }

      try {
        // Create a login link for the connected account
        const loginLink = await stripe.accounts.createLoginLink(
          user.stripeAccountId
        );

        return {
          url: loginLink.url,
        };

      } catch (error) {
        console.error('Error creating Stripe login link:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create Stripe dashboard login link',
        });
      }
    }),

  // Optional: Add a method to check account status
  getStripeAccountStatus: privateProcedure
    .query(async ({ ctx }) => {
      const { userId } = ctx;

      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          stripeAccountId: true,
          onboardingStatus: true,
        },
      });

      if (!user || !user.stripeAccountId) {
        return {
          hasConnectedAccount: false,
          isOnboardingComplete: false,
        };
      }

      try {
        // Fetch the account details from Stripe
        const account = await stripe.accounts.retrieve(user.stripeAccountId);

        return {
          hasConnectedAccount: true,
          isOnboardingComplete: account.details_submitted && account.charges_enabled,
          accountStatus: {
            detailsSubmitted: account.details_submitted ?? false,
            chargesEnabled: account.charges_enabled ?? false,
            payoutsEnabled: account.payouts_enabled ?? false,
            currentlyDue: account.requirements?.currently_due ?? [],
            pastDue: account.requirements?.past_due ?? [],
            eventuallyDue: account.requirements?.eventually_due ?? [],
            pendingVerification: account.requirements?.pending_verification ?? [],
          },
        };
      } catch (error) {
        console.error('Error fetching Stripe account status:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch Stripe account status',
        });
      }
    }),
});

// Helper function to calculate the next contribution date
function calculateNextDate(currentDate: Date, frequency: Frequency): Date {
  const nextDate = new Date(currentDate);
  switch (frequency) {
    case 'Weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'BiWeekly':
      nextDate.setDate(nextDate.getDate() + 14);
      break;
    case 'Monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
  return nextDate;
}


export type AuthRouter = typeof authRouter;
