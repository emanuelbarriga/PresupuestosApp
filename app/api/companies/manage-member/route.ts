import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';

export async function PATCH(request: NextRequest) {
  try {
    // ── Verify token ──
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const adminAuth = getAuth(getAdminApp());
    try {
      await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Parse body ──
    const body = await request.json();
    const { action, companyId, userId, role, email } = body;

    if (!action || !companyId || !userId) {
      return NextResponse.json({ error: 'action, companyId, and userId are required' }, { status: 400 });
    }

    const adminDb = getAdminDb();

    switch (action) {
      case 'add': {
        if (!email || !role) {
          return NextResponse.json({ error: 'email and role required for add' }, { status: 400 });
        }
        const memberRef = adminDb.collection('companies').doc(companyId).collection('members').doc(userId);
        await memberRef.set({
          id: userId,
          email,
          role,
          joinedAt: new Date().toISOString(),
        });
        break;
      }

      case 'update-role': {
        if (!role) {
          return NextResponse.json({ error: 'role required' }, { status: 400 });
        }
        await adminDb.collection('companies').doc(companyId).collection('members').doc(userId).update({ role });
        break;
      }

      case 'block': {
        const { blocked } = body;
        if (typeof blocked !== 'boolean') {
          return NextResponse.json({ error: 'blocked (boolean) required' }, { status: 400 });
        }
        await adminDb.collection('companies').doc(companyId).collection('members').doc(userId).update({ blocked });
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('PATCH /api/companies/manage-member error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
