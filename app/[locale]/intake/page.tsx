'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function IntakePage() {
  const t = useTranslations();
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleTextSubmit() {
    if (!text.trim()) return;
    
    setLoading(true);
    setMessage(null);
    
    try {
      const { error } = await supabase
        .from('content_staging')
        .insert({
          original_raw_chunk: text,
          source_title: title || 'Untitled',
          author: author || 'Unknown',
          status: 'pending_review',
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Tartalom sikeresen hozzáadva!' });
      setText('');
      setTitle('');
      setAuthor('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleYoutubeSubmit() {
    if (!youtubeUrl.trim()) return;
    
    setLoading(true);
    setMessage(null);
    
    // TODO: Implement YouTube transcript fetching
    setMessage({ type: 'error', text: 'YouTube integráció hamarosan...' });
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/intake" locale="hu">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge>
            </Link>
            <Link href="/intake" locale="en">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge>
            </Link>
          </div>
        </div>
      </header>
      
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm font-medium">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm text-muted-foreground">{t('nav.curation')}</Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">Tartalom bevitel</h2>

        {message && (
          <div className={`p-4 rounded mb-6 ${
            message.type === 'success' 
              ? 'bg-green-500/10 border border-green-500 text-green-500' 
              : 'bg-red-500/10 border border-red-500 text-red-500'
          }`}>
            {message.text}
          </div>
        )}

        <Tabs defaultValue="text" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="text">Szöveg</TabsTrigger>
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
            <TabsTrigger value="file" disabled>Fájl (hamarosan)</TabsTrigger>
          </TabsList>

          <TabsContent value="text">
            <Card>
              <CardHeader>
                <CardTitle>Szöveg beillesztése</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Forrás címe</label>
                    <Input 
                      placeholder="pl. The Power of Now" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Szerző</label>
                    <Input 
                      placeholder="pl. Eckhart Tolle" 
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Tartalom</label>
                  <Textarea 
                    placeholder="Illeszd be a szöveget ide..."
                    className="min-h-[300px]"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                  />
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    {text.length} karakter
                  </span>
                  <Button onClick={handleTextSubmit} disabled={loading || !text.trim()}>
                    {loading ? 'Feldolgozás...' : 'Feldolgozás'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="youtube">
            <Card>
              <CardHeader>
                <CardTitle>YouTube felirat letöltése</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">YouTube URL</label>
                  <Input 
                    placeholder="https://www.youtube.com/watch?v=..." 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                </div>
                
                <Button onClick={handleYoutubeSubmit} disabled={loading || !youtubeUrl.trim()}>
                  {loading ? 'Letöltés...' : 'Felirat letöltése'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="file">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Fájl feltöltés hamarosan...
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
