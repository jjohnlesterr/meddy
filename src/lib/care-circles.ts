import { executeSupabaseRequest, supabase, supabaseConfigurationError } from '@/lib/supabase';
import type {
  CareCircleDetails,
  CareCircleActivity,
  CareCircleActivityEvent,
  CareCircleJoinRequest,
  CareCircleMember,
  CareCircleRole,
  CareCircleSummary,
  JoinCareCircleResult,
  MyCareCircleRequest,
} from '@/types/care-circle';

type CircleRow = {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
};

type MembershipRow = {
  circle_id: string;
  role: CareCircleRole;
  joined_at: string;
  care_circles: CircleRow | CircleRow[];
};

type JoinRequestRow = {
  id: string;
  circle_id: string;
  user_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  care_circles?: Pick<CircleRow, 'name'> | Pick<CircleRow, 'name'>[];
};

type ActivityRow = {
  id: string;
  event_type: CareCircleActivityEvent;
  medicine_id: string | null;
  actor_user_id: string | null;
  subject_user_id: string | null;
  scheduled_time: string | null;
  action_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

function getClient() {
  if (!supabase) throw new Error(supabaseConfigurationError ?? 'Supabase is not configured.');
  return supabase;
}

function relatedRow<Row>(value: Row | Row[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function memberCounts(circleIds: string[]) {
  if (circleIds.length === 0) return new Map<string, number>();
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client.from('care_circle_members').select('circle_id').in('circle_id', circleIds),
  );
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { circle_id: string }[]) {
    counts.set(row.circle_id, (counts.get(row.circle_id) ?? 0) + 1);
  }
  return counts;
}

export async function fetchCareCircles(userId: string): Promise<CareCircleSummary[]> {
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_members')
      .select('circle_id, role, joined_at, care_circles!inner(id, name, invite_code, owner_id, created_at)')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false }),
  );
  if (error) throw error;

  const memberships = (data ?? []) as unknown as MembershipRow[];
  const counts = await memberCounts(memberships.map((membership) => membership.circle_id));
  return memberships.map((membership) => {
    const circle = relatedRow(membership.care_circles);
    return {
      id: circle.id,
      name: circle.name,
      inviteCode: circle.invite_code,
      ownerId: circle.owner_id,
      role: membership.role,
      memberCount: counts.get(circle.id) ?? 1,
      createdAt: circle.created_at,
    };
  });
}

export async function fetchMyCareCircleRequests(userId: string): Promise<MyCareCircleRequest[]> {
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_join_requests')
      .select('id, circle_id, user_id, status, created_at, care_circles!inner(name)')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  );
  if (error) throw error;

  return ((data ?? []) as unknown as JoinRequestRow[]).map((request) => ({
    id: request.id,
    circleId: request.circle_id,
    circleName: relatedRow(request.care_circles!).name,
    status: request.status,
    createdAt: request.created_at,
  }));
}

export type IncomingJoinRequest = {
  id: string;
  circleId: string;
  circleName: string;
  requesterName: string;
  createdAt: string;
};

/**
 * Pending join requests for the Care Circles this user owns or administers,
 * used by the in-app notification feed. Returns [] when the user manages no
 * circles. RLS still filters row-by-row, so this only ever returns requests the
 * user is allowed to review.
 */
export async function fetchIncomingJoinRequests(userId: string): Promise<IncomingJoinRequest[]> {
  const client = getClient();
  const { data: managed, error: managedError } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_members')
      .select('circle_id, role')
      .eq('user_id', userId)
      .in('role', ['owner', 'admin']),
  );
  if (managedError) throw managedError;
  const circleIds = ((managed ?? []) as { circle_id: string }[]).map((row) => row.circle_id);
  if (circleIds.length === 0) return [];

  const { data, error } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_join_requests')
      .select('id, circle_id, user_id, status, created_at, care_circles!inner(name)')
      .in('circle_id', circleIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),
  );
  if (error) throw error;

  const rows = ((data ?? []) as unknown as JoinRequestRow[]).filter((row) => row.user_id !== userId);
  const names = await profileNames(rows.map((row) => row.user_id));
  return rows.map((row) => ({
    id: row.id,
    circleId: row.circle_id,
    circleName: relatedRow(row.care_circles!).name,
    requesterName: names.get(row.user_id) || 'Someone',
    createdAt: row.created_at,
  }));
}

export async function createCareCircle(userId: string, name: string): Promise<CareCircleSummary> {
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client
      .from('care_circles')
      .insert({ owner_id: userId, name: name.trim() })
      .select('id, name, invite_code, owner_id, created_at')
      .single(),
  );
  if (error) throw error;
  const circle = data as CircleRow;
  return {
    id: circle.id,
    name: circle.name,
    inviteCode: circle.invite_code,
    ownerId: circle.owner_id,
    role: 'owner',
    memberCount: 1,
    createdAt: circle.created_at,
  };
}

