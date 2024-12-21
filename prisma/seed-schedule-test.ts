import { describe, it, beforeEach, afterEach, expect, vi, beforeAll, afterAll } from 'vitest';
import { contributionQueue, payoutQueue } from '@/src/lib/queue/config';
import { setupQueues } from '@/src/lib/queue/setup';
import { db } from '@/src/db';
import { stripe } from '@/src/lib/stripe';
import type { Stripe } from 'stripe';
import { Prisma } from '@prisma/client';
import { 
  GroupStatus, 
  PaymentStatus, 
  PayoutStatus, 
  MembershipStatus, 
  Frequency,
  User,
  Group,
  GroupMembership 
} from '@prisma/client';

// Mock types for external dependencies
vi.mock('@/src/lib/stripe', () => ({
  stripe: {
    paymentIntents: {
      create: vi.fn(),
    },
    transfers: {
      create: vi.fn(),
    },
    balance: {
      retrieve: vi.fn(),
    },
  },
}));

vi.mock('@/src/lib/emailService');

type StripeResponseHelper = {
  lastResponse: {
    headers: { [key: string]: string };
    requestId: string;
    statusCode: number;
    apiVersion?: string;
    idempotencyKey?: string;
    stripeAccount?: string;
  };
};

interface TestUser extends User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  stripeCustomerId: string;
  stripeAccountId: string;
  stripeBecsPaymentMethodId: string;
}

interface TestSetup {
  testGroup: Group;
  testUsers: TestUser[];
  testMemberships: GroupMembership[];
}

