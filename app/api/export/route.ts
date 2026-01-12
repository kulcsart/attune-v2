import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  const worldview = searchParams.get('worldview');
  const author = searchParams.get('author');

  let query = supabase
    .from('content_staging')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (worldview) query = query.eq('worldview_id', worldview);
  if (author) query = query.eq('author_id', author);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (format === 'csv') {
    const csv = convertToCSV(data || []);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=atoms_export.csv',
      },
    });
  }

  return NextResponse.json({ success: true, atoms: data, count: data?.length || 0 });
}

function convertToCSV(data: any[]): string {
  if (!data.length) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row =>
    Object.values(row).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
  );
  return [headers, ...rows].join('\n');
}
