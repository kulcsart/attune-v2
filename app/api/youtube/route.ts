import { NextRequest, NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  // YouTube video ID kinyerése
  const videoId = extractVideoId(url);
  if (!videoId) {
    return NextResponse.json({ error: 'Érvénytelen YouTube URL' }, { status: 400 });
  }

  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    const text = transcript.map(item => item.text).join(' ');

    return NextResponse.json({
      success: true,
      transcript: text,
      segments: transcript.length
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Nem sikerült letölteni a feliratot. Lehet, hogy nincs elérhető felirat.'
    }, { status: 400 });
  }
}

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
