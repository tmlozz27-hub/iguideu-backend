// debug-env.cjs
require('dotenv').config();

console.log('================ DEBUG ENV STRIPE ================');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('PUBLIC_BASE_URL:', process.env.PUBLIC_BASE_URL);

console.log('\n--- Stripe vars (raw) ---');
console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY || '<MISSING>');
console.log('STRIPE_PUBLISHABLE_KEY:', process.env.STRIPE_PUBLISHABLE_KEY || '<MISSING>');
console.log('STRIPE_WEBHOOK_SECRET:', process.env.STRIPE_WEBHOOK_SECRET || '<MISSING>');

console.log('\n--- Stripe vars (boolean) ---');
console.log('has STRIPE_SECRET_KEY?', !!process.env.STRIPE_SECRET_KEY);
console.log('has STRIPE_PUBLISHABLE_KEY?', !!process.env.STRIPE_PUBLISHABLE_KEY);
console.log('has STRIPE_WEBHOOK_SECRET?', !!process.env.STRIPE_WEBHOOK_SECRET);

console.log('\nFull .env path loaded from:', require('path').resolve(__dirname, '.env'));
console.log('===================================================');
