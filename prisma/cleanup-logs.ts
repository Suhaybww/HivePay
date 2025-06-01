
//! FOR DB DELETION

npx prisma db execute --stdin << 'EOF'
DELETE FROM "PaymentRecoveryLog";
DELETE FROM "GroupRecoveryLog";
DELETE FROM "WorkerHeartbeat";
DELETE FROM "WorkerHealthLog";
DELETE FROM "Transaction";
DELETE FROM "Payment";
DELETE FROM "Payout";
DELETE FROM "GroupCycle";
DELETE FROM "ScheduledJobLog";
EOF

//! FOR REDIS DELETION

redis-cli --tls -u redis://default:AUHKAAIjcDExNWU1ZjE2NDlmNDM0MDRlYmQ5YzkxNjRmZjAzZGEyY3AxMA@diverse-stingray-16842.upstash.io:6379 KEYS "{hivepay}:*" | xargs redis-cli --tls -u redis://default:AUHKAAIjcDExNWU1ZjE2NDlmNDM0MDRlYmQ5YzkxNjRmZjAzZGEyY3AxMA@diverse-stingray-16842.upstash.io:6379 DEL