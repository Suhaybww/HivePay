export const dynamic = 'force-dynamic';
export const revalidate = 0;     // make sure there's zero revalidation
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { db } from '@/src/db';
import { sendContributionReminderEmail } from '@/src/lib/emailService';
import { addDays } from 'date-fns';
import { GroupStatus, MembershipStatus, Prisma } from '@prisma/client';

// Define the exact structure we expect from the database
interface UserData {
  email: string;
  firstName: string;
  lastName: string;
}

interface MembershipWithUser {
  user: UserData;
}

interface GroupWithMembers {
  id: string;
  name: string;
  contributionAmount: Prisma.Decimal | null;
  nextCycleDate: Date | null;
  groupMemberships: MembershipWithUser[];
}

export async function GET(req: Request) {
  const { db } = await import('@/src/db');
  try {
    console.log('Starting contribution reminder check...');
    
    const twoDaysFromNow = addDays(new Date(), 2);
    const startOfDay = new Date(twoDaysFromNow.setHours(0, 0, 0, 0));
    const endOfDay = new Date(twoDaysFromNow.setHours(23, 59, 59, 999));

    // Get base groups
    const baseGroups = await db.group.findMany({
      where: {
        status: GroupStatus.Active,
        cycleStarted: true,
        nextCycleDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: {
        id: true,
        name: true,
        contributionAmount: true,
        nextCycleDate: true,
      }
    });

    // Get memberships for each group with proper typing
    const groupsWithMembers: GroupWithMembers[] = await Promise.all(
      baseGroups.map(async (group) => {
        const memberships = await db.groupMembership.findMany({
          where: {
            groupId: group.id,
            status: MembershipStatus.Active,
          },
          select: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              }
            }
          }
        });

        return {
          ...group,
          groupMemberships: memberships as MembershipWithUser[]
        };
      })
    );

    let totalEmailsSent = 0;
    const emailErrors: Array<{ groupId: string; email: string; error: string }> = [];

    for (const group of groupsWithMembers) {
      if (!group.contributionAmount || !group.nextCycleDate) continue;

      for (const membership of group.groupMemberships) {
        const { user } = membership;
        
        try {
          await sendContributionReminderEmail({
            groupName: group.name,
            contributionAmount: group.contributionAmount,
            contributionDate: group.nextCycleDate,
            recipient: {
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
            },
          });

          totalEmailsSent++;
          console.log(`Successfully sent email to ${user.email}`);
        } catch (error) {
          console.error(`Failed to send email to ${user.email}:`, error);
          emailErrors.push({
            groupId: group.id,
            email: user.email,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        groupsChecked: groupsWithMembers.length,
        emailsSent: totalEmailsSent,
        emailErrors: emailErrors.length,
      },
      details: emailErrors.length > 0 ? { emailErrors } : undefined,
    });
  } catch (error) {
    console.error('Failed to process contribution reminders:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to send contribution reminders',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}