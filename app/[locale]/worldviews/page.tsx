'use client';
import { useTranslations, useLocale } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { WorldviewWithTranslation, WorldviewId } from '@/lib/types';

export default function WorldviewsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [worldviews, setWorldviews] = useState<WorldviewWithTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorldview, setEditingWorldview] = useState<WorldviewWithTranslation | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name_hu: '',
    name_en: '',
    description_hu: '',
    description_en: '',
    core_concepts: '',
    typical_phrases: '',
    avoid_terms: '',
    display_order: 0,
    is_active: true
  });

  async function fetchWorldviews() {
    setLoading(true);
    
    // Query worldviews with translations
    const { data, error } = await supabase
      .from('worldviews')
      .select(`
        *,
        worldview_translations!inner(name, description)
      `)
      .eq('worldview_translations.language_code', locale || 'hu')
      .order('display_order', { ascending: true });

    if (!error && data) {
      // Transform the data to flatten the translation fields
      const transformed = data.map((item: any) => ({
        ...item,
        name: item.worldview_translations[0]?.name || item.id,
        description: item.worldview_translations[0]?.description || null,
        worldview_translations: undefined // Remove nested object
      }));
      setWorldviews(transformed);
    } else if (error) {
      console.error('Error fetching worldviews:', error);
    }
    
    setLoading(false);
  }

  useEffect(() => {
    fetchWorldviews();
  }, [locale]);

  async function toggleActive(id: string, currentActive: boolean) {
    const { error } = await supabase
      .from('worldviews')
      .update({ is_active: !currentActive })
      .eq('id', id);
    
    if (!error) {
      setWorldviews(worldviews.map(wv => 
        wv.id === id ? { ...wv, is_active: !currentActive } : wv
      ));
    }
  }

  function openCreateDialog() {
    setEditingWorldview(null);
    setFormData({
      id: '',
      name_hu: '',
      name_en: '',
      description_hu: '',
      description_en: '',
      core_concepts: '',
      typical_phrases: '',
      avoid_terms: '',
      display_order: worldviews.length + 1,
      is_active: true
    });
    setIsDialogOpen(true);
  }

  function openEditDialog(worldview: WorldviewWithTranslation) {
    setEditingWorldview(worldview);
    setFormData({
      id: worldview.id,
      name_hu: worldview.name || '',
      name_en: '', // We need to fetch EN translation
      description_hu: worldview.description || '',
      description_en: '', // We need to fetch EN translation
      core_concepts: Array.isArray(worldview.core_concepts) ? worldview.core_concepts.join('\n') : '',
      typical_phrases: Array.isArray(worldview.typical_phrases) ? worldview.typical_phrases.join('\n') : '',
      avoid_terms: Array.isArray(worldview.avoid_terms) ? worldview.avoid_terms.join('\n') : '',
      display_order: worldview.display_order,
      is_active: worldview.is_active
    });
    
    // Fetch EN translation
    supabase
      .from('worldview_translations')
      .select('name, description')
      .eq('worldview_id', worldview.id)
      .eq('language_code', 'en')
      .single()
      .then(({ data }) => {
        if (data) {
          setFormData(prev => ({
            ...prev,
            name_en: data.name || '',
            description_en: data.description || ''
          }));
        }
      });
    
    setIsDialogOpen(true);
  }

  async function handleSave() {
    const coreConceptsArray = formData.core_concepts.split('\n').filter(x => x.trim());
    const typicalPhrasesArray = formData.typical_phrases.split('\n').filter(x => x.trim());
    const avoidTermsArray = formData.avoid_terms.split('\n').filter(x => x.trim());

    if (editingWorldview) {
      // Update existing
      const { error: wvError } = await supabase
        .from('worldviews')
        .update({
          core_concepts: coreConceptsArray,
          typical_phrases: typicalPhrasesArray,
          avoid_terms: avoidTermsArray,
          display_order: formData.display_order,
          is_active: formData.is_active
        })
        .eq('id', formData.id);

      if (wvError) {
        alert('Hiba a világnézet frissítésekor: ' + wvError.message);
        return;
      }

      // Update HU translation
      await supabase
        .from('worldview_translations')
        .update({ name: formData.name_hu, description: formData.description_hu })
        .eq('worldview_id', formData.id)
        .eq('language_code', 'hu');

      // Update EN translation
      await supabase
        .from('worldview_translations')
        .update({ name: formData.name_en, description: formData.description_en })
        .eq('worldview_id', formData.id)
        .eq('language_code', 'en');

    } else {
      // Create new
      const { error: wvError } = await supabase
        .from('worldviews')
        .insert({
          id: formData.id,
          core_concepts: coreConceptsArray,
          typical_phrases: typicalPhrasesArray,
          avoid_terms: avoidTermsArray,
          display_order: formData.display_order,
          is_active: formData.is_active
        });

      if (wvError) {
        alert('Hiba a világnézet létrehozásakor: ' + wvError.message);
        return;
      }

      // Create HU translation
      await supabase
        .from('worldview_translations')
        .insert({
          worldview_id: formData.id,
          language_code: 'hu',
          name: formData.name_hu,
          description: formData.description_hu
        });

      // Create EN translation
      await supabase
        .from('worldview_translations')
        .insert({
          worldview_id: formData.id,
          language_code: 'en',
          name: formData.name_en,
          description: formData.description_en
        });
    }

    setIsDialogOpen(false);
    fetchWorldviews();
  }

  async function handleDelete(id: string) {
    if (!confirm('Biztosan törölni szeretnéd ezt a világnézetet?')) return;
    
    const { error } = await supabase
      .from('worldviews')
      .delete()
      .eq('id', id);
    
    if (!error) {
      fetchWorldviews();
    } else {
      alert('Hiba a törléskor: ' + error.message);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/worldviews" locale="hu">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge>
            </Link>
            <Link href="/worldviews" locale="en">
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
          <Link href="/worldviews" className="text-sm font-medium">🌍 Világnézetek</Link>
          <Link href="/authors" className="text-sm text-muted-foreground">👤 Szerzők</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">🌍 Világnézetek</h2>
            <p className="text-muted-foreground mt-2">
              A rendszer 4 különböző világnézetet támogat a tartalom személyre szabásához.
            </p>
          </div>
          <Button onClick={openCreateDialog}>+ Új világnézet</Button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Betöltés...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {worldviews.map((worldview) => (
              <Card key={worldview.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-2xl mb-2">{worldview.name}</CardTitle>
                      {worldview.description && (
                        <CardDescription className="text-base">
                          {worldview.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(worldview)}
                      >
                        ✏️ Szerkesztés
                      </Button>
                      <Button
                        size="sm"
                        variant={worldview.is_active ? "default" : "outline"}
                        onClick={() => toggleActive(worldview.id, worldview.is_active)}
                      >
                        {worldview.is_active ? '✓ Aktív' : 'Inaktív'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(worldview.id)}
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Core Concepts */}
                  {worldview.core_concepts && worldview.core_concepts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Alapfogalmak</h4>
                      <div className="flex flex-wrap gap-2">
                        {worldview.core_concepts.map((concept: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {concept}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Typical Phrases */}
                  {worldview.typical_phrases && worldview.typical_phrases.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Jellemző kifejezések</h4>
                      <ul className="space-y-1 text-sm">
                        {worldview.typical_phrases.slice(0, 3).map((phrase: string, idx: number) => (
                          <li key={idx} className="text-muted-foreground italic">
                            "{phrase}"
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Avoid Terms */}
                  {worldview.avoid_terms && worldview.avoid_terms.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Kerülendő kifejezések</h4>
                      <div className="flex flex-wrap gap-2">
                        {worldview.avoid_terms.slice(0, 4).map((term: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-red-500 border-red-500/50">
                            {term}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingWorldview ? 'Világnézet szerkesztése' : 'Új világnézet'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* ID (only for new) */}
            {!editingWorldview && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">ID (pl. stoic, buddhist)</label>
                <Input
                  value={formData.id}
                  onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  placeholder="stoic"
                />
              </div>
            )}

            {/* Names */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Név (magyar)</label>
                <Input
                  value={formData.name_hu}
                  onChange={(e) => setFormData({ ...formData, name_hu: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Név (angol)</label>
                <Input
                  value={formData.name_en}
                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
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

            {/* Core Concepts */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Alapfogalmak (soronként egy)</label>
              <Textarea
                value={formData.core_concepts}
                onChange={(e) => setFormData({ ...formData, core_concepts: e.target.value })}
                rows={4}
                placeholder="neuroplaszticitás&#10;tudatosság kutatás&#10;stresszválasz"
              />
            </div>

            {/* Typical Phrases */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Jellemző kifejezések (soronként egy)</label>
              <Textarea
                value={formData.typical_phrases}
                onChange={(e) => setFormData({ ...formData, typical_phrases: e.target.value })}
                rows={4}
                placeholder="kutatások szerint&#10;az agy képes&#10;tudományosan bizonyított"
              />
            </div>

            {/* Avoid Terms */}
            <div className="grid gap-2">
              <label className="text-sm font-medium">Kerülendő kifejezések (soronként egy)</label>
              <Textarea
                value={formData.avoid_terms}
                onChange={(e) => setFormData({ ...formData, avoid_terms: e.target.value })}
                rows={4}
                placeholder="spirituális&#10;misztikus&#10;ezoterikus"
              />
            </div>

            {/* Display Order & Active */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Sorrend</label>
                <Input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Mégse
            </Button>
            <Button onClick={handleSave}>
              {editingWorldview ? 'Mentés' : 'Létrehozás'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
