import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // ── Verify token ──
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const adminAuth = getAuth(getAdminApp());
    let decoded: { uid: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Parse body ──
    const body = await request.json();
    const { userId, companyId, role } = body;

    if (!userId || !companyId || !role) {
      return NextResponse.json({ error: 'userId, companyId, and role are required' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const batch = adminDb.batch();

    // Create membership
    batch.set(
      adminDb.collection('companies').doc(companyId).collection('members').doc(userId),
      {
        id: userId,
        email: body.email ?? '',
        role: role,
        joinedAt: new Date().toISOString(),
      },
    );

    // Clear pendingAssignment flag
    batch.update(adminDb.collection('users').doc(userId), {
      pendingAssignment: false,
    });

    await batch.commit();

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('POST /api/companies/assign-user error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
