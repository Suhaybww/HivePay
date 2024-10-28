export const PLANS = [
    {
      name: 'Free',
      slug: 'free',
      quota: 0,
      description: 'For individuals starting their savings journey',
      features: [
        'Up to 5 users, 1 admin',
        '1 savings group',
        'Basic analytics',
        'Standard support',
        '250 payout cycle limit'
      ],
      price: {
        amount: 0,
        priceIds: {
          test: '',
          production: '',
        },
      },
    },
    {
      name: 'Pro',
      slug: 'pro',
      quota: 9.99,
      description: 'For established savings groups that need more flexibility',
      features: [
        'Up to 100 users, 3 admins',
        'Up to 20 savings groups',
        'Advanced analytics',
        'Priority support',
        'Unlimited payout cycles'
      ],
      price: {
        amount: 9.99,
        priceIds: {
          test: 'price_test_id_pro',
          production: 'price_prod_id_pro',
        },
      },
    },
  ];