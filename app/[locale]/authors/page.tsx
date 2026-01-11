'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AuthorWithTranslation, WorldviewWithTranslation, WorldviewId } from '@/lib/types';

export default function AuthorsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [authors, setAuthors] = useState<AuthorWithTranslation[]>([]);
  const [worldviews, setWorldviews] = useState<WorldviewWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAuthor, setEditingAuthor] = useState<AuthorWithTranslation | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    display_name_hu: '',
    display_name_en: '',
    description_hu: '',
    description_en: '',
    primary_worldview_id: '',
    secondary_worldviews: [] as WorldviewId[],
    signature_concepts: '',
    debranding_map: '',
    is_active: true
  });

  async function fetchAuthors() {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('authors')
      .select(`
        *,
        author_translations!inner(display_name, description)
      `)
      .eq('author_translations.language_code', locale || 'hu')
      .order('created_at', { ascending: false });

    if (!error && data) {
      const transformed = data.map((item: any) => ({
        ...item,
        display_name: item.author_translations[0]?.display_name || 'Unknown',
        description: item.author_translations[0]?.description || null,
        author_translations: undefined
      }));
      setAuthors(transformed);
    } else if (error) {
      console.error('Error fetching authors:', error);
    }
    
    setLoading(false);
  }

  async function fetchWorldviews() {
    const { data } = await supabase
      .from('worldviews')
      .select(`
        *,
        worldview_translations!inner(name)
      `)
      .eq('worldview_translations.language_code', locale || 'hu')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (data) {
      const transformed = data.map((item: any) => ({
        ...item,
        name: item.worldview_translations[0]?.name || item.id
      }));
      setWorldviews(transformed);
    }
  }

  useEffect(() => {
    fetchAuthors();
    fetchWorldviews();
  }, [locale]);

  async function toggleActive(id: string, currentActive: boolean) {
    const { error } = await supabase
      .from('authors')
      .update({ is_active: !currentActive })
      .eq('id', id);
    
    if (!error) {
      setAuthors(authors.map(a => 
        a.id === id ? { ...a, is_active: !currentActive } : a
      ));
    }
  }

  function openCreateDialog() {
    setEditingAuthor(null);
    setFormData({
      display_name_hu: '',
      display_name_en: '',
      description_hu: '',
      description_en: '',
      primary_worldview_id: '',
      secondary_worldviews: [],
      signature_concepts: '',
      debranding_map: '',
      is_active: true
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(author: AuthorWithTranslation) {
    setEditingAuthor(author);
    setFormData({
      display_name_hu: author.display_name || '',
      display_name_en: '',
      description_hu: author.description || '',
      description_en: '',
      primary_worldview_id: author.primary_worldview_id || '',
      secondary_worldviews: Array.isArray(author.secondary_worldviews) ? author.secondary_worldviews : [],
      signature_concepts: Array.isArray(author.signature_concepts) ? author.signature_concepts.join('\n') : '',
      debranding_map: author.debranding_map ? JSON.stringify(author.debranding_map, null, 2) : '{}',
      is_active: author.is_active
    });
    
    // Fetch EN translation
    supabase
      .from('author_translations')
      .select('display_name, description')
      .eq('author_id', author.id)
      .eq('language_code', 'en')
      .single()
      .then(({ data }) => {
        if (data) {
          setFormData(prev => ({
            ...prev,
            display_name_en: data.display_name || '',
            description_en: data.description || ''
          }));
        }
      });
    
    setIsDialogOpen(true);
  }

  async function handleSave() {
    const signatureConceptsArray = formData.signature_concepts.split('\n').filter(x => x.trim());
    let debrandingMapObj = {};
    try {
      debrandingMapObj = JSON.parse(formData.debranding_map);
    } catch {
      alert('Érvénytelen JSON formátum a debranding map-nél');
      return;
    }

    if (editingAuthor) {
      // Update existing
      const { error: authError } = await supabase
        .from('authors')
        .update({
          primary_worldview_id: formData.primary_worldview_id || null,
          secondary_worldviews: formData.secondary_worldviews,
          signature_concepts: signatureConceptsArray,
          debranding_map: debrandingMapObj,
          is_active: formData.is_active
        })
        .eq('id', editingAuthor.id);

      if (authError) {
        alert('Hiba a szerző frissítésekor: ' + authError.message);
        return;
      }

      // Update HU translation
      await supabase
        .from('author_translations')
        .update({ display_name: formData.display_name_hu, description: formData.description_hu })
        .eq('author_id', editingAuthor.id)
        .eq('language_code', 'hu');

      // Update EN translation
      await supabase
        .from('author_translations')
        .update({ display_name: formData.display_name_en, description: formData.description_en })
        .eq('author_id', editingAuthor.id)
        .eq('language_code', 'en');

    } else {
      // Create new
      const { data: newAuthor, error: authError } = await supabase
        .from('authors')
        .insert({
          primary_worldview_id: formData.primary_worldview_id || null,
          secondary_worldviews: formData.secondary_worldviews,
          signature_concepts: signatureConceptsArray,
          debranding_map: debrandingMapObj,
          is_active: formData.is_active
        })
        .select()
        .single();

      if (authError || !newAuthor) {
        alert('Hiba a szerző létrehozásakor: ' + authError?.message);
        return;
      }

      // Create HU translation
      await supabase
        .from('author_translations')
        .insert({
          author_id: newAuthor.id,
          language_code: 'hu',
          display_name: formData.display_name_hu,
          description: formData.description_hu
        });

      // Create EN translation
      await supabase
        .from('author_translations')
        .insert({
          author_id: newAuthor.id,
          language_code: 'en',
          display_name: formData.display_name_en,
          description: formData.description_en
        });
    }

    setIsDialogOpen(false);
    fetchAuthors();
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretnéd ezt a szerzőt?')) return;
    
    const { error } = await supabase
      .from('authors')
      .delete()
      .eq('id', id);
    
    if (!error) {
      fetchAuthors();
    } else {
      alert('Hiba a törléskor: ' + error.message);
    }
  }

  function toggleSecondaryWorldview(worldviewId: WorldviewId) {
    setFormData(prev => ({
      ...prev,
      secondary_worldviews: prev.secondary_worldviews.includes(worldviewId)
        ? prev.secondary_worldviews.filter(w => w !== worldviewId)
        : [...prev.secondary_worldviews, worldviewId]
    }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/authors" locale="hu">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge>
            </Link>
            <Link href="/authors" locale="en">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge>
            </Link>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm text-muted-foreground">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm text-muted-foreground">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm text-muted-foreground">{t('nav.curation')}</Link>
          <Link href="/examples" className="text-sm text-muted-foreground">💡 Példák</Link>
          <Link href="/worldviews" className="text-sm text-muted-foreground">🌍 Világnézetek</Link>
          <Link href="/authors" className="text-sm font-medium">👤 Szerzők</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">👤 Szerzők</h2>
            <p className="text-muted-foreground mt-2">
              Szerzők kezelése világnézet-specifikus debranding szabályokkal.
            </p>
          </div>
          <Button onClick={openCreateDialog}>+ Új szerző</Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Betöltés...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {authors.map((author) => (
              <Card key={author.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-xl mb-1 truncate">{author.display_name}</CardTitle>
                      {author.description && (
                        <CardDescription className="text-sm line-clamp-2">
                          {author.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(author)}
                        className="h-8 w-8 p-0"
                      >
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(author.id)}
                        className="h-8 w-8 p-0"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Primary Worldview */}
                  {author.primary_worldview_id && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Elsődleges világnézet</h4>
                      <Badge variant="default">
                        {worldviews.find(w => w.id === author.primary_worldview_id)?.name || author.primary_worldview_id}
                      </Badge>
                    </div>
                  )}

                  {/* Secondary Worldviews */}
                  {author.secondary_worldviews && author.secondary_worldviews.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Másodlagos világnézetek</h4>
                      <div className="flex flex-wrap gap-1">
                        {author.secondary_worldviews.map((wvId: string) => (
                          <Badge key={wvId} variant="outline" className="text-xs">
                            {worldviews.find(w => w.id === wvId)?.name || wvId}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signature Concepts */}
                  {author.signature_concepts && author.signature_concepts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground mb-1">Jellemző fogalmak</h4>
                      <div className="flex flex-wrap gap-1">
                        {author.signature_concepts.slice(0, 3).map((concept: string, idx: number) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Status */}
                  <div className="pt-2 border-t">
                    <Button
                      size="sm"
                      variant={author.is_active ? "default" : "outline"}
                      onClick={() => toggleActive(author.id, author.is_active)}
                      className="w-full"
                    >
                      {author.is_active ? '✓ Aktív' : 'Inaktív'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAuthor ? 'Szerző szerkesztése' : 'Új szerző'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Név (magyar)</label>
                <Input
                  value={formData.display_name_hu}
                  onChange={(e) => setFormData({ ...formData, display_name_hu: e.target.value })}
                  placeholder="pl. Eckhart Tolle"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Név (angol)</label>
                <Input
                  value={formData.display_name_en}
                  onChange={(e) => setFormData({ ...formData, display_name_en: e.target.value })}
                  placeholder="e.g. Eckhart Tolle"
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Leírás (magyar)</label>
                <Textarea
                  value={formData.description_hu}
                  onChange={(e) => setFormData({ ...formData, description_hu: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Leírás (angol)</label>
                <Textarea
                  value={formData.description_en}
                  onChange={(e) => setFormData({ ...formData, description_en: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            {/* Primary Worldview */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Elsődleges világnézet</label>
              <Select value={formData.primary_worldview_id || 'none'} onValueChange={(val) => setFormData({ ...formData, primary_worldview_id: val === 'none' ? '' : val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Válassz..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nincs</SelectItem>
                  {worldviews.map((wv) => (
                    <SelectItem key={wv.id} value={wv.id}>
                      {wv.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Secondary Worldviews */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Másodlagos világnézetek</label>
              <div className="flex flex-wrap gap-2 p-3 border rounded">
                {worldviews.map((wv) => (
                  <Badge
                    key={wv.id}
                    variant={formData.secondary_worldviews.includes(wv.id as WorldviewId) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSecondaryWorldview(wv.id as WorldviewId)}
                  >
                    {wv.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Signature Concepts */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Jellemző fogalmak (soronként egy)</label>
              <Textarea
                value={formData.signature_concepts}
                onChange={(e) => setFormData({ ...formData, signature_concepts: e.target.value })}
                rows={4}
                placeholder="jelenlét&#10;ego feloldása&#10;megfigyelő tudat"
              />
            </div>

            {/* Debranding Map */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Debranding Map (JSON)</label>
              <Textarea
                value={formData.debranding_map}
                onChange={(e) => setFormData({ ...formData, debranding_map: e.target.value })}
                rows={6}
                placeholder='{"Pain Body": "fájdalomtest", "Now": "jelen pillanat"}'
                className="font-mono text-xs"
              />
            </div>

            {/* Active */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Aktív</label>
              <Button
                type="button"
                variant={formData.is_active ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                {formData.is_active ? '✓ Aktív' : 'Inaktív'}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSave}>
              {editingAuthor ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
