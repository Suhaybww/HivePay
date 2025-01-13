'use client';

import { useState } from 'react';
import { trpc } from '@/src/app/_trpc/client';
import { Button } from '@/src/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { format } from 'date-fns';
import {
  ExternalLink,
  CreditCard,
  Wallet,
  ArrowUpRight,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Skeleton } from '@/src/components/ui/skeleton';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { StripeElementsOptions } from '@stripe/stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { useToast } from '@/src/components/ui/use-toast';

// ------------------------------------------------------------------
// Stripe Setup
// ------------------------------------------------------------------
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface StripeAccountStatus {
  hasConnectedAccount: boolean;
  isOnboardingComplete: boolean;
  accountStatus?: {
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    currentlyDue: string[];
    pastDue: string[];
    eventuallyDue: string[];
    pendingVerification: string[];
  };
}

interface BECSFormProps {
  clientSecret: string;
  onSuccess: () => void;
  isUpdate: boolean;
}

// ------------------------------------------------------------------
// BECS Form Component
// ------------------------------------------------------------------
const BECSForm = ({ clientSecret, onSuccess, isUpdate }: BECSFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) throw submitError;

      const element = elements.getElement(PaymentElement);
      if (!element) throw new Error('Payment element not found');

      const result = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (result.error) throw result.error;

      toast({
        title: isUpdate ? 'Payment Method Updated' : 'Payment Method Added',
        description: 'Your bank account has been successfully set up for direct debit.',
      });

      onSuccess();
    } catch (err: any) {
      console.error('BECS setup error:', err);
      setError(err.message || 'An error occurred during setup.');
      toast({
        variant: 'destructive',
        title: 'Setup Failed',
        description: err.message || 'Failed to set up direct debit.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PaymentElement 
        options={{
          layout: 'tabs',
          defaultValues: {
            billingDetails: {
              name: '',
              email: ''
            }
          }
        }}
      />

      <Button 
        type="submit" 
        disabled={!stripe || isProcessing}
        className="w-full bg-yellow-400 hover:bg-yellow-500 text-white"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="mr-2 h-4 w-4" />
            {isUpdate ? 'Update Payment Method' : 'Set Up Direct Debit'}
          </>
        )}
      </Button>
    </form>
  );
};

