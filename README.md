# CirclePay

CirclePay is a SaaS platform designed to automate traditional rotating savings and credit associations (ROSCAs). This platform allows users to create savings groups, set up automated payments via direct debit, and manage contributions seamlessly.

## Tech Stack

### Backend
- **API**: NextJS API serverless functions
- **Database**: MongoDB with Mongoose
- **Email Service**: (Service to be decided)
- **Payment Integration**:
  - Stripe for user subscriptions
  - Direct debit for users via their BankID and PayID
- **Deployment**:
  - **Website**: Vercel
  - **Database Hosting**: MongoDB Atlas

### Frontend
- **Framework**: React with NextJS
- **Styling**: Tailwind CSS, DaisyUI & acernityUI
- **Authentication**: Auth0 with prebuilt frontend components and seamless connection to MongoDB

## Features

- **User Authentication**: Secure user sign-up and login using Auth0.
- **Automated Payments**: Users can set up direct debits linked to their BankID and PayID for automated contributions.
- **Subscription Management**: Stripe integration for managing user subscriptions.
- **Real-time Notifications**: Email notifications for payment success, failures, and reminders.
- **Responsive Design**: Tailwind CSS and DaisyUI ensure a smooth and responsive user interface.

## Getting Started

### Prerequisites

- Node.js (>= 14.x)
- npm or yarn
- MongoDB Atlas account
- Vercel account
- Auth0 account
- Stripe account

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/CirclePay.git
   cd CirclePay
