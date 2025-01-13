/**
 * app/api/contact/route.ts
 * 
 * Standard Next.js 13 route using your updated sendContactFormEmails()
 */

import { NextResponse } from "next/server";
import { sendContactFormEmails } from "@/src/lib/contact-email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // body should be { name, email, message } as per your interface
    await sendContactFormEmails(body);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact form submission failed:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
