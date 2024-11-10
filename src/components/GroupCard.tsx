
import React from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Pencil, LogOut } from 'lucide-react';
import { GroupWithStats } from '../types/groups';
import { Button } from './ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Badge } from './ui/badge';

interface GroupCardProps {
  group: GroupWithStats;
}

export const GroupCard: React.FC<GroupCardProps> = ({ group }) => {
  const router = useRouter();

  return (
    <Card className="flex flex-col shadow-md hover:shadow-lg transition-shadow duration-300">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold text-gray-800">
            {group.name}
          </CardTitle>
          <Badge variant="outline" className="text-sm">
            {group.contributionFrequency || 'N/A'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
        <p className="text-gray-600 mb-4">
          {group.description || 'No description available.'}
        </p>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <span className="font-medium">Members:</span>{' '}
            {group._count.groupMemberships}
          </p>
          <p>
            <span className="font-medium">Next Contribution Date:</span>{' '}
            {group.nextContributionDate
              ? new Date(group.nextContributionDate).toLocaleDateString()
              : 'N/A'}
          </p>
          <p>
            <span className="font-medium">Total Contributions:</span> $
            {group.totalContributions}
          </p>
          <p>
            <span className="font-medium">Current Balance:</span> $
            {group.currentBalance}
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between items-center mt-auto">
        <Button
          variant="ghost"
          className="text-purple-600 hover:bg-purple-50"
          onClick={() => router.push(`/groups/${group.id}`)}
        >
          <Eye className="w-4 h-4 mr-1" /> View Details
        </Button>
        <div className="flex gap-2">
          {group.isAdmin && (
            <Button
              variant="ghost"
              className="text-purple-600 hover:bg-purple-50"
              onClick={() => router.push(`/groups/${group.id}/edit`)}
            >
              <Pencil className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-red-600 hover:bg-red-50"
            onClick={() => {
              // Handle leave group
            }}
          >
            <LogOut className="w-4 h-4 mr-1" /> Leave
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
