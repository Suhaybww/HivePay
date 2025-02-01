// src/trpc/routers/contract.ts

import { router, privateProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { generateContractPDF, sendContractEmail } from '../../lib/contracts';
import { ContractStatus, MembershipStatus } from '@prisma/client';
import { ContractData } from '@/src/types/contract';

export const contractRouter = router({
  signGroupContract: privateProcedure
    .input(z.object({
      groupId: z.string(),
      fullName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        });
      }

      const { groupId, fullName } = input;

      return await db.$transaction(async (tx) => {
        try {
          // 1) Load group, user, membership - all must exist
          const [group, user, membership] = await Promise.all([
            tx.group.findUnique({ where: { id: groupId } }),
            tx.user.findUnique({ where: { id: userId } }),
            tx.groupMembership.findFirst({
              where: { 
                groupId, 
                userId, 
                status: MembershipStatus.Pending 
              },
            }),
          ]);

          if (!group || !user || !membership) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Group, user, or membership not found',
            });
          }

          // 2) Load or create contract template
          let template = await tx.contractTemplate.findFirst({
            orderBy: { effectiveDate: 'desc' },
          });

          if (!template) {
            template = await tx.contractTemplate.create({
              data: {
                version: 'v1',
                content: `
                  HIVEPAY ROSCA GROUP CONTRACT TEMPLATE:
                  TERMS AND CONDITIONS:
                  1. The member agrees to contribute [CONTRIBUTION_AMOUNT] on a [CYCLE_FREQUENCY] basis.
                  2. The member acknowledges that failure to make contributions may result in legal action.
                  3. The member agrees not to withdraw from the group after receiving their payout.
                  4. The member understands that this is a legally binding agreement.
                  Electronically signed by: [USER_NAME]
                  Date: [DATE]
                `,
                effectiveDate: new Date(),
              },
            });
          }

          // 3) Build contract content
          const contractContent = template.content
            .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
            .replace('[CYCLE_FREQUENCY]', group.cycleFrequency || 'Monthly')
            .replace('[USER_NAME]', fullName)
            .replace('[DATE]', new Date().toISOString());

          // 4) Generate PDF data
          const contractData: ContractData = {
            groupName: group.name,
            userName: fullName,
            contributionAmount: group.contributionAmount?.toString() || '0',
            payoutFrequency: group.cycleFrequency || 'Monthly',
            signedAt: new Date(),
          };

          const pdfBytes = await generateContractPDF(contractData);
          const pdfBuffer = Buffer.from(pdfBytes);

          // 5) Create contract record
          const contract = await tx.contract.create({
            data: {
              contractTemplateId: template.id,
              groupId,
              userId,
              status: ContractStatus.Signed,
              signedContent: contractContent,
              signedAt: new Date(),
              fullName,
            },
          });

          // 6) Send email
          await sendContractEmail(user.email, fullName, pdfBuffer, contractData);

          // 7) Update membership status only after everything else succeeds
          await tx.groupMembership.update({
            where: { id: membership.id },
            data: {
              status: MembershipStatus.Active,
              acceptedTOSAt: new Date(),
            },
          });

          return {
            success: true,
            contractId: contract.id,
            redirectUrl: `/groups/${groupId}`,
          };
        } catch (error) {
          console.error('Contract signing failed:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Contract signing failed',
          });
        }
      });
    }),

  createAndSignOwnerContract: privateProcedure
    .input(z.object({
      groupId: z.string(),
      fullName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        });
      }

      const { groupId, fullName } = input;

      return await db.$transaction(async (tx) => {
        try {
          // Similar structure to signGroupContract...
          const [group, user, membership] = await Promise.all([
            tx.group.findUnique({ where: { id: groupId } }),
            tx.user.findUnique({ where: { id: userId } }),
            tx.groupMembership.findFirst({
              where: { 
                groupId, 
                userId, 
                isAdmin: true,
                status: MembershipStatus.Pending 
              },
            }),
          ]);

          if (!group || !user || !membership) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Group, user, or admin membership not found',
            });
          }

          let template = await tx.contractTemplate.findFirst({
            orderBy: { effectiveDate: 'desc' },
          });

          if (!template) {
            template = await tx.contractTemplate.create({
              data: {
                version: 'v1',
                content: `
                  HIVEPAY ROSCA GROUP CONTRACT TEMPLATE:
                  TERMS AND CONDITIONS:
                  1. The member agrees to contribute [CONTRIBUTION_AMOUNT] on a [CYCLE_FREQUENCY] basis.
                  2. The member acknowledges that failure to make contributions may result in legal action.
                  3. The member agrees not to withdraw from the group after receiving their payout.
                  4. The member understands that this is a legally binding agreement.
                  Electronically signed by: [USER_NAME]
                  Date: [DATE]
                `, // Same template content as above
                effectiveDate: new Date(),
              },
            });
          }

          const contractContent = template.content
            .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
            .replace('[CYCLE_FREQUENCY]', group.cycleFrequency || 'Monthly')
            .replace('[USER_NAME]', fullName)
            .replace('[DATE]', new Date().toISOString());

          const contractData: ContractData = {
            groupName: group.name,
            userName: fullName,
            contributionAmount: group.contributionAmount?.toString() || '0',
            payoutFrequency: group.cycleFrequency || 'Monthly',
            signedAt: new Date(),
          };

          const pdfBytes = await generateContractPDF(contractData);
          const pdfBuffer = Buffer.from(pdfBytes);

          const contract = await tx.contract.create({
            data: {
              contractTemplateId: template.id,
              groupId,
              userId,
              status: ContractStatus.Signed,
              signedContent: contractContent,
              signedAt: new Date(),
              fullName,
            },
          });

          await sendContractEmail(user.email, fullName, pdfBuffer, contractData);

          await tx.groupMembership.update({
            where: { id: membership.id },
            data: {
              status: MembershipStatus.Active,
              acceptedTOSAt: new Date(),
            },
          });

          return {
            success: true,
            contractId: contract.id,
            redirectUrl: `/groups/${groupId}`,
          };
        } catch (error) {
          console.error('Owner contract signing failed:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : 'Owner contract signing failed',
          });
        }
      });
    }),
});

export type ContractRouter = typeof contractRouter;