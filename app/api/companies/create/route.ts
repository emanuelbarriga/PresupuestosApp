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
    let companyName: string;
    try {
      const body = await request.json();
      companyName = body.companyName;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0) {
      return NextResponse.json({ error: 'companyName is required' }, { status: 400 });
    }

    // ── Generate companyId ──
    const companyId = companyName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, ''); // safe slug

    if (!companyId || companyId.length === 0) {
      return NextResponse.json({ error: 'Invalid company name — could not generate a valid ID' }, { status: 400 });
    }

    // Reserved company IDs
    if (companyId === 'all') {
      return NextResponse.json({ error: 'Company ID "all" is reserved' }, { status: 400 });
    }

    // ── Check for existing company ──
    const adminDb = getAdminDb();
    const existingDoc = await adminDb.collection('companies').doc(companyId).get();
    if (existingDoc.exists) {
      return NextResponse.json({ error: 'A company with this name already exists' }, { status: 409 });
    }

    // ── WriteBatch: company doc + admin user doc ──
    const batch = adminDb.batch();

    batch.set(adminDb.collection('companies').doc(companyId), {
      name: companyName.trim(),
      createdBy: decoded.uid,
      createdAt: new Date().toISOString(),
    });

    batch.set(
      adminDb.collection('companies').doc(companyId).collection('users').doc(decoded.uid),
      {
        id: decoded.uid,
        email: decoded.email ?? '',
        role: 'admin',
        joinedAt: new Date().toISOString(),
      },
    );

    await batch.commit();

    return NextResponse.json(
      { companyId, name: companyName.trim(), success: true },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/companies/create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
