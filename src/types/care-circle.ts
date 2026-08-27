export type CareCircleRole = 'owner' | 'admin' | 'caregiver' | 'family';

export type CareCircleSummary = {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  role: CareCircleRole;
  memberCount: number;
  createdAt: string;
};

export type CareCircleMember = {
  userId: string;
  fullName: string;
  role: CareCircleRole;
  joinedAt: string;
};

export type CareCircleJoinRequest = {
  id: string;
  userId: string;
  fullName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

export type CareCircleActivityEvent =
  | 'medicine_added'
  | 'medicine_updated'
  | 'medicine_deleted'
  | 'member_joined'
  | 'member_left'
  | 'circle_updated'
  | 'dose_taken'
  | 'dose_snoozed'
  | 'dose_skipped'
  | 'dose_missed';

export type CareCircleActivity = {
  id: string;
  eventType: CareCircleActivityEvent;
  medicineId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  subjectUserId: string | null;
  subjectName: string | null;
  scheduledTime: string | null;
  actionAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type MyCareCircleRequest = {
  id: string;
  circleId: string;
  circleName: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
};

export type CareCircleDetails = CareCircleSummary & {
  members: CareCircleMember[];
  pendingRequests: CareCircleJoinRequest[];
  activity: CareCircleActivity[];
};

export type JoinCareCircleResult = {
  circleId: string;
  circleName: string;
  status: 'pending' | 'accepted' | 'member';
};
