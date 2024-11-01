import { handleAuth, handleLogin } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
  signup: handleLogin({
    returnTo: '/dashboard',
    authorizationParams: {
      screen_hint: 'signup',
      scope: 'openid profile email phone',
      prompt: 'signup',
      // Custom parameters to force display of signup form fields
      signup_params: {
        require_name: true,
        require_phone: true,
        password_policy: 'strong',
        // Australian phone format
        phone_format: '^(?:\\+?61|0)[2-478](?:[ -]?[0-9]){8}$'
      }
    }
  }),
  login: handleLogin({
    returnTo: '/dashboard',
    authorizationParams: {
      scope: 'openid profile email phone'
    }
  })
});