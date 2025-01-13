// src/trpc/routers/contract.ts

import { router, privateProcedure } from '../trpc';
import { z } from 'zod';
import { db } from '../../db';
import { TRPCError } from '@trpc/server';
import { generateContractPDF, sendContractEmail } from '../../lib/contracts';
import { ContractStatus, MembershipStatus } from '@prisma/client';
import { ContractData } from '@/src/types/contract';

export const contractRouter = router({
  /**
   * fetchContractDetails
   * Step 1: Client fetches contract template + placeholders
   * so user can preview & sign.
   */
  fetchContractDetails: privateProcedure
    .input(z.object({ groupId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { userId } = ctx;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'User ID is required',
        });
      }

      const { groupId } = input;

      // 1) Load group + membership
      const [group, membership] = await Promise.all([
        db.group.findUnique({ where: { id: groupId } }),
        db.groupMembership.findFirst({
          where: { groupId, userId, status: MembershipStatus.Pending },
        }),
      ]);

      if (!group || !membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group or membership not found',
        });
      }

      // 2) Ensure we have a contract template
      let template = await db.contractTemplate.findFirst({
        orderBy: { effectiveDate: 'desc' },
      });

      if (!template) {
        try {
          console.log('No contract template found. Creating a default one...');
          template = await db.contractTemplate.create({
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
          console.log('Default template created successfully.');
        } catch (error) {
          console.error('Error creating default template:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create default contract template.',
          });
        }
      }

      // 3) Replace placeholders
      const contractContent = template.content
        .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
        .replace('[CYCLE_FREQUENCY]', group.cycleFrequency || 'Monthly')
        .replace('[USER_NAME]', 'Your Name')  // The front end can replace or show a preview
        .replace('[DATE]', new Date().toISOString());

      return {
        contractContent,
      };
    }),

  /**
   * signGroupContract
   * Step 2: user confirms + signs. 
   * We create the Contract record, update membership => Active, 
   * generate PDF, and email it.
   */
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

      // 1) Load group, user, membership
      const [group, user, membership] = await Promise.all([
        db.group.findUnique({ where: { id: groupId } }),
        db.user.findUnique({ where: { id: userId } }),
        db.groupMembership.findFirst({
          where: { groupId, userId, status: MembershipStatus.Pending },
        }),
      ]);

      if (!group || !user || !membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group, user, or membership not found',
        });
      }

      // 2) Load or create contract template
      let template = await db.contractTemplate.findFirst({
        orderBy: { effectiveDate: 'desc' },
      });

      if (!template) {
        try {
          console.log('No contract template found. Creating a default one...');
          template = await db.contractTemplate.create({
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
        } catch (error) {
          console.error('Error creating default template:', error);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create default contract template.',
          });
        }
      }

      // 3) Build final contract content
      const contractContent = template.content
        .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
        .replace('[CYCLE_FREQUENCY]', group.cycleFrequency || 'Monthly')
        .replace('[USER_NAME]', fullName)
        .replace('[DATE]', new Date().toISOString());

      // 4) Construct ContractData for PDF
      const contractData: ContractData = {
        groupName: group.name,
        userName: fullName,
        contributionAmount: group.contributionAmount?.toString() || '0',
        // same frequency used for "payout" concept
        payoutFrequency: group.cycleFrequency || 'Monthly',
        signedAt: new Date(),
      };

      // 5) Generate PDF
      const pdfBuffer = await generateContractPDF(contractData);

      // 6) Save to DB in a transaction
      const result = await db.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            contractTemplateId: template!.id,
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
          data: {
            status: MembershipStatus.Active,
            acceptedTOSAt: new Date(),
          },
        });

        return { contract, membership: updatedMembership };
      });

      // 7) Email user the PDF
      await sendContractEmail(user.email, fullName, Buffer.from(pdfBuffer), contractData);

      return {
        success: true,
        contractId: result.contract.id,
        redirectUrl: `/groups/${groupId}`,  // or wherever you want
      };
    }),

  /**
   * createAndSignOwnerContract
   * Similar to signGroupContract, but specifically for the group creator (admin).
   * Often called immediately after group creation, so the owner also signs the contract.
   */
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

      // 1) Load group, user, membership (should be admin + Pending)
      const [group, user, membership] = await Promise.all([
        db.group.findUnique({ where: { id: groupId } }),
        db.user.findUnique({ where: { id: userId } }),
        db.groupMembership.findFirst({
          where: { groupId, userId, isAdmin: true, status: MembershipStatus.Pending },
        }),
      ]);

      if (!group || !user || !membership) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Group, user, or admin membership not found',
        });
      }

      // 2) Load or create contract template
      let template = await db.contractTemplate.findFirst({
        orderBy: { effectiveDate: 'desc' },
      });
      if (!template) {
        template = await db.contractTemplate.create({
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

      // 3) Build final contract content
      const contractContent = template.content
        .replace('[CONTRIBUTION_AMOUNT]', group.contributionAmount?.toString() || '0')
        .replace('[CYCLE_FREQUENCY]', group.cycleFrequency || 'Monthly')
        .replace('[USER_NAME]', fullName)
        .replace('[DATE]', new Date().toISOString());

      // 4) Construct ContractData for PDF
      const contractData: ContractData = {
        groupName: group.name,
        userName: fullName,
        contributionAmount: group.contributionAmount?.toString() || '0',
        payoutFrequency: group.cycleFrequency || 'Monthly',
        signedAt: new Date(),
      };

      // 5) Generate PDF
      const pdfBuffer = await generateContractPDF(contractData);

      // 6) Save to DB in a transaction
      const result = await db.$transaction(async (tx) => {
        const contract = await tx.contract.create({
          data: {
            contractTemplateId: template!.id,
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
          data: {
            status: MembershipStatus.Active,
            acceptedTOSAt: new Date(),
          },
        });

        return { contract, membership: updatedMembership };
      });

      // 7) Email user the PDF
      await sendContractEmail(user.email, fullName, Buffer.from(pdfBuffer), contractData);

      return {
        success: true,
        contractId: result.contract.id,
      };
    }),
});
