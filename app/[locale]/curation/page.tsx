'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Atom = {
  id: string;
  original_raw_chunk: string;
  ai_polished_content: string | null;
  status: string;
  source_file: string | null;
  author: string | null;
  created_at: string;
};

export default function CurationPage() {
  const t = useTranslations();
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('pending_review');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState<string>('');
  const [saveAsExample, setSaveAsExample] = useState<boolean>(false);

  async function fetchAtoms(status: string) {
    setLoading(true);
    setSelected(new Set());
    let query = supabase.from('content_staging').select('*').order('created_at', { ascending: false }).limit(100);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (!error && data) setAtoms(data);
    setLoading(false);
  }

  useEffect(() => { fetchAtoms(filter); }, [filter]);

  async function updateStatus(ids: string[], newStatus: 'approved' | 'rejected' | 'pending_review') {
    const now = new Date().toISOString();
    const { error } = await supabase.from('content_staging').update({ status: newStatus, updated_at: now }).in('id', ids);
    if (!error) {
      setAtoms(atoms.map(a => ids.includes(a.id) ? { ...a, status: newStatus } : a));
      setSelected(new Set());
    }
  }

  async function deleteAtoms(ids: string[]) {
    const { error } = await supabase.from('content_staging').delete().in('id', ids);
    if (!error) {
      setAtoms(atoms.filter(a => !ids.includes(a.id)));
      setSelected(new Set());
    }
  }

  function startEdit(atom: Atom) {
    setEditingId(atom.id);
    setEditText(atom.ai_polished_content || atom.original_raw_chunk);
    setSaveAsExample(false);
  }

  async function handleSaveEdit() {
    if (!editingId || !editText.trim()) return;
    const now = new Date().toISOString();
    
    const atom = atoms.find(a => a.id === editingId);
    const originalText = atom?.ai_polished_content || atom?.original_raw_chunk || '';
    const hasChanged = editText.trim() !== originalText.trim();
    
    const { error } = await supabase
      .from('content_staging')
      .update({ ai_polished_content: editText.trim(), updated_at: now })
      .eq('id', editingId);
    
    if (!error) {
      setAtoms(atoms.map(a => a.id === editingId ? { ...a, ai_polished_content: editText.trim(), updated_at: now } : a));
      
      // Ha változott és mentés példaként is - csak ha MINDKETTŐ nem üres
      if (hasChanged && saveAsExample && originalText.trim() && editText.trim()) {
        await supabase.from('refinery_examples').insert({
          input_text: originalText.trim(),
          ideal_output: editText.trim(),
          example_type: 'decomposition',
          active: false
        });
      }
      
      setEditingId(null);
      setEditText('');
      setSaveAsExample(false);
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText('');
    setSaveAsExample(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  }

  function toggleSelect(id: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelected(newSelected);
  }

  function selectAll() {
    if (selected.size === atoms.length) setSelected(new Set());
    else setSelected(new Set(atoms.map(a => a.id)));
  }

  function truncate(text: string | null, length: number = 300) {
    if (!text) return '—';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  const filteredAtoms = atoms;
  const selectedArray = Array.from(selected);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/curation" locale="hu"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge></Link>
            <Link href="/curation" locale="en"><Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge></Link>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm text-muted-foreground">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm font-medium">{t('nav.curation')}</Link>
          <Link href="/examples" className="text-sm text-muted-foreground">💡 Példák</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">🌱 Gardening</h2>
        
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <TabsList>
              <TabsTrigger value="all">Mind</TabsTrigger>
              <TabsTrigger value="pending_review">Függőben</TabsTrigger>
              <TabsTrigger value="approved">Jóváhagyott</TabsTrigger>
              <TabsTrigger value="rejected">Elutasított</TabsTrigger>
            </TabsList>
            
            {atoms.length > 0 && (
              <div className="flex gap-2 items-center">
                <Button variant="outline" size="sm" onClick={selectAll}>
                  {selected.size === atoms.length ? '☐ Kijelölés törlése' : '☑ Mindent kijelöl'}
                </Button>
                {selected.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selected.size} kijelölve</span>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedArray, 'approved')}>✓ Jóváhagy</Button>
                    <Button variant="outline" size="sm" onClick={() => updateStatus(selectedArray, 'rejected')}>✗ Elutasít</Button>
                    <Button variant="destructive" size="sm" onClick={() => deleteAtoms(selectedArray)}>🗑 Törlés</Button>
                  </>
                )}
              </div>
            )}
          </div>

          {['all', 'pending_review', 'approved', 'rejected'].map(tab => (
            <TabsContent key={tab} value={tab}>
              {loading ? (
                <p className="text-muted-foreground">Betöltés...</p>
              ) : filteredAtoms.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground">Nincs megjeleníthető tartalom.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {filteredAtoms.map((atom) => (
                    <Card key={atom.id} className={`overflow-hidden transition-colors ${selected.has(atom.id) ? 'ring-2 ring-blue-500' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox" 
                            checked={selected.has(atom.id)} 
                            onChange={() => toggleSelect(atom.id)}
                            className="mt-1 h-4 w-4 cursor-pointer"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant={atom.status === 'approved' ? 'default' : atom.status === 'rejected' ? 'destructive' : 'secondary'} className="text-xs">
                                {atom.status === 'approved' ? '✓' : atom.status === 'rejected' ? '✗' : '⏳'}
                              </Badge>
                              {atom.source_file && atom.source_file !== 'Untitled' && <span className="text-xs text-muted-foreground">{atom.source_file}</span>}
                              {atom.author && atom.author !== 'Unknown' && <span className="text-xs text-muted-foreground">— {atom.author}</span>}
                              <span className="text-xs text-muted-foreground ml-auto">{new Date(atom.created_at).toLocaleDateString('hu-HU')}</span>
                            </div>
                            {editingId === atom.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  onKeyDown={handleKeyDown}
                                  autoFocus
                                  className="w-full min-h-[100px] p-2 text-sm border border-border rounded bg-background resize-y"
                                  placeholder="Szerkeszd a magyar szöveget..."
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    id="saveAsExample"
                                    checked={saveAsExample}
                                    onChange={(e) => setSaveAsExample(e.target.checked)}
                                    className="h-4 w-4 cursor-pointer"
                                  />
                                  <label htmlFor="saveAsExample" className="text-sm text-muted-foreground cursor-pointer">
                                    💡 Mentés tanulópéldaként (few-shot learning)
                                  </label>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" variant="default" onClick={handleSaveEdit}>💾 Mentés</Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>❌ Mégse</Button>
                                  <span className="text-xs text-muted-foreground self-center ml-2">Ctrl+Enter = mentés, Esc = mégse</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p 
                                  className="text-sm cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors"
                                  onDoubleClick={() => startEdit(atom)}
                                  title="Dupla kattintás a szerkesztéshez"
                                >{truncate(atom.ai_polished_content || atom.original_raw_chunk)}</p>
                                {atom.ai_polished_content && atom.original_raw_chunk && atom.ai_polished_content !== atom.original_raw_chunk && (
                                  <p className="text-xs text-muted-foreground mt-2 italic">EN: {truncate(atom.original_raw_chunk, 200)}</p>
                                )}
                              </>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {editingId !== atom.id && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => startEdit(atom)} title="Szerkesztés">✏️</Button>
                                {atom.status === 'pending_review' && (
                                  <>
                                    <Button size="sm" variant="ghost" onClick={() => updateStatus([atom.id], 'approved')}>✓</Button>
                                    <Button size="sm" variant="ghost" onClick={() => updateStatus([atom.id], 'rejected')}>✗</Button>
                                  </>
                                )}
                                {atom.status !== 'pending_review' && (
                                  <Button size="sm" variant="ghost" onClick={() => updateStatus([atom.id], 'pending_review')}>↩</Button>
                                )}
                              </>
                            )}
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
