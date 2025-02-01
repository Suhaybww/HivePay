import { NextResponse } from 'next/server';
import { sendContactFormEmails } from '@/src/lib/emailService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    await sendContactFormEmails(body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact form submission failed:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}