export async function joinCareCircle(code: string): Promise<JoinCareCircleResult> {
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client.rpc('request_to_join_care_circle', { requested_code: code.trim() }),
  );
  if (error) throw error;
  const result = (data as unknown as {
    circle_id: string;
    circle_name: string;
    request_status: JoinCareCircleResult['status'];
  }[])[0];
  if (!result) throw new Error('We could not process this invite code.');
  return { circleId: result.circle_id, circleName: result.circle_name, status: result.request_status };
}

async function profileNames(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const client = getClient();
  const { data, error } = await executeSupabaseRequest(() =>
    client.from('profiles').select('id, full_name').in('id', userIds),
  );
  if (error) throw error;
  return new Map(((data ?? []) as { id: string; full_name: string }[]).map((profile) => [profile.id, profile.full_name]));
}

export async function fetchCareCircleDetails(circleId: string, userId: string): Promise<CareCircleDetails> {
  const client = getClient();
  const { data: membershipData, error: membershipError } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_members')
      .select('circle_id, role, joined_at, care_circles!inner(id, name, invite_code, owner_id, created_at)')
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .single(),
  );
  if (membershipError) throw membershipError;
  const membership = membershipData as unknown as MembershipRow;
  const circle = relatedRow(membership.care_circles);

  const { data: memberData, error: memberError } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_members')
      .select('user_id, role, joined_at')
      .eq('circle_id', circleId)
      .order('joined_at', { ascending: true }),
  );
  if (memberError) throw memberError;
  const memberRows = (memberData ?? []) as { user_id: string; role: CareCircleRole; joined_at: string }[];

  const canManage = membership.role === 'owner' || membership.role === 'admin';
  let requestRows: JoinRequestRow[] = [];
  if (canManage) {
    const { data: requestData, error: requestError } = await executeSupabaseRequest(() =>
      client
        .from('care_circle_join_requests')
        .select('id, circle_id, user_id, status, created_at')
        .eq('circle_id', circleId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
    );
    if (requestError) throw requestError;
    requestRows = (requestData ?? []) as JoinRequestRow[];
  }

  const { data: activityData, error: activityError } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_activity')
      .select('id, event_type, medicine_id, actor_user_id, subject_user_id, scheduled_time, action_at, metadata, created_at')
      .eq('care_circle_id', circleId)
      .order('created_at', { ascending: false })
      .limit(50),
  );
  if (activityError) throw activityError;
  const activityRows = (activityData ?? []) as ActivityRow[];

  const names = await profileNames([
    ...memberRows.map((member) => member.user_id),
    ...requestRows.map((request) => request.user_id),
    ...activityRows.flatMap((activity) => [activity.actor_user_id, activity.subject_user_id]).filter((id): id is string => Boolean(id)),
  ]);
  const members: CareCircleMember[] = memberRows.map((member) => ({
    userId: member.user_id,
    fullName: names.get(member.user_id) || 'Member',
    role: member.role,
    joinedAt: member.joined_at,
  }));
  const pendingRequests: CareCircleJoinRequest[] = requestRows.map((request) => ({
    id: request.id,
    userId: request.user_id,
    fullName: names.get(request.user_id) || 'Member',
    status: request.status,
    createdAt: request.created_at,
  }));
  const activity: CareCircleActivity[] = activityRows.map((item) => ({
    id: item.id,
    eventType: item.event_type,
    medicineId: item.medicine_id,
    actorUserId: item.actor_user_id,
    actorName: item.actor_user_id ? names.get(item.actor_user_id) ?? null : null,
    subjectUserId: item.subject_user_id,
    subjectName: item.subject_user_id ? names.get(item.subject_user_id) ?? null : null,
    scheduledTime: item.scheduled_time,
    actionAt: item.action_at,
    metadata: item.metadata ?? {},
    createdAt: item.created_at,
  }));

  return {
    id: circle.id,
    name: circle.name,
    inviteCode: circle.invite_code,
    ownerId: circle.owner_id,
    role: membership.role,
    memberCount: members.length,
    createdAt: circle.created_at,
    members,
    pendingRequests,
    activity,
  };
}

export async function updateCareCircleName(circleId: string, name: string): Promise<void> {
  const client = getClient();
  const { error } = await executeSupabaseRequest(() =>
    client.from('care_circles').update({ name: name.trim() }).eq('id', circleId).select('id').single(),
  );
  if (error) throw error;
}

export async function deleteCareCircle(circleId: string, _userId: string) {
  const client = getClient();
  const { error } = await executeSupabaseRequest(() =>
    client.from('care_circles').delete().eq('id', circleId).select('id').single(),
  );
  if (error) throw error;
}

export async function leaveCareCircle(circleId: string, userId: string) {
  const client = getClient();
  const { error } = await executeSupabaseRequest(() =>
    client
      .from('care_circle_members')
      .delete()
      .eq('circle_id', circleId)
      .eq('user_id', userId)
      .neq('role', 'owner')
      .select('id')
      .single(),
  );
  if (error) throw error;
}

export async function reviewCareCircleRequest(requestId: string, decision: 'accepted' | 'rejected') {
  const client = getClient();
  const { error } = await executeSupabaseRequest(() =>
    client.rpc('review_care_circle_join_request', { request_id: requestId, decision }),
  );
  if (error) throw error;
}
