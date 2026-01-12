'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const t = useTranslations();
  const [stats, setStats] = useState({ pending: 0, approved: 0, total: 0 });
  const [fewShotStats, setFewShotStats] = useState({ active: 0, total: 0 });
  const [worldviewCount, setWorldviewCount] = useState(0);
  const [authorCount, setAuthorCount] = useState(0);
  const [atomsByWorldview, setAtomsByWorldview] = useState<{ worldview_id: string; count: number; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        // Content staging stats
        const { data, error, count } = await supabase
          .from('content_staging')
          .select('status', { count: 'exact' });

        if (error) throw error;

        const pending = data?.filter(d => d.status === 'pending_review').length || 0;
        const approved = data?.filter(d => d.status === 'approved').length || 0;
        
        setStats({ pending, approved, total: count || 0 });

        // Few-shot examples stats
        const { count: totalExamples } = await supabase
          .from('refinery_examples')
          .select('*', { count: 'exact', head: true });

        const { count: activeExamples } = await supabase
          .from('refinery_examples')
          .select('*', { count: 'exact', head: true })
          .eq('active', true);

        setFewShotStats({ 
          active: activeExamples || 0, 
          total: totalExamples || 0 
        });

        // Active worldviews count
        const { count: worldviews } = await supabase
          .from('worldviews')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        setWorldviewCount(worldviews || 0);

        // Active authors count
        const { count: authors } = await supabase
          .from('authors')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        setAuthorCount(authors || 0);

        // Atoms grouped by worldview
        const { data: worldviewData } = await supabase
          .from('content_staging')
          .select('worldview_id');

        if (worldviewData) {
          const grouped = worldviewData.reduce((acc: any, item) => {
            if (item.worldview_id) {
              acc[item.worldview_id] = (acc[item.worldview_id] || 0) + 1;
            }
            return acc;
          }, {});

          // Get worldview names from translations table
          const { data: worldviews } = await supabase
            .from('worldview_translations')
            .select('worldview_id, name')
            .eq('language_code', 'en');

          const worldviewMap = new Map(worldviews?.map(w => [w.worldview_id, w.name]) || []);

          const atomsBreakdown = Object.entries(grouped).map(([id, count]) => ({
            worldview_id: id,
            count: count as number,
            name: worldviewMap.get(id) || id
          })).sort((a, b) => b.count - a.count);

          setAtomsByWorldview(atomsBreakdown);
        }

      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('common.appName')}</h1>
          <div className="flex gap-2">
            <Link href="/" locale="hu">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.hu')}</Badge>
            </Link>
            <Link href="/" locale="en">
              <Badge variant="outline" className="cursor-pointer hover:bg-accent">{t('languages.en')}</Badge>
            </Link>
          </div>
        </div>
      </header>
      <nav className="border-b border-border bg-muted/50">
        <div className="container mx-auto px-4 py-2 flex gap-4">
          <Link href="/" className="text-sm font-medium">{t('nav.dashboard')}</Link>
          <Link href="/intake" className="text-sm text-muted-foreground">{t('nav.intake')}</Link>
          <Link href="/curation" className="text-sm text-muted-foreground">{t('nav.curation')}</Link>
          <Link href="/examples" className="text-sm text-muted-foreground">{t('nav.examples')}</Link>
          <Link href="/worldviews" className="text-sm text-muted-foreground">{t('nav.worldviews')}</Link>
          <Link href="/authors" className="text-sm text-muted-foreground">{t('nav.authors')}</Link>
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('dashboard.title')}</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded mb-8">
            {t('dashboard.supabaseError')} {error}
          </div>
        )}

        {!error && (
          <div className="bg-green-500/10 border border-green-500 text-green-500 p-4 rounded mb-8">
            {t('dashboard.supabaseOk')}
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.pendingReview')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{loading ? '...' : stats.pending}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.approved')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{loading ? '...' : stats.approved}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.totalAtoms')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{loading ? '...' : stats.total}</p></CardContent>
          </Card>
        </div>

        {/* New Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t('dashboard.fewShotExamples')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {loading ? t('common.loading') : `${fewShotStats.active} / ${fewShotStats.total}`}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.activeTotal')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t('dashboard.worldviews')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{loading ? t('common.loading') : worldviewCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.activeWorldview')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{t('dashboard.authors')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{loading ? t('common.loading') : authorCount}</p>
              <p className="text-xs text-muted-foreground mt-1">{t('dashboard.activeAuthor')}</p>
            </CardContent>
          </Card>
        </div>

        {/* Atoms by Worldview Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('dashboard.atomsByWorldview')}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">{t('common.loading')}</p>
            ) : atomsByWorldview.length > 0 ? (
              <div className="space-y-3">
                {atomsByWorldview.map((item) => (
                  <div key={item.worldview_id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">{item.name}</span>
                    <Badge variant="secondary">{item.count} {t('dashboard.atomCount')}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('dashboard.noData')}</p>
            )}
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t('dashboard.export')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <a
                href="/api/export?format=json"
                download
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
              >
                {t('dashboard.exportJson')}
              </a>
              <a
                href="/api/export?format=csv"
                download
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
              >
                {t('dashboard.exportCsv')}
              </a>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {t('dashboard.exportDescription')}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>{t('dashboard.recentActivity')}</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground text-sm">{t('dashboard.noActivity')}</p></CardContent>
        </Card>
      </main>
    </div>
  );
}