// ------------------------------------------------------------------
// Main Payments Page Component
// ------------------------------------------------------------------
export default function PaymentsPage() {
  const { toast } = useToast();
  const utils = trpc.useContext();

  // States
  const [activeSection, setActiveSection] = useState<'transactions' | 'upcoming' | 'methods'>(
    'transactions'
  );
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [type, setType] = useState<'all' | 'contributions' | 'payouts'>('all');
  const [showBECSSetupDialog, setShowBECSSetupDialog] = useState(false);
  const [setupIntentClientSecret, setSetupIntentClientSecret] = useState<string | null>(null);

  // Queries
  const { data: transactions, isLoading: isLoadingTransactions } = 
    trpc.payment.getUserTransactions.useQuery({ timeframe, type });
  const { data: upcomingPayments, isLoading: isLoadingUpcoming } = 
    trpc.payment.getUpcomingPayments.useQuery();
  const { data: paymentMethods, isLoading: isLoadingMethods } = 
    trpc.payment.getPaymentMethods.useQuery();
  const { data: accountStatus } = trpc.stripe.getStripeAccountStatus.useQuery<StripeAccountStatus>();

  // Mutations
  const setupBECS = trpc.stripe.setupBECSDirectDebit.useMutation();
  const createConnectAccount = trpc.stripe.createStripeConnectAccount.useMutation();
  const stripeDashboard = trpc.stripe.getStripeDashboardLink.useMutation();

  // Type guard: ensures accountStatus has a defined `.accountStatus`
  const hasAccountStatus = (
    status: StripeAccountStatus
  ): status is StripeAccountStatus & { accountStatus: NonNullable<StripeAccountStatus['accountStatus']> } => {
    return status.hasConnectedAccount && !!status.accountStatus;
  };

  // Handlers
  const handleDashboardAccess = async () => {
    try {
      const result = await stripeDashboard.mutateAsync();
      if (result?.url) window.open(result.url, '_blank');
    } catch (error) {
      console.error('Failed to access Stripe dashboard:', error);
    }
  };

  const handleBECSSetup = async () => {
    try {
      const result = await setupBECS.mutateAsync();
      if (result.success) {
        setSetupIntentClientSecret(result.setupIntentClientSecret);
        setShowBECSSetupDialog(true);
      }
    } catch (error) {
      console.error('BECS setup error:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to initiate BECS setup.',
      });
    }
  };

  const handleBECSSetupDone = async () => {
    setShowBECSSetupDialog(false);
    setSetupIntentClientSecret(null);
    await utils.payment.getPaymentMethods.invalidate();
  };

  // ------------------------------------------------------------------
  // FIX: Pass the required `groupId` when calling `createConnectAccount`
  // ------------------------------------------------------------------
  const handleConnectAccount = async () => {
    try {
      // You may retrieve the actual group ID from your router or state
      // For example:
      // const { query } = useRouter();
      // const groupId = query.groupId as string;

      // For now, just use a placeholder:
      const groupId = 'SOME_GROUP_ID';

      const { url } = await createConnectAccount.mutateAsync({ groupId });
      if (url) window.location.href = url;
    } catch (error) {
      console.error('Failed to create Connect account:', error);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(Number(amount));
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'PPP');
  };

  return (
    <div className="container mx-auto px-6">
      <h1 className="text-2xl font-bold py-6">Payments & Transactions</h1>
  
      {/* Segmented Navigation */}
      <div className="border-b mb-8">
        <div className="flex flex-wrap -mb-px">
          <button
            onClick={() => setActiveSection('transactions')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'transactions' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Transactions
          </button>
          <button
            onClick={() => setActiveSection('upcoming')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'upcoming' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Upcoming Payments
          </button>
          <button
            onClick={() => setActiveSection('methods')}
            className={`inline-flex items-center px-6 py-4 border-b-2 font-medium text-sm transition-colors
              ${activeSection === 'methods' 
                ? 'border-yellow-400 text-black' 
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            Payment Methods
          </button>
        </div>
      </div>
  
      {/* Content Area */}
      <div className="space-y-6">
        {/* Transactions Section */}
        {activeSection === 'transactions' && (
          <div className="space-y-6">
            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4 sm:items-center sm:justify-between">
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Select value={timeframe} onValueChange={(val: any) => setTimeframe(val)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Timeframe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All time</SelectItem>
                    <SelectItem value="week">Past week</SelectItem>
                    <SelectItem value="month">Past month</SelectItem>
                    <SelectItem value="year">Past year</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={type} onValueChange={(val: any) => setType(val)}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Transaction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All transactions</SelectItem>
                    <SelectItem value="contributions">Contributions</SelectItem>
                    <SelectItem value="payouts">Payouts</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoadingTransactions ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : transactions?.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No transactions found for the selected filters.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {transactions?.map((transaction) => (
                  <Card key={transaction.id}>
                    <CardContent className="flex justify-between items-center p-4">
                      <div>
                        <p className="font-medium">{transaction.group.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatDate(transaction.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-medium ${
                            transaction.transactionType === 'Credit'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {transaction.transactionType === 'Credit' ? '+' : '-'}
                          {formatCurrency(transaction.amount)}
                        </p>
                        <Badge
                          variant={
                            transaction.transactionType === 'Credit'
                              ? 'success'
                              : 'default'
                          }
                        >
                          {transaction.transactionType === 'Credit'
                            ? 'Payout'
                            : 'Contribution'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Payments Section */}
        {activeSection === 'upcoming' && (
          <div className="space-y-4">
            {isLoadingUpcoming ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : upcomingPayments?.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No upcoming payments scheduled.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-4">
                {upcomingPayments?.map((payment) => (
                  <Card key={payment.groupId}>
                    <CardContent className="flex justify-between items-center p-4">
                      <div>
                        <p className="font-medium">{payment.groupName}</p>
                        <p className="text-sm text-gray-500">
                          Next contribution:{' '}
                          {payment.nextCycleDate
                            ? formatDate(payment.nextCycleDate)
                            : 'Not scheduled'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(payment.amount || 0)}
                        </p>
                        <p className="text-sm text-gray-500">
                          Next payout:{' '}
                          {payment.nextCycleDate
                            ? formatDate(payment.nextCycleDate)
                            : 'Not scheduled'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Payment Methods Section */}
        {activeSection === 'methods' && (
          <div className="space-y-6">
            {/* BECS Direct Debit */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  BECS Direct Debit
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentMethods?.becsSetup ? (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium">Bank account connected</p>
                      <p className="text-sm text-gray-500">
                        Last 4 digits: {paymentMethods.becsSetup.au_becs_debit?.last4}
                      </p>
                    </div>
                    <Button variant="outline" onClick={handleBECSSetup}>
                      Update
                    </Button>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p>No bank account connected</p>
                    <Button onClick={handleBECSSetup}>Set up Direct Debit</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stripe Connect Account */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Wallet className="w-5 h-5 mr-2" />
                  Stripe Connect Account
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentMethods?.connectAccount ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">Account connected</p>
                        <p className="text-sm text-gray-500">
                          {accountStatus?.isOnboardingComplete
                            ? 'Ready to receive payments'
                            : 'Additional verification required'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {accountStatus?.isOnboardingComplete ? (
                          <Button
                            variant="outline"
                            onClick={handleDashboardAccess}
                            className="flex items-center"
                          >
                            View Dashboard
                            <ExternalLink className="w-4 h-4 ml-2" />
                          </Button>
                        ) : (
                          <Button onClick={handleConnectAccount}>
                            Complete Setup
                            <ArrowUpRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Account Status Details */}
                    {accountStatus && hasAccountStatus(accountStatus) && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              accountStatus.accountStatus.chargesEnabled
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {accountStatus.accountStatus.chargesEnabled
                              ? 'Charges Enabled'
                              : 'Charges Disabled'}
                          </Badge>
                          <Badge
                            variant={
                              accountStatus.accountStatus.payoutsEnabled
                                ? 'success'
                                : 'secondary'
                            }
                          >
                            {accountStatus.accountStatus.payoutsEnabled
                              ? 'Payouts Enabled'
                              : 'Payouts Disabled'}
                          </Badge>
                        </div>

                        {/* Requirements Section */}
                        {(accountStatus.accountStatus.currentlyDue.length > 0 ||
                          accountStatus.accountStatus.pastDue.length > 0) && (
                          <Alert className="mt-4">
                            <AlertDescription>
                              <div className="space-y-2">
                                {accountStatus.accountStatus.currentlyDue.length > 0 && (
                                  <p>
                                    Required information:{' '}
                                    {accountStatus.accountStatus.currentlyDue.join(', ')}
                                  </p>
                                )}
                                {accountStatus.accountStatus.pastDue.length > 0 && (
                                  <p className="text-red-500">
                                    Past due requirements:{' '}
                                    {accountStatus.accountStatus.pastDue.join(', ')}
                                  </p>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <p>No payout account connected</p>
                    <Button onClick={handleConnectAccount}>
                      Connect Account
                      <ArrowUpRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* BECS Setup Dialog */}
        {setupIntentClientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret: setupIntentClientSecret,
              appearance: { theme: 'stripe' },
              loader: 'auto',
            } as StripeElementsOptions}
          >
            <Dialog open={showBECSSetupDialog} onOpenChange={setShowBECSSetupDialog}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {paymentMethods?.becsSetup
                      ? 'Update Payment Method'
                      : 'Set Up Direct Debit'}
                  </DialogTitle>
                </DialogHeader>
                <div className="p-6">
                  <BECSForm
                    clientSecret={setupIntentClientSecret}
                    onSuccess={handleBECSSetupDone}
                    isUpdate={!!paymentMethods?.becsSetup}
                  />
                </div>
              </DialogContent>
            </Dialog>
          </Elements>
        )}
      </div>
    </div>
  );
}
