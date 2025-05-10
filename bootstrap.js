// bootstrap.js
console.log('🚀 Starting HivePay queue worker...');
console.log('📊 Worker process ID:', process.pid);

try {
  // Try to load the compiled JS version first
  console.log('Loading queue runner...');
  try {
    require('./queueRunner');
    console.log('✅ Queue runner loaded (JavaScript version)');
  } catch (err) {
    console.log('JavaScript version not found, falling back to TypeScript version...');
    console.log('Error was:', err.message);
    
    try {
      // Ensure ts-node is available
      require('ts-node/register');
      console.log('✅ ts-node registered successfully');
      
      // Load the TypeScript version
      require('./queueRunner.ts');
      console.log('✅ Queue runner loaded (TypeScript version)');
    } catch (tsErr) {
      console.error('❌ Failed to load TypeScript version:', tsErr);
      console.error('Stack trace:', tsErr.stack);
      process.exit(1);
    }
  }
  
  console.log('✅ HivePay queue worker initialized');
} catch (error) {
  console.error('❌ Fatal error during bootstrap:', error);
  console.error('Stack trace:', error.stack);
  process.exit(1);
}