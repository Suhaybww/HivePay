import { router, privateProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { generateContractPDF, sendContractEmail } from '../../lib/contracts';
import { ContractStatus, MembershipStatus } from '@prisma/client';
import { ContractData } from '@/src/types/contract';

export const contractRouter = router({
  // Step 1: Fetch the contract details
  fetchContractDetails: privateProcedure
    .input(z.object({
      groupId: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        });
      }

      const { groupId } = input;

      // Fetch group and membership details
      const [group, membership] = await Promise.all([
        db.group.findUnique({ where: { id: groupId } }),
        db.groupMembership.findFirst({
          where: {
            groupId,
            userId,
            status: MembershipStatus.Pending,
          },
        }),
      ]);

      if (!group || !membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group or membership not found',
        });
      }

      // Ensure a contract template exists, create default if missing
      let template = await db.contractTemplate.findFirst({
        orderBy: { effectiveDate: 'desc' },
      });

      if (!template) {
        try {
          console.log('Attempting to create a default template...');
          template = await db.contractTemplate.create({
            data: {
              version: 'v1',
              content: `
                HIVEPAY ROSCA GROUP CONTRACT TEMPLATE:
      
                TERMS AND CONDITIONS:
      
                1. The member agrees to contribute [CONTRIBUTION_AMOUNT] on a [PAYOUT_FREQUENCY] basis.
                2. The member acknowledges that failure to make contributions may result in legal action.
                3. The member agrees not to withdraw from the group after receiving their payout.
                4. The member understands that this is a legally binding agreement.
      
                Electronically signed by: [USER_NAME]
                Date: [DATE]
              `,
              effectiveDate: new Date(),
            },
          });
          console.log('Template created successfully:', template);
        } catch (error) {
          console.error('Error creating default template:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create default contract template.',
          });
        }
      }

      // Replace placeholders with actual values
      const contractContent = template.content
        .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
        .replace('[PAYOUT_FREQUENCY]', group.payoutFrequency || 'Monthly')
        .replace('[USER_NAME]', 'Your Name') // Placeholder for frontend to replace
        .replace('[DATE]', new Date().toISOString());

      return {
        contractContent,
      };
    }),

    // Step 2: Confirm and sign the contract
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

      // Fetch group, user, and membership details
      const [group, user, membership] = await Promise.all([
        db.group.findUnique({ where: { id: groupId } }),
        db.user.findUnique({ where: { id: userId } }),
        db.groupMembership.findFirst({
          where: {
            groupId,
            userId,
            status: MembershipStatus.Pending,
          },
        }),
      ]);

      if (!group || !user || !membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group, user, or membership not found',
        });
      }

      // Ensure a contract template exists, create default if missing
      let template = await db.contractTemplate.findFirst({
        orderBy: { effectiveDate: 'desc' },
      });

      if (!template) {
        try {
          console.log('Attempting to create a default template...');
          template = await db.contractTemplate.create({
            data: {
              version: 'v1',
              content: `
                HIVEPAY ROSCA GROUP CONTRACT TEMPLATE:
      
                TERMS AND CONDITIONS:
      
                1. The member agrees to contribute [CONTRIBUTION_AMOUNT] on a [PAYOUT_FREQUENCY] basis.
                2. The member acknowledges that failure to make contributions may result in legal action.
                3. The member agrees not to withdraw from the group after receiving their payout.
                4. The member understands that this is a legally binding agreement.
      
                Electronically signed by: [USER_NAME]
                Date: [DATE]
              `,
              effectiveDate: new Date(),
            },
          });
          console.log('Template created successfully:', template);
        } catch (error) {
          console.error('Error creating default template:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create default contract template.',
          });
        }
      }

      // Generate contract content
      const contractContent = template.content
        .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
        .replace('[PAYOUT_FREQUENCY]', group.payoutFrequency || 'Monthly')
        .replace('[USER_NAME]', fullName)
        .replace('[DATE]', new Date().toISOString());

      // Construct the complete ContractData object
      const contractData: ContractData = {
        groupName: group.name,
        userName: fullName,
        contributionAmount: group.contributionAmount?.toString() || '0',
        payoutFrequency: group.payoutFrequency || 'Monthly',
        signedAt: new Date(),
      };

      // Generate contract PDF
      const pdfBuffer = await generateContractPDF(contractData);

      // Use transaction for consistency
      const result = await db.$transaction(async (tx) => {
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

        const updatedMembership = await tx.groupMembership.update({
          where: { id: membership.id },
          data: { status: MembershipStatus.Active },
        });

        return { contract, membership: updatedMembership };
      });

      // Send email with the generated PDF using the same contractData
      await sendContractEmail(user.email, fullName, Buffer.from(pdfBuffer), contractData);

      return {
        success: true,
        contractId: result.contract.id,
        redirectUrl: `/groups/${groupId}`,
      };
    }),

});
