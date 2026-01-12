'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
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
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    display_name_hu: '',
    display_name_en: '',
    description_hu: '',
    description_en: '',
    primary_worldview_id: '',
    secondary_worldviews: [] as WorldviewId[],
    signature_concepts_hu: '',
    signature_concepts_en: '',
    debranding_map: '',
    is_active: true
  });

  async function fetchAuthors() {
    try {
      setLoading(true);
      
      // First, get all authors with ALL columns
      const { data: authorsData, error: authorsError } = await supabase
        .from('authors')
        .select('*')
        .order('created_at', { ascending: false });

      if (authorsError) throw authorsError;

      if (!authorsData || authorsData.length === 0) {
        setAuthors([]);
        return;
      }

      // Then fetch translations for each author
      const authorsWithTranslations = await Promise.all(
        authorsData.map(async (author) => {
          const { data: translation } = await supabase
            .from('author_translations')
            .select('display_name, description')
            .eq('author_id', author.id)
            .eq('language_code', locale || 'hu')
            .single();

          return {
            ...author,
            display_name: translation?.display_name || 'Unknown',
            description: translation?.description || null
          };
        })
      );

      setAuthors(authorsWithTranslations);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWorldviews() {
    try {
      const { data, error } = await supabase
        .from('worldviews')
        .select(`
          *,
          worldview_translations!inner(name)
        `)
        .eq('worldview_translations.language_code', locale || 'hu')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      if (data) {
        const transformed = data.map((item: any) => ({
          ...item,
          name: item.worldview_translations[0]?.name || item.id
        }));
        setWorldviews(transformed);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => {
    fetchAuthors();
    fetchWorldviews();
  }, [locale]);

  async function toggleActive(id: string, currentActive: boolean) {
    try {
      const { error } = await supabase
        .from('authors')
        .update({ is_active: !currentActive })
        .eq('id', id);
      
      if (error) throw error;
      setAuthors(authors.map(a => 
        a.id === id ? { ...a, is_active: !currentActive } : a
      ));
    } catch (err: any) {
      setError(err.message);
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
      signature_concepts_hu: '',
      signature_concepts_en: '',
      debranding_map: '{"Pain Body": "fájdalomtest", "Now": "jelen pillanat"}',
      is_active: true
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(author: AuthorWithTranslation) {
    setEditingAuthor(author);
    
    // Fetch full author data including debranding_map from separate query
    supabase
      .from('authors')
      .select('*')
      .eq('id', author.id)
      .single()
      .then(({ data: fullAuthor }) => {
        setFormData({
          display_name_hu: author.display_name || '',
          display_name_en: '',
          description_hu: author.description || '',
          description_en: '',
          primary_worldview_id: fullAuthor?.primary_worldview_id || '',
          secondary_worldviews: Array.isArray(fullAuthor?.secondary_worldviews) ? fullAuthor.secondary_worldviews : [],
          signature_concepts_hu: Array.isArray(fullAuthor?.signature_concepts) ? fullAuthor.signature_concepts.join('\n') : '',
          signature_concepts_en: '',
          debranding_map: fullAuthor?.debranding_map ? JSON.stringify(fullAuthor.debranding_map, null, 2) : '{}',
          is_active: fullAuthor?.is_active ?? true
        });
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
    try {
      // Combine bilingual signature concepts
      const conceptsHu = formData.signature_concepts_hu.split('\n').filter(x => x.trim());
      const conceptsEn = formData.signature_concepts_en.split('\n').filter(x => x.trim());
      const allConcepts = [...conceptsHu, ...conceptsEn].filter((v, i, a) => a.indexOf(v) === i); // dedupe
      
      let debrandingMapObj = {};
      try {
        debrandingMapObj = JSON.parse(formData.debranding_map || '{}');
      } catch (err) {
        setError('Érvénytelen JSON formátum a debranding map-nél. Kell lennie objektum formátumban, pl: {"Pain Body": "fájdalomtest"}');
        return;
      }

      if (editingAuthor) {
        // Update existing
        const { error: authError } = await supabase
          .from('authors')
          .update({
            primary_worldview_id: formData.primary_worldview_id || null,
            secondary_worldviews: formData.secondary_worldviews,
            signature_concepts: allConcepts,
            debranding_map: debrandingMapObj,
            is_active: formData.is_active
          })
          .eq('id', editingAuthor.id);

        if (authError) throw authError;

        // Update HU translation
        const { error: huError } = await supabase
          .from('author_translations')
          .update({ display_name: formData.display_name_hu, description: formData.description_hu })
          .eq('author_id', editingAuthor.id)
          .eq('language_code', 'hu');

        if (huError) throw huError;

        // Update EN translation
        const { error: enError } = await supabase
          .from('author_translations')
          .update({ display_name: formData.display_name_en, description: formData.description_en })
          .eq('author_id', editingAuthor.id)
          .eq('language_code', 'en');

        if (enError) throw enError;

      } else {
        // Create new
        const { data: newAuthor, error: authError } = await supabase
          .from('authors')
          .insert({
            primary_worldview_id: formData.primary_worldview_id || null,
            secondary_worldviews: formData.secondary_worldviews,
            signature_concepts: allConcepts,
            debranding_map: debrandingMapObj,
            is_active: formData.is_active
          })
          .select()
          .single();

        if (authError || !newAuthor) throw authError || new Error('Nem sikerült létrehozni a szerzőt');

        // Create HU translation
        const { error: huError } = await supabase
          .from('author_translations')
          .insert({
            author_id: newAuthor.id,
            language_code: 'hu',
            display_name: formData.display_name_hu,
            description: formData.description_hu
          });

        if (huError) throw huError;

        // Create EN translation
        const { error: enError } = await supabase
          .from('author_translations')
          .insert({
            author_id: newAuthor.id,
            language_code: 'en',
            display_name: formData.display_name_en,
            description: formData.description_en
          });

        if (enError) throw enError;
      }

      setIsDialogOpen(false);
      fetchAuthors();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    if (!confirm('Biztosan törölni szeretnéd ezt a szerzőt?')) return;
    
    try {
      const { error } = await supabase
        .from('authors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchAuthors();
    } catch (err: any) {
      setError(err.message);
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
          <Link href="/examples" className="text-sm text-muted-foreground">{t('nav.examples')}</Link>
          <Link href="/worldviews" className="text-sm text-muted-foreground">{t('nav.worldviews')}</Link>
          <Link href="/authors" className="text-sm font-medium">{t('nav.authors')}</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded mb-4">
            ❌ {error}
          </div>
        )}
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
          <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        ) : authors.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('authors.noAuthors')}</CardContent></Card>
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
            <DialogDescription>
              {editingAuthor 
                ? 'Módosítsd a szerző adatait és világnézet-specifikus beállításait.' 
                : 'Hozz létre egy új szerzőt kétnyelvű adatokkal és debranding szabályokkal.'}
            </DialogDescription>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Jellemző fogalmak (magyar)</label>
                <Textarea
                  value={formData.signature_concepts_hu}
                  onChange={(e) => setFormData({ ...formData, signature_concepts_hu: e.target.value })}
                  rows={4}
                  placeholder="jelenlét&#10;ego feloldása&#10;megfigyelő tudat"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Signature concepts (English)</label>
                <Textarea
                  value={formData.signature_concepts_en}
                  onChange={(e) => setFormData({ ...formData, signature_concepts_en: e.target.value })}
                  rows={4}
                  placeholder="presence&#10;ego dissolution&#10;witness consciousness"
                />
              </div>
            </div>

            {/* Debranding Map */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Debranding Map (JSON)</label>
                <span className="text-xs text-muted-foreground">A szerző márkaneveit általánosítja</span>
              </div>
              <Textarea
                value={formData.debranding_map}
                onChange={(e) => setFormData({ ...formData, debranding_map: e.target.value })}
                rows={6}
                placeholder='{"Pain Body": "fájdalomtest", "Now": "jelen pillanat", "Ego": "én-tudat"}'
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                💡 Példa: Eckhart Tolle "Pain Body" → "fájdalomtest". Az AI automatikusan helyettesíti ezeket a kifejezéseket az atomizálás során.
              </p>
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
