// Worldview típusok
export type WorldviewId = 'stoic' | 'scientific' | 'spiritual' | 'clinical';

export interface Worldview {
  id: WorldviewId;
  core_concepts: string[];
  typical_phrases: string[];
  search_keywords: string[];
  avoid_terms: string[];
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorldviewTranslation {
  id: string;
  worldview_id: WorldviewId;
  language_code: 'hu' | 'en';
  name: string;
  description: string | null;
  localized_phrases: string[];
  created_at: string;
  updated_at: string;
}

// Worldview a fordításokkal együtt (JOIN eredmény)
export interface WorldviewWithTranslation extends Worldview {
  name: string;
  description: string | null;
}

// Author típusok
export interface Author {
  id: string;
  primary_worldview_id: WorldviewId | null;
  secondary_worldviews: WorldviewId[];
  signature_concepts: string[];
  debranding_map: Record<string, string>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthorTranslation {
  id: string;
  author_id: string;
  language_code: 'hu' | 'en';
  display_name: string;
  description: string | null;
  localized_debranding: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// Author a fordításokkal együtt
export interface AuthorWithTranslation extends Author {
  display_name: string;
  description: string | null;
}

// Meglévő típusok bővítése
export interface Atom {
  id: string;
  original_raw_chunk: string;
  ai_polished_content: string | null;
  status: 'pending_review' | 'approved' | 'rejected';
  source_file: string | null;
  author_id: string | null;
  worldview_id: WorldviewId | null;
  created_at: string;
  updated_at: string;
}

export interface RefineryExample {
  id: string;
  input_text: string;
  ideal_output: string;
  example_type: string;
  active: boolean;
  created_at: string;
}
