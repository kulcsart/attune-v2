'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Atom = {
  id: string;
  original_raw_chunk: string;
  ai_polished_content: string | null;
  status: string;
  source_title: string | null;
  author: string | null;
  created_at: string;
};

export default function CurationPage() {
  const t = useTranslations();
  const [atoms, setAtoms] = useState<Atom[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('pending_review');

  async function fetchAtoms() {
    setLoading(true);
    let query = supabase
      .from('content_staging')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (filter !== 'all') {
      query = query.eq('status', filter);
    }

    const { data, error } = await query;
    
    if (!error && data) {
      setAtoms(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAtoms();
  }, [filter]);

  async function updateStatus(id: string, newStatus: 'approved' | 'rejected') {
    const { error } = await supabase
      .from('content_staging')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      setAtoms(atoms.map(a => a.id === id ? { ...a, status: newStatus } : a));
    }
  }

  function truncate(text: string | null, length: number = 200) {
    if (!text) return '—';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/curation" locale="hu">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge>
            </Link>
            <Link href="/curation" locale="en">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge>
            </Link>
          </div>
        </div>
      </header>
      
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm text-muted-foreground">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm font-medium">{t('nav.curation')}</Link>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">Atomok kurálása</h2>
          <div className="flex gap-2">
            <Badge 
              variant={filter === 'all' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setFilter('all')}
            >
              Mind
            </Badge>
            <Badge 
              variant={filter === 'pending_review' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setFilter('pending_review')}
            >
              Függőben
            </Badge>
            <Badge 
              variant={filter === 'approved' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setFilter('approved')}
            >
              Jóváhagyott
            </Badge>
            <Badge 
              variant={filter === 'rejected' ? 'default' : 'outline'} 
              className="cursor-pointer"
              onClick={() => setFilter('rejected')}
            >
              Elutasított
            </Badge>
          </div>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Betöltés...</p>
        ) : atoms.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nincs megjeleníthető atom ezzel a szűrővel.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {atoms.map((atom) => (
              <Card key={atom.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          atom.status === 'approved' ? 'default' :
                          atom.status === 'rejected' ? 'destructive' : 'secondary'
                        }>
                          {atom.status === 'approved' ? 'Jóváhagyott' :
                           atom.status === 'rejected' ? 'Elutasított' : 'Függőben'}
                        </Badge>
                        {atom.source_title && (
                          <span className="text-sm text-muted-foreground">{atom.source_title}</span>
                        )}
                        {atom.author && (
                          <span className="text-sm text-muted-foreground">— {atom.author}</span>
                        )}
                      </div>
                      
                      <p className="text-sm mb-2">
                        {truncate(atom.ai_polished_content || atom.original_raw_chunk)}
                      </p>
                      
                      <p className="text-xs text-muted-foreground">
                        {new Date(atom.created_at).toLocaleDateString('hu-HU')}
                      </p>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      {atom.status === 'pending_review' && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateStatus(atom.id, 'approved')}
                          >
                            ✓ Jóváhagy
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateStatus(atom.id, 'rejected')}
                          >
                            ✗ Elutasít
                          </Button>
                        </>
                      )}
                      {atom.status !== 'pending_review' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => updateStatus(atom.id, atom.status === 'approved' ? 'rejected' : 'approved')}
                        >
                          Visszavon
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
