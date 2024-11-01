import { User } from '@auth0/nextjs-auth0';

declare module '@auth0/nextjs-auth0' {
  export interface UserProfile extends User {
    email_verified?: boolean;
    picture?: string;
  }
}