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
  const [otherLangTranslation, setOtherLangTranslation] = useState<{ display_name: string; description: string } | null>(null);
  
  // Form state - only current locale fields
  const [formData, setFormData] = useState({
    display_name: '',
    description: '',
    primary_worldview_id: '',
    secondary_worldviews: [] as WorldviewId[],
    signature_concepts: '',
    debranding_map: '',
    is_active: true
  });

  async function fetchAuthors() {
    try {
      setLoading(true);
      
      const { data: authorsData, error: authorsError } = await supabase
        .from('authors')
        .select('*')
        .order('created_at', { ascending: false });

      if (authorsError) throw authorsError;

      if (!authorsData || authorsData.length === 0) {
        setAuthors([]);
        return;
      }

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
            display_name: translation?.display_name || '',
            description: translation?.description || ''
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
    setOtherLangTranslation(null);
    setFormData({
      display_name: '',
      description: '',
      primary_worldview_id: '',
      secondary_worldviews: [],
      signature_concepts: '',
      debranding_map: '{"Pain Body": "fájdalomtest", "Now": "jelen pillanat"}',
      is_active: true
    });
    setIsDialogOpen(true);
  }

  async function openEditDialog(author: AuthorWithTranslation) {
    setEditingAuthor(author);
    
    // Fetch full author data
    const { data: fullAuthor } = await supabase
      .from('authors')
      .select('*')
      .eq('id', author.id)
      .single();
    
    setFormData({
      display_name: author.display_name || '',
      description: author.description || '',
      primary_worldview_id: fullAuthor?.primary_worldview_id || '',
      secondary_worldviews: Array.isArray(fullAuthor?.secondary_worldviews) ? fullAuthor.secondary_worldviews : [],
      signature_concepts: Array.isArray(fullAuthor?.signature_concepts) ? fullAuthor.signature_concepts.join('\n') : '',
      debranding_map: fullAuthor?.debranding_map ? JSON.stringify(fullAuthor.debranding_map, null, 2) : '{}',
      is_active: fullAuthor?.is_active ?? true
    });
    
    // Fetch other language translation status
    const otherLang = locale === 'hu' ? 'en' : 'hu';
    const { data } = await supabase
      .from('author_translations')
      .select('display_name, description')
      .eq('author_id', author.id)
      .eq('language_code', otherLang)
      .single();
    
    setOtherLangTranslation(data || null);
    setIsDialogOpen(true);
  }

  async function handleSave() {
    try {
      const conceptsArray = formData.signature_concepts.split('\n').filter(x => x.trim());
      
      let debrandingMapObj = {};
      try {
        debrandingMapObj = JSON.parse(formData.debranding_map || '{}');
      } catch (err) {
        setError(t('authors.invalidDebrandingJson'));
        return;
      }

      if (editingAuthor) {
        // Update existing
        const { error: authError } = await supabase
          .from('authors')
          .update({
            primary_worldview_id: formData.primary_worldview_id || null,
            secondary_worldviews: formData.secondary_worldviews,
            signature_concepts: conceptsArray,
            debranding_map: debrandingMapObj,
            is_active: formData.is_active
          })
          .eq('id', editingAuthor.id);

        if (authError) throw authError;

        // Update current language translation
        const { error: translationError } = await supabase
          .from('author_translations')
          .update({ display_name: formData.display_name, description: formData.description })
          .eq('author_id', editingAuthor.id)
          .eq('language_code', locale);

        if (translationError) throw translationError;

      } else {
        // Create new
        const { data: newAuthor, error: authError } = await supabase
          .from('authors')
          .insert({
            primary_worldview_id: formData.primary_worldview_id || null,
            secondary_worldviews: formData.secondary_worldviews,
            signature_concepts: conceptsArray,
            debranding_map: debrandingMapObj,
            is_active: formData.is_active
          })
          .select()
          .single();

        if (authError || !newAuthor) throw authError || new Error('Failed to create author');

        // Create current language translation
        const { error: currentLangError } = await supabase
          .from('author_translations')
          .insert({
            author_id: newAuthor.id,
            language_code: locale,
            display_name: formData.display_name,
            description: formData.description
          });

        if (currentLangError) throw currentLangError;

        // Create empty placeholder for other language
        const otherLang = locale === 'hu' ? 'en' : 'hu';
        const { error: otherLangError } = await supabase
          .from('author_translations')
          .insert({
            author_id: newAuthor.id,
            language_code: otherLang,
            display_name: '',
            description: ''
          });

        if (otherLangError) throw otherLangError;
      }

      setIsDialogOpen(false);
      fetchAuthors();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    if (!confirm(t('authors.confirmDelete'))) return;
    
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

  const otherLang = locale === 'hu' ? 'en' : 'hu';
  const otherLangName = locale === 'hu' ? 'English' : 'Magyar';

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
            <h2 className="text-3xl font-bold">{t('authors.title')}</h2>
            <p className="text-muted-foreground mt-2">
              {t('authors.description')}
            </p>
          </div>
          <Button onClick={openCreateDialog}>{t('authors.createNew')}</Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>
        ) : authors.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">{t('authors.noAuthors')}</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {authors.map((author) => {
              const primaryWorldview = worldviews.find(w => w.id === author.primary_worldview_id);
              const hasContent = author.display_name || author.description;
              
              return (
                <Card key={author.id} className="relative">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        {!hasContent && (
                          <Badge variant="outline" className="mb-2 text-amber-600 border-amber-600">
                            ⚠️ {t('common.missingTranslation')}
                          </Badge>
                        )}
                        <CardTitle className="text-2xl mb-2">
                          {author.display_name || <span className="text-muted-foreground italic">{t('curation.noContentForLocale')}</span>}
                        </CardTitle>
                        {author.description && (
                          <CardDescription className="text-base">
                            {author.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditDialog(author)}
                        >
                          {t('authors.edit')}
                        </Button>
                        <Button
                          size="sm"
                          variant={author.is_active ? "default" : "outline"}
                          onClick={() => toggleActive(author.id, author.is_active)}
                        >
                          {author.is_active ? t('authors.active') : t('authors.inactive')}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(author.id)}
                        >
                          {t('authors.delete')}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Primary Worldview */}
                    {primaryWorldview && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('authors.primaryWorldview')}</h4>
                        <Badge variant="default">{primaryWorldview.name}</Badge>
                      </div>
                    )}

                    {/* Secondary Worldviews */}
                    {author.secondary_worldviews && author.secondary_worldviews.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('authors.secondaryWorldviews')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {author.secondary_worldviews.map((wvId: string) => {
                            const wv = worldviews.find(w => w.id === wvId);
                            return wv ? (
                              <Badge key={wvId} variant="outline">{wv.name}</Badge>
                            ) : null;
                          })}
                        </div>
                      </div>
                    )}

                    {/* Signature Concepts */}
                    {author.signature_concepts && author.signature_concepts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{t('authors.signatureConcepts')}</h4>
                        <div className="flex flex-wrap gap-2">
                          {author.signature_concepts.slice(0, 5).map((concept: string, idx: number) => (
                            <Badge key={idx} variant="secondary">
                              {concept}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAuthor ? t('authors.dialog.edit') : t('authors.dialog.create')}
            </DialogTitle>
            <DialogDescription>
              {editingAuthor && otherLangTranslation && (otherLangTranslation.display_name || otherLangTranslation.description) && (
                <span className="text-green-600">
                  ✓ {otherLangName} {t('authors.dialog.translationAvailable')}
                </span>
              )}
              {editingAuthor && (!otherLangTranslation || (!otherLangTranslation.display_name && !otherLangTranslation.description)) && (
                <span className="text-amber-600">
                  ⚠️ {otherLangName} {t('authors.dialog.translationMissing')}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Display Name (current locale only) */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.displayName')}</label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder={locale === 'hu' ? 'Eckhart Tolle' : 'Eckhart Tolle'}
              />
            </div>

            {/* Description (current locale only) */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.description')}</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder={locale === 'hu' ? 'Spirituális tanító és bestseller szerző...' : 'Spiritual teacher and bestselling author...'}
              />
            </div>

            {/* Primary Worldview */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.primaryWorldview')}</label>
              <Select value={formData.primary_worldview_id || 'none'} onValueChange={(val) => setFormData({ ...formData, primary_worldview_id: val === 'none' ? '' : val })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('authors.dialog.selectWorldview')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.none')}</SelectItem>
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
              <label className="text-sm font-medium">{t('authors.dialog.secondaryWorldviews')}</label>
              <div className="flex flex-wrap gap-2 p-2 border rounded">
                {worldviews.map((wv) => (
                  <Badge
                    key={wv.id}
                    variant={formData.secondary_worldviews.includes(wv.id) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleSecondaryWorldview(wv.id)}
                  >
                    {wv.name}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Signature Concepts */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.signatureConcepts')}</label>
              <Textarea
                value={formData.signature_concepts}
                onChange={(e) => setFormData({ ...formData, signature_concepts: e.target.value })}
                rows={4}
                placeholder={locale === 'hu' ? "jelenvaló tudat\nego feloldás\nfájdalomtest" : "present moment awareness\nego dissolution\npain body"}
              />
            </div>

            {/* Debranding Map */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.debrandingMap')}</label>
              <Textarea
                value={formData.debranding_map}
                onChange={(e) => setFormData({ ...formData, debranding_map: e.target.value })}
                rows={4}
                placeholder='{"Pain Body": "fájdalomtest", "Now": "jelen pillanat"}'
                className="font-mono text-xs"
              />
            </div>

            {/* Active */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">{t('authors.dialog.isActive')}</label>
              <Button
                type="button"
                variant={formData.is_active ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
              >
                {formData.is_active ? t('common.active') : t('common.inactive')}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {t('authors.dialog.cancel')}
            </Button>
            <Button onClick={handleSave}>
              {t('authors.dialog.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
