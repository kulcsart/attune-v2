'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const t = useTranslations();
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
        </div>
      </nav>
      <main className="container mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-8">{t('dashboard.title')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.pendingReview')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">0</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.approved')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">0</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{t('dashboard.totalAtoms')}</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">0</p></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><CardTitle>{t('dashboard.recentActivity')}</CardTitle></CardHeader>
          <CardContent><p className="text-muted-foreground text-sm">{t('dashboard.noActivity')}</p></CardContent>
        </Card>
      </main>
    </div>
  );
}
