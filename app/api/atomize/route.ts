import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;
const MAX_CHUNK_SIZE = 28000; // Kis tartalék a 30k limithez képest

async function processChunk(text: string, fewShotExamples: Array<{input_text: string, ideal_output: string}>, worldviewData: any = null): Promise<Array<{en: string, hu: string}>> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API kulcs hiányzik');
  }

  // Build few-shot section if examples exist
  let fewShotSection = '';
  if (fewShotExamples && fewShotExamples.length > 0) {
    fewShotSection = '\n\nFEW-SHOT PÉLDÁK (tanuld meg ebből a stílust):\n';
    fewShotExamples.forEach((example) => {
      fewShotSection += `---\nAI verzió: ${example.input_text}\nJavított verzió: ${example.ideal_output}\n---\n`;
    });
  }

  // Build worldview section if data exists
  let worldviewSection = '';
  if (worldviewData) {
    worldviewSection = '\n\nVILÁGNÉZET SZEMPONTOK:\n';
    
    if (worldviewData.core_concepts?.length > 0) {
      worldviewSection += `Alapfogalmak (használd ezeket a kontextusban): ${worldviewData.core_concepts.join(', ')}\n`;
    }
    
    if (worldviewData.typical_phrases?.length > 0) {
      worldviewSection += `Jellemző kifejezések (használj hasonló stílust): "${worldviewData.typical_phrases.slice(0, 5).join('", "')}"\n`;
    }
    
    if (worldviewData.avoid_terms?.length > 0) {
      worldviewSection += `KERÜLENDŐ kifejezések: ${worldviewData.avoid_terms.join(', ')}\n`;
    }
  }

  const prompt = `Te egy meditációs tartalom kurátor vagy. A feladatod egy nyers YouTube felirat átalakítása értelmes, önálló gondolatokra (atomokra) KÉTNYELVŰEN: angolul ÉS magyarul.

FONTOS: A bemenet YouTube felirat formátum, ami tele van ismétlésekkel, duplikációkkal és töredékes mondatokkal. A te feladatod tiszta, befejezett gondolatokat készíteni belőle.

KÖTELEZŐ SZABÁLYOK:
1. Minden atom NAGYBETŰVEL kezdődik és PONTTAL végződik (mindkét nyelven)
2. Minden atom egy TELJES, BEFEJEZETT gondolat (10-40 szó)
3. AZONOSÍTSD és TÁVOLÍTSD EL a duplikált tartalmakat
4. Javítsd ki a nyelvtani hibákat és az ismétléseket
5. Tartsd meg a meditációs hangvételt mindkét nyelven
6. Az atomok száma automatikusan alakuljon a tartalom hossza alapján
7. NE adj hozzá új tartalmat, csak tisztítsd és strukturáld
8. ANGOL: Eredeti nyelv megtartása, tisztítva
9. MAGYAR: Természetes, meditációs TEGEZŐ hangnem (te/téged/tied), NEM szó szerinti fordítás

PÉLDA KIMENET FORMÁTUM:
[{"en": "Take a moment to settle into your body and notice your breath.", "hu": "Vegyél egy pillanatot, hogy elhelyezkedj a testedben és vedd észre a légzésedet."}, {"en": "Allow yourself to feel whatever arises without judgment.", "hu": "Engedd meg magadnak, hogy ítélkezés nélkül érezd mindazt, ami felmerül."}]
${fewShotSection}${worldviewSection}
BEMENET:
${text}

FONTOS: Csak a JSON tömböt add vissza objektumokkal (en, hu kulcsokkal), semmi mást!`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8192 }
      })
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini error:', error);
    throw new Error('Gemini API hiba');
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  const jsonMatch = content.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    console.error('No JSON found:', content);
    throw new Error('Nem sikerült feldolgozni');
  }

  let atoms: Array<{en: string, hu: string}> = JSON.parse(jsonMatch[0]);
  
  // Post-process: ensure capital start and period end for both languages
  atoms = atoms.map(atom => {
    let cleanedEn = atom.en.trim();
    let cleanedHu = atom.hu.trim();
    
    // Capitalize first letter
    cleanedEn = cleanedEn.charAt(0).toUpperCase() + cleanedEn.slice(1);
    cleanedHu = cleanedHu.charAt(0).toUpperCase() + cleanedHu.slice(1);
    
    // Ensure ends with period
    if (!/[.!?]$/.test(cleanedEn)) cleanedEn += '.';
    if (!/[.!?]$/.test(cleanedHu)) cleanedHu += '.';
    
    return { en: cleanedEn, hu: cleanedHu };
  });
  
  return atoms;
}

export async function POST(request: NextRequest) {
  try {
    const { text, worldview_id } = await request.json();
    
    if (!text || text.length < 50) {
      return NextResponse.json({ error: 'Túl rövid szöveg' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'Gemini API kulcs hiányzik' }, { status: 500 });
    }

    // Fetch active few-shot examples once (cached for all chunks)
    const { data: examples } = await supabase
      .from('refinery_examples')
      .select('input_text, ideal_output')
      .eq('active', true)
      .limit(10);
    const fewShotExamples = examples || [];

    // Fetch worldview data if provided
    let worldviewData: any = null;
    if (worldview_id) {
      const { data } = await supabase
        .from('worldviews')
        .select('core_concepts, typical_phrases, avoid_terms')
        .eq('id', worldview_id)
        .eq('is_active', true)
        .single();
      worldviewData = data;
    }

    // Batch processing nagyobb szövegeknél
    if (text.length > MAX_CHUNK_SIZE) {
      console.log(`Text length ${text.length} > ${MAX_CHUNK_SIZE}, batch processing...`);
      
      const chunks: string[] = [];
      let currentPos = 0;
      
      while (currentPos < text.length) {
        const chunkEnd = Math.min(currentPos + MAX_CHUNK_SIZE, text.length);
        
        // Ha nem az utolsó chunk, próbáljuk mondatvégen vágni
        let actualEnd = chunkEnd;
        if (chunkEnd < text.length) {
          const lastPeriod = text.lastIndexOf('.', chunkEnd);
          const lastQuestion = text.lastIndexOf('?', chunkEnd);
          const lastExclamation = text.lastIndexOf('!', chunkEnd);
          const lastSentenceEnd = Math.max(lastPeriod, lastQuestion, lastExclamation);
          
          if (lastSentenceEnd > currentPos + MAX_CHUNK_SIZE * 0.7) {
            actualEnd = lastSentenceEnd + 1;
          }
        }
        
        chunks.push(text.substring(currentPos, actualEnd).trim());
        currentPos = actualEnd;
      }
      
      console.log(`Split into ${chunks.length} chunks`);
      
      // Feldolgozás batch-enként
      const allAtoms: Array<{en: string, hu: string}> = [];
      
      for (let i = 0; i < chunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`);
        const chunkAtoms = await processChunk(chunks[i], fewShotExamples, worldviewData);
        allAtoms.push(...chunkAtoms);
        
        // Kis késleltetés a rate limiting elkerülésére
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return NextResponse.json({ success: true, atoms: allAtoms, count: allAtoms.length, batches: chunks.length });
    }

    // Egyszerű feldolgozás rövid szövegeknél
    const atoms = await processChunk(text.substring(0, MAX_CHUNK_SIZE), fewShotExamples, worldviewData);
    return NextResponse.json({ success: true, atoms, count: atoms.length });

  } catch (error: any) {
    console.error('Atomize error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
