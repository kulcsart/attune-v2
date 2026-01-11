import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Használd a manuális módszert: YouTube → ⋮ → Átirat megnyitása → Másolás' 
  }, { status: 400 });
}
