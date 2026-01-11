'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { WorldviewWithTranslation } from '@/lib/types';

function cleanTranscript(text: string): string {
  // Bontás sorokra és deduplikáció
  const lines = text.split('\n');
  const uniqueLines: string[] = [];
  let prevLine = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Szűrés: timecode, csak számok, tagek, üres sorok, duplikációk
    if (!trimmed) continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (/\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/.test(trimmed)) continue;
    if (/^\[.*?\]$/.test(trimmed)) continue;
    if (trimmed === prevLine) continue; // Egymást követő duplikációk kiszűrése
    
    uniqueLines.push(trimmed);
    prevLine = trimmed;
  }
  
  return uniqueLines.join(' ').replace(/\s+/g, ' ').trim();
}

export default function IntakePage() {
  const t = useTranslations();
  const locale = useLocale();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [worldviewId, setWorldviewId] = useState<string>('');
  const [worldviews, setWorldviews] = useState<WorldviewWithTranslation[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAtoms, setAiAtoms] = useState<Array<{en: string, hu: string}>>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    async function fetchWorldviews() {
      const { data } = await supabase
        .from('worldviews')
        .select(`
          *,
          worldview_translations!inner(name, description)
        `)
        .eq('worldview_translations.language_code', locale || 'hu')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (data) {
        const transformed = data.map((item: any) => ({
          ...item,
          name: item.worldview_translations[0]?.name || item.id,
          description: item.worldview_translations[0]?.description || null
        }));
        setWorldviews(transformed);
      }
    }
    fetchWorldviews();
  }, [locale]);

  async function handleAiAtomize() {
    if (!text.trim()) return;
    setLoading(true);
    setMessage(null);
    
    try {
      const response = await fetch('/api/atomize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text,
          worldview_id: worldviewId || null
        })
      });
      
      if (!response.ok) throw new Error('AI atomizálás sikertelen');
      
      const data = await response.json();
      setAiAtoms(data.atoms);
      
      const batchInfo = data.batches ? ` (${data.batches} batch)` : '';
      const worldviewInfo = worldviewId ? ` [${worldviews.find(w => w.id === worldviewId)?.name}]` : '';
      setMessage({ type: 'success', text: `${data.count} atom elkészült AI által${batchInfo}${worldviewInfo}!` });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAtoms() {
    if (aiAtoms.length === 0) return;
    setLoading(true);
    setMessage(null);
    
    const now = new Date().toISOString();
    
    try {
      const records = aiAtoms.map(atom => ({
        original_raw_chunk: atom.en,
        ai_polished_content: atom.hu,
        source_file: title || 'Untitled',
        author: author || 'Unknown',
        status: 'pending_review',
        created_at: now,
        updated_at: now
      }));
      
      const { error } = await supabase.from('content_staging').insert(records);
      if (error) throw error;
      
      setMessage({ type: 'success', text: `${aiAtoms.length} atom sikeresen mentve!` });
      setText(''); setTitle(''); setAuthor(''); setAiAtoms([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleClean() {
    setText(cleanTranscript(text));
    setMessage({ type: 'info', text: 'Timecode-ok és duplikációk eltávolítva!' });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/intake" locale="hu"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge></Link>
            <Link href="/intake" locale="en"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge></Link>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm font-medium">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm text-muted-foreground">{t('nav.curation')}</Link>
          <Link href="/examples" className="text-sm text-muted-foreground">💡 Példák</Link>
          <Link href="/worldviews" className="text-sm text-muted-foreground">🌍 Világnézetek</Link>
          <Link href="/authors" className="text-sm text-muted-foreground">👤 Szerzők</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Tartalom bevitel</h2>
        {message && (
          <div className={`p-4 rounded mb-6 ${message.type === 'success' ? 'bg-green-500/10 border border-green-500 text-green-500' : message.type === 'info' ? 'bg-blue-500/10 border border-blue-500 text-blue-500' : 'bg-red-500/10 border border-red-500 text-red-500'}`}>{message.text}</div>
        )}
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="text">Szöveg</TabsTrigger>
            <TabsTrigger value="youtube">YouTube útmutató</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <Card>
              <CardHeader><CardTitle>Szöveg beillesztése</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div><label className="text-sm text-muted-foreground mb-2 block">Forrás címe</label><Input placeholder="pl. The Power of Now" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><label className="text-sm text-muted-foreground mb-2 block">Szerző</label><Input placeholder="pl. Eckhart Tolle" value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Világnézet (opcionális)</label>
                    <Select value={worldviewId || 'none'} onValueChange={(val) => setWorldviewId(val === 'none' ? '' : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Válassz..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nincs (általános)</SelectItem>
                        {worldviews.map((wv) => (
                          <SelectItem key={wv.id} value={wv.id}>
                            {wv.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><label className="text-sm text-muted-foreground mb-2 block">Tartalom</label><Textarea placeholder="Illeszd be a szöveget ide..." className="min-h-[200px] max-h-[300px] overflow-y-auto" value={text} onChange={(e) => setText(e.target.value)} /></div>
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{text.length} karakter</span>
                    {text.includes('-->') && <Button variant="outline" size="sm" onClick={handleClean}>🧹 Timecode tisztítás</Button>}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAiAtomize} disabled={loading || !text.trim()} variant="default">{loading ? 'AI dolgozik...' : '🤖 AI Atomizálás'}</Button>
                    {aiAtoms.length > 0 && <Button onClick={handleSaveAtoms} disabled={loading} variant="secondary">💾 Mentés ({aiAtoms.length})</Button>}
                  </div>
                </div>
                {aiAtoms.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-2">AI Atomok előnézete (első 5):</p>
                    <div className="space-y-3">
                      {aiAtoms.slice(0, 5).map((atom, i) => (
                        <div key={i} className="bg-muted/50 p-3 rounded border-l-2 border-green-500">
                          <div className="text-xs text-muted-foreground mb-1">#{i + 1} EN</div>
                          <div className="text-sm text-muted-foreground mb-2">{atom.en}</div>
                          <div className="text-xs text-muted-foreground mb-1">HU</div>
                          <div className="text-sm">{atom.hu}</div>
                        </div>
                      ))}
                      {aiAtoms.length > 5 && <p className="text-sm text-muted-foreground">...és még {aiAtoms.length - 5} atom</p>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="youtube">
            <Card>
              <CardHeader><CardTitle>YouTube felirat másolása</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-blue-500/10 border border-blue-500 text-blue-400 p-4 rounded text-sm">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>Nyisd meg a YouTube videót</li>
                    <li>Kattints a <strong>⋮</strong> (három pont) gombra a videó alatt</li>
                    <li>Válaszd az <strong>Átirat megnyitása</strong> opciót</li>
                    <li>Jelöld ki az összes szöveget (Ctrl+A) és másold (Ctrl+C)</li>
                    <li>Menj a <strong>Szöveg</strong> fülre és illeszd be</li>
                    <li>Kattints a <strong>🧹 Timecode tisztítás</strong> gombra</li>
                    <li>Kattints a <strong>🤖 AI Atomizálás</strong> gombra</li>
                    <li>Ellenőrizd az előnézetet, majd kattints a <strong>💾 Mentés</strong> gombra</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
