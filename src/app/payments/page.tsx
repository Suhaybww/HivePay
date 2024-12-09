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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/src/components/ui/tabs';
import { format } from 'date-fns';
import { Download, CreditCard, Wallet, ArrowUpRight, Ban } from 'lucide-react';
import { Badge } from '@/src/components/ui/badge';
import { Alert, AlertDescription } from '@/src/components/ui/alert';
import { Skeleton } from '@/src/components/ui/skeleton';

export default function PaymentsPage() {
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month' | 'year'>('all');
  const [type, setType] = useState<'all' | 'contributions' | 'payouts'>('all');

  // Queries
  const { data: transactions, isLoading: isLoadingTransactions } = 
    trpc.payment.getUserTransactions.useQuery({ timeframe, type });
  const { data: upcomingPayments, isLoading: isLoadingUpcoming } = 
    trpc.payment.getUpcomingPayments.useQuery();
  const { data: paymentMethods, isLoading: isLoadingMethods } = 
    trpc.payment.getPaymentMethods.useQuery();

  // Mutations
  const setupBECS = trpc.auth.setupBECSDirectDebit.useMutation();
  const createConnectAccount = trpc.auth.createStripeConnectAccount.useMutation();

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
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold mb-6">Payments & Transactions</h1>

      <Tabs defaultValue="transactions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming Payments</TabsTrigger>
          <TabsTrigger value="payment-methods">Payment Methods</TabsTrigger>
        </TabsList>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <Select value={timeframe} onValueChange={(val: any) => setTimeframe(val)}>
                <SelectTrigger className="w-[180px]">
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
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Transaction type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All transactions</SelectItem>
                  <SelectItem value="contributions">Contributions</SelectItem>
                  <SelectItem value="payouts">Payouts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
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
        </TabsContent>

        {/* Upcoming Payments Tab */}
        <TabsContent value="upcoming" className="space-y-4">
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
        </TabsContent>

        {/* Payment Methods Tab */}
        <TabsContent value="payment-methods" className="space-y-6">
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
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Account connected</p>
                    <p className="text-sm text-gray-500">
                      {paymentMethods.connectAccount.charges_enabled ? 
                        'Ready to receive payments' : 
                        'Additional verification required'}
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={handleConnectAccount}
                  >
                    Update Account
                    <ArrowUpRight className="w-4 h-4 ml-2" />
                  </Button>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}