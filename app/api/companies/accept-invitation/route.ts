import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminApp, getAdminDb } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    // ── Verify token ──
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const adminAuth = getAuth(getAdminApp());
    let decoded: { uid: string; email?: string };
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ── Parse body ──
    let invitationId: string;
    try {
      const body = await request.json();
      invitationId = body.invitationId;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!invitationId || typeof invitationId !== 'string') {
      return NextResponse.json({ error: 'invitationId is required' }, { status: 400 });
    }

    // ── Fetch invitation ──
    const adminDb = getAdminDb();
    const invitationRef = adminDb.collection('invitations').doc(invitationId);
    const invitationSnap = await invitationRef.get();

    if (!invitationSnap.exists) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    const invitation = invitationSnap.data()!;

    // ── Validate invitation ──
    if (invitation.status !== 'pendiente') {
      return NextResponse.json({ error: 'Invitation is already accepted' }, { status: 409 });
    }

    const userEmail = decoded.email ?? '';
    if (invitation.email !== userEmail) {
      return NextResponse.json({ error: 'Email mismatch — this invitation was sent to a different email' }, { status: 403 });
    }

    // ── WriteBatch: global user profile + membership + update invitation ──
    const batch = adminDb.batch();

    // Global user profile (identity agnostic to companies)
    batch.set(
      adminDb.collection('users').doc(decoded.uid),
      {
        id: decoded.uid,
        email: userEmail,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );

    // Membership within this company
    batch.set(
      adminDb.collection('companies').doc(invitation.companyId).collection('members').doc(decoded.uid),
      {
        id: decoded.uid,
        email: userEmail,
        role: invitation.role ?? 'colaborador',
        joinedAt: new Date().toISOString(),
      },
    );

    batch.update(invitationRef, {
      status: 'aceptada',
      acceptedAt: new Date().toISOString(),
      acceptedBy: decoded.uid,
    });

    await batch.commit();

    return NextResponse.json(
      {
        companyId: invitation.companyId,
        companyName: invitation.companyName ?? '',
        success: true,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('POST /api/companies/accept-invitation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
