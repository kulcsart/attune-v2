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
import { WorldviewWithTranslation, AuthorWithTranslation } from '@/lib/types';

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
  const [authorId, setAuthorId] = useState<string>('');
  const [worldviews, setWorldviews] = useState<WorldviewWithTranslation[]>([]);
  const [authors, setAuthors] = useState<AuthorWithTranslation[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiAtoms, setAiAtoms] = useState<Array<{en: string, hu: string}>>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    async function fetchWorldviews() {
      const { data: allWorldviews } = await supabase
        .from('worldviews')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (allWorldviews) {
        const worldviewsWithTranslations = await Promise.all(
          allWorldviews.map(async (wv) => {
            const { data: translation } = await supabase
              .from('worldview_translations')
              .select('name, description')
              .eq('worldview_id', wv.id)
              .eq('language_code', locale || 'hu')
              .single();

            return {
              ...wv,
              name: translation?.name || wv.id,
              description: translation?.description || null
            };
          })
        );
        setWorldviews(worldviewsWithTranslations);
      }
    }
    
    async function fetchAuthors() {
      const { data: allAuthors } = await supabase
        .from('authors')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (allAuthors) {
        const authorsWithTranslations = await Promise.all(
          allAuthors.map(async (author) => {
            const { data: translation } = await supabase
              .from('author_translations')
              .select('display_name')
              .eq('author_id', author.id)
              .eq('language_code', locale || 'hu')
              .single();

            return {
              ...author,
              name: translation?.display_name || 'Unknown'
            };
          })
        );
        setAuthors(authorsWithTranslations);
      }
    }
    
    fetchWorldviews();
    fetchAuthors();
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
          worldview_id: worldviewId || null,
          author_id: authorId || null
        })
      });
      
      if (!response.ok) throw new Error(t('intake.atomizationFailed'));
      
      const data = await response.json();
      setAiAtoms(data.atoms);
      
      const batchInfo = data.batches ? ` (${data.batches} batch)` : '';
      const worldviewInfo = worldviewId ? ` [${worldviews.find(w => w.id === worldviewId)?.name}]` : '';
      const authorInfo = authorId ? ` - ${authors.find(a => a.id === authorId)?.name}` : '';
      setMessage({ type: 'success', text: `${data.count} ${t('intake.atomsCreated')}${batchInfo}${worldviewInfo}${authorInfo}!` });
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
        worldview_id: worldviewId || null,
        author_id: authorId || null,
        status: 'pending_review',
        created_at: now,
        updated_at: now
      }));
      
      const { error } = await supabase.from('content_staging').insert(records);
      if (error) throw error;
      
      setMessage({ type: 'success', text: `${aiAtoms.length} ${t('intake.atomsSaved')}` });
      setText(''); setTitle(''); setAuthor(''); setWorldviewId(''); setAuthorId(''); setAiAtoms([]);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleClean() {
    setText(cleanTranscript(text));
    setMessage({ type: 'info', text: t('intake.timecodesRemoved') });
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
          <Link href="/examples" className="text-sm text-muted-foreground">{t('nav.examples')}</Link>
          <Link href="/worldviews" className="text-sm text-muted-foreground">{t('nav.worldviews')}</Link>
          <Link href="/authors" className="text-sm text-muted-foreground">{t('nav.authors')}</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('intake.title')}</h2>
        {message && (
          <div className={`p-4 rounded mb-6 ${message.type === 'success' ? 'bg-green-500/10 border border-green-500 text-green-500' : message.type === 'info' ? 'bg-blue-500/10 border border-blue-500 text-blue-500' : 'bg-red-500/10 border border-red-500 text-red-500'}`}>{message.text}</div>
        )}
        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="text">{t('intake.textTab')}</TabsTrigger>
            <TabsTrigger value="youtube">{t('intake.youtubeTab')}</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <Card>
              <CardHeader><CardTitle>{t('intake.pasteText')}</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div><label className="text-sm text-muted-foreground mb-2 block">{t('intake.sourceTitle')}</label><Input placeholder={t('intake.sourceTitlePlaceholder')} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
                  <div><label className="text-sm text-muted-foreground mb-2 block">{t('intake.author')}</label><Input placeholder={t('intake.authorPlaceholder')} value={author} onChange={(e) => setAuthor(e.target.value)} /></div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{t('intake.worldview')}</label>
                    <Select value={worldviewId || 'none'} onValueChange={(val) => setWorldviewId(val === 'none' ? '' : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('intake.selectWorldview')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('intake.noneGeneral')}</SelectItem>
                        {worldviews.map((wv) => (
                          <SelectItem key={wv.id} value={wv.id}>
                            {wv.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">{t('intake.authorSelect')}</label>
                    <Select value={authorId || 'none'} onValueChange={(val) => setAuthorId(val === 'none' ? '' : val)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('intake.selectAuthor')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('common.none')}</SelectItem>
                        {authors.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><label className="text-sm text-muted-foreground mb-2 block">{t('intake.content')}</label><Textarea placeholder={t('intake.pasteTextHere')} className="min-h-[200px] max-h-[300px] overflow-y-auto" value={text} onChange={(e) => setText(e.target.value)} /></div>
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{text.length} {t('intake.characters')}</span>
                    {text.includes('-->') && <Button variant="outline" size="sm" onClick={handleClean}>🧹 {t('intake.cleanTimecodes')}</Button>}
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAiAtomize} disabled={loading || !text.trim()} variant="default">{loading ? t('common.loading') : t('intake.atomize')}</Button>
                    {aiAtoms.length > 0 && <Button onClick={handleSaveAtoms} disabled={loading} variant="secondary">{t('intake.saveToStaging')} ({aiAtoms.length})</Button>}
                  </div>
                </div>
                {aiAtoms.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm text-muted-foreground mb-2">{t('intake.previewFirst5')}:</p>
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
              <CardHeader><CardTitle>{t('intake.youtubeGuide')}</CardTitle></CardHeader>
              <CardContent>
                <div className="bg-blue-500/10 border border-blue-500 text-blue-400 p-4 rounded text-sm">
                  <ol className="list-decimal list-inside space-y-2">
                    <li>{t('intake.youtubeStep1')}</li>
                    <li>{t('intake.youtubeStep2')}</li>
                    <li>{t('intake.youtubeStep3')}</li>
                    <li>{t('intake.youtubeStep4')}</li>
                    <li>{t('intake.youtubeStep5')}</li>
                    <li>{t('intake.youtubeStep6')}</li>
                    <li>{t('intake.youtubeStep7')}</li>
                    <li>{t('intake.youtubeStep8')}</li>
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
