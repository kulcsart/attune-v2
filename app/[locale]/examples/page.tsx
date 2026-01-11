'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Example = {
  id: string;
  input_text: string;
  ideal_output: string;
  example_type: string;
  active: boolean;
  created_at: string;
};

export default function ExamplesPage() {
  const t = useTranslations();
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  function extractText(jsonOrString: string): string {
    if (!jsonOrString) return '';
    try {
      const parsed = JSON.parse(jsonOrString);
      return parsed.atom_content_hu || parsed.concept || jsonOrString;
    } catch {
      return jsonOrString;
    }
  }

  async function fetchExamples() {
    setLoading(true);
    let query = supabase.from('refinery_examples').select('*').order('created_at', { ascending: false });
    
    if (filter === 'active') query = query.eq('active', true);
    else if (filter === 'inactive') query = query.eq('active', false);
    
    const { data, error } = await query;
    if (!error && data) setExamples(data);
    setLoading(false);
  }

  useEffect(() => { fetchExamples(); }, [filter]);

  async function toggleActive(id: string, currentActive: boolean) {
    const { error } = await supabase
      .from('refinery_examples')
      .update({ active: !currentActive })
      .eq('id', id);
    
    if (!error) {
      setExamples(examples.map(ex => ex.id === id ? { ...ex, active: !currentActive } : ex));
    }
  }

  async function deleteExample(id: string) {
    if (!confirm('Biztosan törölni szeretnéd ezt a példát?')) return;
    
    const { error } = await supabase.from('refinery_examples').delete().eq('id', id);
    if (!error) {
      setExamples(examples.filter(ex => ex.id !== id));
    }
  }

  const activeCount = examples.filter(ex => ex.active).length;
  const totalCount = examples.length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/examples" locale="hu"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge></Link>
            <Link href="/examples" locale="en"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge></Link>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm text-muted-foreground">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm text-muted-foreground">{t('nav.curation')}</Link>
          <Link href="/examples" className="text-sm font-medium">💡 Few-Shot Példák</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold">💡 Few-Shot Learning Példák</h2>
            <p className="text-muted-foreground mt-2">
              Válaszd ki a legjobb javításokat, amiből az AI tanulhat. Max 10-15 aktív példa ajánlott.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{activeCount} / {totalCount}</div>
            <div className="text-sm text-muted-foreground">aktív példa</div>
            {activeCount > 15 && (
              <Badge variant="destructive" className="mt-2">⚠️ Túl sok aktív</Badge>
            )}
          </div>
        </div>

        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all">Összes ({totalCount})</TabsTrigger>
            <TabsTrigger value="active">Aktív ({activeCount})</TabsTrigger>
            <TabsTrigger value="inactive">Inaktív ({totalCount - activeCount})</TabsTrigger>
          </TabsList>

          {['all', 'active', 'inactive'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {loading ? (
                <p className="text-muted-foreground">Betöltés...</p>
              ) : examples.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nincs megjeleníthető példa.</CardContent></Card>
              ) : (
                <div className="space-y-4">
                  {examples.map((example) => (
                    <Card key={example.id} className={`overflow-hidden ${example.active ? 'ring-2 ring-green-500' : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant={example.active ? 'default' : 'secondary'}>
                                {example.active ? '✓ Aktív' : '○ Inaktív'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(example.created_at).toLocaleDateString('hu-HU', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </span>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">🤖 AI VERZIÓ</span>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/30 rounded p-3 text-sm whitespace-pre-wrap">
                                  {extractText(example.input_text) || <span className="text-muted-foreground italic">Nincs szöveg</span>}
                                </div>
                              </div>
                              
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-muted-foreground">👤 EMBERI JAVÍTÁS</span>
                                </div>
                                <div className="bg-green-500/10 border border-green-500/30 rounded p-3 text-sm whitespace-pre-wrap">
                                  {extractText(example.ideal_output) || <span className="text-muted-foreground italic">Nincs szöveg</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant={example.active ? 'default' : 'outline'}
                              onClick={() => toggleActive(example.id, example.active)}
                            >
                              {example.active ? '✓' : '○'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteExample(example.id)}
                              className="text-red-500 hover:text-red-600"
                            >
                              🗑
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </main>
    </div>
  );
}