describe('Queue Processing Integration Tests', () => {
  let setup: TestSetup;

  beforeAll(async () => {
    setupQueues();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await db.payment.deleteMany();
    await db.payout.deleteMany();
    await db.groupMembership.deleteMany();
    await db.group.deleteMany();
    await db.user.deleteMany();

    // Create test users with Stripe setup
    const users = await Promise.all([
      db.user.create({
        data: {
          id: 'user1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phoneNumber: '+61400000001',
          stripeCustomerId: 'cus_1',
          stripeAccountId: 'acct_1',
          stripeBecsPaymentMethodId: 'pm_1',
          becsSetupStatus: 'Completed',
          subscriptionStatus: 'Inactive',
          onboardingStatus: 'Completed',
        }
      }),
      db.user.create({
        data: {
          id: 'user2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@example.com',
          phoneNumber: '+61400000002',
          stripeCustomerId: 'cus_2',
          stripeAccountId: 'acct_2',
          stripeBecsPaymentMethodId: 'pm_2',
          becsSetupStatus: 'Completed',
          subscriptionStatus: 'Inactive',
          onboardingStatus: 'Completed',
        }
      }),
      db.user.create({
        data: {
          id: 'user3',
          firstName: 'Bob',
          lastName: 'Wilson',
          email: 'bob@example.com',
          phoneNumber: '+61400000003',
          stripeCustomerId: 'cus_3',
          stripeAccountId: 'acct_3',
          stripeBecsPaymentMethodId: 'pm_3',
          becsSetupStatus: 'Completed',
          subscriptionStatus: 'Inactive',
          onboardingStatus: 'Completed',
        }
      })
    ]) as TestUser[];

    // Create test group
    const group = await db.group.create({
      data: {
        name: 'Test Group',
        createdById: users[0].id,
        contributionAmount: new Prisma.Decimal(100),
        contributionFrequency: Frequency.Weekly,
        payoutFrequency: Frequency.Weekly,
        nextContributionDate: new Date(),
        nextPayoutDate: new Date(),
        status: GroupStatus.Active,
        cycleStarted: true,
      }
    });

    // Create group memberships
    const memberships = await Promise.all(
      users.map((user, index) =>
        db.groupMembership.create({
          data: {
            groupId: group.id,
            userId: user.id,
            payoutOrder: index + 1,
            status: MembershipStatus.Active,
            isAdmin: index === 0,
          }
        })
      )
    );

    setup = {
      testGroup: group,
      testUsers: users,
      testMemberships: memberships
    };
  });

  afterEach(async () => {
    await contributionQueue.clean(0, 'delayed');
    await contributionQueue.clean(0, 'wait');
    await payoutQueue.clean(0, 'delayed');
    await payoutQueue.clean(0, 'wait');
  });

  afterAll(async () => {
    await contributionQueue.close();
    await payoutQueue.close();
  });

  describe('Contribution Cycle Tests', () => {
    it('should successfully process contribution cycle for all members', async () => {
      const mockPaymentIntent: Stripe.PaymentIntent & StripeResponseHelper = {
        id: 'pi_test',
        object: 'payment_intent',
        amount: 10000,
        currency: 'aud',
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
        client_secret: 'pi_test_secret',
        livemode: false,
        payment_method: 'pm_test',
        payment_method_types: ['au_becs_debit'],
        customer: 'cus_test',
        metadata: {},
        amount_capturable: 0,
        amount_details: { tip: {} },
        amount_received: 0,
        application: null,
        application_fee_amount: null,
        automatic_payment_methods: null,
        canceled_at: null,
        cancellation_reason: null,
        capture_method: 'automatic',
        confirmation_method: 'automatic',
        latest_charge: null,
        description: null,
        invoice: null,
        next_action: null,
        on_behalf_of: null,
        payment_method_options: {},
        processing: null,
        receipt_email: null,
        review: null,
        setup_future_usage: null,
        shipping: null,
        statement_descriptor: null,
        statement_descriptor_suffix: null,
        transfer_data: null,
        transfer_group: null,
        last_payment_error: null,
        payment_method_configuration_details: null,
        source: null,
        lastResponse: {
          headers: {},
          requestId: 'req_test',
          statusCode: 200
        }
      };

      vi.mocked(stripe.paymentIntents.create).mockResolvedValue(mockPaymentIntent);
      await contributionQueue.add(
        'start-contribution',
        { groupId: setup.testGroup.id },
        { delay: 0 }
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      const payments = await db.payment.findMany({
        where: { groupId: setup.testGroup.id }
      });

      expect(payments).toHaveLength(3);
      expect(payments.every(p => p.status === PaymentStatus.Pending)).toBe(true);
      expect(payments.every(p => p.amount.toString() === '100')).toBe(true);
    });

    it('should handle failed payment creation gracefully', async () => {
        const mockPaymentIntent: Stripe.PaymentIntent & StripeResponseHelper = {
          id: 'pi_test',
          object: 'payment_intent',
          amount: 10000,
          currency: 'aud',
          status: 'succeeded',
          created: Math.floor(Date.now() / 1000),
          client_secret: 'pi_test_secret',
          livemode: false,
          payment_method: 'pm_test',
          payment_method_types: ['au_becs_debit'],
          customer: 'cus_test',
          metadata: {},
          amount_capturable: 0,
          amount_details: { tip: {} },
          amount_received: 0,
          application: null,
          application_fee_amount: null,
          automatic_payment_methods: null,
          canceled_at: null,
          cancellation_reason: null,
          capture_method: 'automatic',
          confirmation_method: 'automatic',
          latest_charge: null,
          description: null,
          invoice: null,
          next_action: null,
          on_behalf_of: null,
          payment_method_options: {},
          processing: null,
          receipt_email: null,
          review: null,
          setup_future_usage: null,
          shipping: null,
          statement_descriptor: null,
          statement_descriptor_suffix: null,
          transfer_data: null,
          transfer_group: null,
          lastResponse: {
            headers: {},
            requestId: 'req_test',
            statusCode: 200
          }
        };

      vi.mocked(stripe.paymentIntents.create)
        .mockResolvedValueOnce(mockPaymentIntent)
        .mockRejectedValueOnce(new Error('Payment failed'))
        .mockResolvedValueOnce(mockPaymentIntent);

      await contributionQueue.add(
        'start-contribution',
        { groupId: setup.testGroup.id },
        { delay: 0 }
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      const payments = await db.payment.findMany({
        where: { groupId: setup.testGroup.id }
      });

      expect(payments).toHaveLength(2);
      expect(payments.every(p => p.status === PaymentStatus.Pending)).toBe(true);
    });
  });

  describe('Payout Processing Tests', () => {
    beforeEach(async () => {
      await Promise.all(
        setup.testUsers.map(user =>
          db.payment.create({
            data: {
              groupId: setup.testGroup.id,
              userId: user.id,
              amount: new Prisma.Decimal(100),
              status: PaymentStatus.Successful,
              stripePaymentIntentId: `pi_${user.id}`,
            }
          })
        )
      );
    });

  it('should successfully process payout to next eligible member', async () => {
        const mockTransfer: Stripe.Transfer & StripeResponseHelper = {
          id: 'tr_test',
          object: 'transfer',
          amount: 30000,
          currency: 'aud',
          created: Math.floor(Date.now() / 1000),
          description: 'Test transfer',
          destination: 'acct_test',
          livemode: false,
          metadata: {},
          amount_reversed: 0,
          balance_transaction: 'txn_test',
          reversals: {
            object: 'list',
            data: [],
            has_more: false,
            total_count: 0,
            url: '/v1/transfers/tr_test/reversals'
          },
          reversed: false,
          source_transaction: null,
          transfer_group: null,
          lastResponse: {
            headers: {},
            requestId: 'req_test',
            statusCode: 200
          }
        };

        const mockBalance: Stripe.Balance & StripeResponseHelper = {
            object: 'balance',
            available: [{
              amount: 30000,
              currency: 'aud',
              source_types: {
                card: 30000
              }
            }],
            pending: [{
              amount: 30000,
              currency: 'aud',
              source_types: {
                card: 30000
              }
            }],
            connect_reserved: [],
            instant_available: [],
            issuing: {
              available: []
            },
            livemode: false,
            lastResponse: {
              headers: {},
              requestId: 'req_test',
              statusCode: 200
            }
          };

      vi.mocked(stripe.transfers.create).mockResolvedValue(mockTransfer);
      vi.mocked(stripe.balance.retrieve).mockResolvedValue(mockBalance);

      await payoutQueue.add(
        'process-payout',
        { groupId: setup.testGroup.id },
        { delay: 0 }
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      const payout = await db.payout.findFirst({
        where: { groupId: setup.testGroup.id }
      });

      expect(payout).toBeTruthy();
      expect(payout?.status).toBe(PayoutStatus.Completed);
      expect(payout?.amount.toString()).toBe('300');
      expect(payout?.payoutOrder).toBe(1);
    });

    it('should handle insufficient funds scenario', async () => {
        const mockTransfer: Stripe.Transfer & StripeResponseHelper = {
          id: 'tr_test',
          object: 'transfer',
          amount: 30000,
          currency: 'aud',
          created: Math.floor(Date.now() / 1000),
          description: 'Test transfer',
          destination: 'acct_test',
          livemode: false,
          metadata: {},
          amount_reversed: 0,
          balance_transaction: 'txn_test',
          reversals: {
            object: 'list',
            data: [],
            has_more: false,
            total_count: 0,
            url: '/v1/transfers/tr_test/reversals'
          },
          reversed: false,
          source_transaction: null,
          transfer_group: null,
          lastResponse: {
            headers: {},
            requestId: 'req_test',
            statusCode: 200
          }
        };

        const mockLowBalance: Stripe.Balance & StripeResponseHelper = {
            object: 'balance',
            available: [{
              amount: 1000,
              currency: 'aud',
              source_types: {
                card: 1000
              }
            }],
            pending: [{
              amount: 1000,
              currency: 'aud',
              source_types: {
                card: 1000
              }
            }],
            connect_reserved: [],
            instant_available: [],
            issuing: {
              available: []
            },
            livemode: false,
            lastResponse: {
              headers: {},
              requestId: 'req_test',
              statusCode: 200
            }
          };

      vi.mocked(stripe.transfers.create).mockResolvedValue(mockTransfer);
      vi.mocked(stripe.balance.retrieve).mockResolvedValue(mockLowBalance);

      await payoutQueue.add(
        'process-payout',
        { groupId: setup.testGroup.id },
        { delay: 0 }
      );

      await new Promise(resolve => setTimeout(resolve, 1000));

      const payout = await db.payout.findFirst({
        where: { groupId: setup.testGroup.id }
      });

      expect(payout).toBeNull();
    });
  });

  describe('Queue Error Handling', () => {
    it('should retry failed jobs with exponential backoff', async () => {
      vi.mocked(stripe.paymentIntents.create).mockRejectedValue(
        new Error('Temporary failure')
      );

      const job = await contributionQueue.add(
        'start-contribution',
        { groupId: setup.testGroup.id },
        { delay: 0 }
      );

      await new Promise(resolve => setTimeout(resolve, 5000));

      const jobStatus = await job.getState();
      expect(jobStatus).toBe('failed');

      const attempts = await job.attemptsMade;
      expect(attempts).toBe(3);
    });
  });
});