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
import { ExternalLink, CreditCard, Wallet, ArrowUpRight, Download } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Skeleton } from '@/src/components/ui/skeleton';

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

export default function PaymentsPage() {
  // States
  const [activeSection, setActiveSection] = useState('transactions');
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [type, setType] = useState<'all' | 'contributions' | 'payouts'>('all');

  // Queries
  const { data: transactions, isLoading: isLoadingTransactions } = 
    trpc.payment.getUserTransactions.useQuery({ timeframe, type });
  const { data: upcomingPayments, isLoading: isLoadingUpcoming } = 
    trpc.payment.getUpcomingPayments.useQuery();
  const { data: paymentMethods, isLoading: isLoadingMethods } = 
    trpc.payment.getPaymentMethods.useQuery();
  const { data: accountStatus } = trpc.auth.getStripeAccountStatus.useQuery<StripeAccountStatus>();

  // Mutations
  const setupBECS = trpc.auth.setupBECSDirectDebit.useMutation();
  const createConnectAccount = trpc.auth.createStripeConnectAccount.useMutation();
  const stripeDashboard = trpc.auth.getStripeDashboardLink.useMutation();

  // Type guard function
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
      const { setupIntentClientSecret } = await setupBECS.mutateAsync();
      // Handle setup intent with Stripe Elements
    } catch (error) {
      console.error('Failed to set up BECS Direct Debit:', error);
    }
  };

  const handleConnectAccount = async () => {
    try {
      const { url } = await createConnectAccount.mutateAsync();
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
                      <p className={`font-medium ${
                        transaction.transactionType === 'Credit' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.transactionType === 'Credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <Badge variant={transaction.transactionType === 'Credit' ? 'success' : 'default'}>
                        {transaction.transactionType === 'Credit' ? 'Payout' : 'Contribution'}
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
                        Next contribution: {payment.nextContributionDate ? 
                          formatDate(payment.nextContributionDate) : 'Not scheduled'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {formatCurrency(payment.amount || 0)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Next payout: {payment.nextPayoutDate ? 
                          formatDate(payment.nextPayoutDate) : 'Not scheduled'}
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
                  <Button onClick={handleBECSSetup}>
                    Set up Direct Debit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

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
                        {accountStatus?.isOnboardingComplete ? 
                          'Ready to receive payments' : 
                          'Additional verification required'}
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
                        <Button 
                          onClick={handleConnectAccount}
                        >
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
                        <Badge variant={accountStatus.accountStatus.chargesEnabled ? "success" : "secondary"}>
                          {accountStatus.accountStatus.chargesEnabled ? "Charges Enabled" : "Charges Disabled"}
                        </Badge>
                        <Badge variant={accountStatus.accountStatus.payoutsEnabled ? "success" : "secondary"}>
                          {accountStatus.accountStatus.payoutsEnabled ? "Payouts Enabled" : "Payouts Disabled"}
                        </Badge>
                      </div>

                      {/* Requirements Section */}
                      {(accountStatus.accountStatus.currentlyDue.length > 0 ||
                        accountStatus.accountStatus.pastDue.length > 0) && (
                        <Alert className="mt-4">
                          <AlertDescription>
                            <div className="space-y-2">
                              {accountStatus.accountStatus.currentlyDue.length > 0 && (
                                <p>Required information: {accountStatus.accountStatus.currentlyDue.join(", ")}</p>
                              )}
                              {accountStatus.accountStatus.pastDue.length > 0 && (
                                <p className="text-red-500">
                                  Past due requirements: {accountStatus.accountStatus.pastDue.join(", ")}
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
    </div>
  </div>
);
}