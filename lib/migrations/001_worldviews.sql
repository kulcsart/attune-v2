-- =====================================================
-- ATTUNE v2 — Worldview System Migration
-- Futtatás: Supabase Dashboard > SQL Editor
-- =====================================================

-- 1. WORLDVIEWS TÁBLA
CREATE TABLE IF NOT EXISTS worldviews (
    id VARCHAR(50) PRIMARY KEY,
    core_concepts JSONB DEFAULT '[]',
    typical_phrases JSONB DEFAULT '[]',
    search_keywords JSONB DEFAULT '[]',
    avoid_terms JSONB DEFAULT '[]',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. WORLDVIEW_TRANSLATIONS TÁBLA
CREATE TABLE IF NOT EXISTS worldview_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worldview_id VARCHAR(50) REFERENCES worldviews(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    localized_phrases JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(worldview_id, language_code)
);

-- 3. AUTHORS TÁBLA
CREATE TABLE IF NOT EXISTS authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    primary_worldview_id VARCHAR(50) REFERENCES worldviews(id),
    secondary_worldviews JSONB DEFAULT '[]',
    signature_concepts JSONB DEFAULT '[]',
    debranding_map JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUTHOR_TRANSLATIONS TÁBLA
CREATE TABLE IF NOT EXISTS author_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    localized_debranding JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(author_id, language_code)
);

-- 5. CONTENT_STAGING TÁBLA BŐVÍTÉSE (ha még nincs worldview_id/author_id)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'content_staging' AND column_name = 'worldview_id') THEN
        ALTER TABLE content_staging ADD COLUMN worldview_id VARCHAR(50) REFERENCES worldviews(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'content_staging' AND column_name = 'author_id') THEN
        ALTER TABLE content_staging ADD COLUMN author_id UUID REFERENCES authors(id);
    END IF;
END $$;

-- 6. INDEXEK
CREATE INDEX IF NOT EXISTS idx_worldview_trans_worldview ON worldview_translations(worldview_id);
CREATE INDEX IF NOT EXISTS idx_worldview_trans_lang ON worldview_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_author_trans_author ON author_translations(author_id);
CREATE INDEX IF NOT EXISTS idx_author_trans_lang ON author_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_content_staging_worldview ON content_staging(worldview_id);
CREATE INDEX IF NOT EXISTS idx_content_staging_author ON content_staging(author_id);

-- =====================================================
-- SEED DATA
-- =====================================================

-- Worldviews
INSERT INTO worldviews (id, core_concepts, typical_phrases, avoid_terms, display_order) VALUES
('stoic', 
 '["dichotómia (irányítható vs nem irányítható)", "erény (virtue)", "jelenlét", "elfogadás (amor fati)"]',
 '["ami rajtad múlik", "a reakciód a tiéd", "fogadd el ami van", "belső erőd"]',
 '["univerzum", "energia", "rezgés", "spirituális", "lélek"]',
 1),
('scientific',
 '["neuroplaszticitás", "tudatosság kutatás", "stresszválasz", "idegrendszer"]',
 '["kutatások szerint", "az agy képes", "tudományosan bizonyított", "a tudomány azt mutatja"]',
 '["spirituális", "misztikus", "hit alapú", "ezoterikus"]',
 2),
('spiritual',
 '["energia", "kapcsolódás", "magasabb én", "univerzum", "belső fény"]',
 '["az univerzum üzenete", "spirituális utazás", "belső bölcsesség", "energetikai egyensúly"]',
 '["adat", "bizonyíték", "statisztika", "klinikai"]',
 3),
('clinical',
 '["szorongás kezelés", "stresszmenedzsment", "önszabályozás", "kognitív technikák"]',
 '["a terápiás gyakorlat", "klinikai módszer", "pszichológiai szempontból", "technikák alkalmazása"]',
 '["energia", "csakra", "karma", "univerzum"]',
 4)
ON CONFLICT (id) DO NOTHING;

-- Worldview translations (HU)
INSERT INTO worldview_translations (worldview_id, language_code, name, description, localized_phrases) VALUES
('stoic', 'hu', 'Stoikus', 'Racionalista megközelítés, amely a belső kontrollra és az elfogadásra fókuszál. A külső események felett nincs hatalmunk, de a reakcióink felett igen.', '["belső béke", "nyugalom megtalálása", "elfogadás"]'),
('scientific', 'hu', 'Tudományos', 'Kutatás-alapú, neurológiai szemléletű megközelítés. Az agykutatás és a pszichológia legújabb eredményeire épít.', '["tudományos alapon", "kutatások alapján", "bizonyítottan működik"]'),
('spiritual', 'hu', 'Spirituális', 'Transzcendens, energetikai megközelítés. A belső bölcsességre és a nagyobb egésszel való kapcsolódásra fókuszál.', '["spirituális fejlődés", "belső utazás", "energetikai harmónia"]'),
('clinical', 'hu', 'Klinikai', 'Terápiás, pszichológiai megközelítés. Bevált klinikai módszereket és technikákat alkalmaz.', '["terápiás módszer", "klinikai gyakorlat", "szakértői megközelítés"]')
ON CONFLICT (worldview_id, language_code) DO NOTHING;

-- Worldview translations (EN)
INSERT INTO worldview_translations (worldview_id, language_code, name, description, localized_phrases) VALUES
('stoic', 'en', 'Stoic', 'Rationalist approach focusing on inner control and acceptance. We cannot control external events, but we can control our reactions.', '["inner peace", "finding calm", "acceptance"]'),
('scientific', 'en', 'Scientific', 'Research-based, neurological approach. Built on the latest findings in brain science and psychology.', '["scientifically proven", "research shows", "evidence-based"]'),
('spiritual', 'en', 'Spiritual', 'Transcendent, energy-based approach. Focuses on inner wisdom and connection to the greater whole.', '["spiritual growth", "inner journey", "energetic harmony"]'),
('clinical', 'en', 'Clinical', 'Therapeutic, psychological approach. Applies proven clinical methods and techniques.', '["therapeutic method", "clinical practice", "expert approach"]')
ON CONFLICT (worldview_id, language_code) DO NOTHING;

-- =====================================================
-- SIKERES FUTTATÁS ELLENŐRZÉSE
-- =====================================================
SELECT 'Worldviews created: ' || COUNT(*) FROM worldviews;
SELECT 'Worldview translations created: ' || COUNT(*) FROM worldview_translations;
