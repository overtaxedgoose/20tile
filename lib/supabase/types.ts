export type PuzzleStatus = "published" | "hidden";

export type WordReportSection = "regular" | "junior";
export type WordReportIssueType = "remove" | "add";
export type WordReportStatus = "open" | "resolved";

export interface WordReportRow {
  id: string;
  section: WordReportSection;
  issue_type: WordReportIssueType;
  word: string;
  notes: string | null;
  status: WordReportStatus;
  created_at: string;
}

export interface PuzzleRow {
  id: string;
  number: number;
  tiles: string;           // raw "|" and "," encoded string, NOT url-encoded
  tile_order: string | null; // creator-defined starting order: comma-separated tile IDs, or null
  seed_words: string[];
  title: string | null;
  creator_name: string | null;
  status: PuzzleStatus;
  play_count: number;
  avg_difficulty: number | null;  // rolling average, 1–3 scale
  avg_cleverness: number | null;  // rolling average, 1–3 scale
  rating_count: number;
  published_at: string;
}

export interface JuniorPuzzleRow {
  id: string;
  number: number;
  tiles: string;        // raw "|" and "," encoded string, 3 tiles per seed
  seed_words: string[];
  title: string | null;
  creator_name: string | null;
  status: PuzzleStatus;
  play_count: number;
  balloon_count: number;
  published_at: string;
}

export interface Database {
  public: {
    Tables: {
      puzzles: {
        Row: PuzzleRow;
        Insert: Omit<PuzzleRow, "id" | "number" | "play_count" | "avg_difficulty" | "avg_cleverness" | "rating_count" | "published_at"> & {
          id?: string;
          number?: number;
          tile_order?: string | null;
          play_count?: number;
          avg_difficulty?: number | null;
          avg_cleverness?: number | null;
          rating_count?: number;
          published_at?: string;
        };
        Update: Partial<PuzzleRow>;
        Relationships: [];
      };
      junior_puzzles: {
        Row: JuniorPuzzleRow;
        Insert: Omit<JuniorPuzzleRow, "id" | "number" | "play_count" | "published_at"> & {
          id?: string;
          number?: number;
          play_count?: number;
          published_at?: string;
        };
        Update: Partial<JuniorPuzzleRow>;
        Relationships: [];
      };
      word_reports: {
        Row: WordReportRow;
        Insert: Omit<WordReportRow, "id" | "status" | "created_at"> & {
          id?: string;
          status?: WordReportStatus;
          created_at?: string;
        };
        Update: Partial<WordReportRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_play_count: {
        Args: { puzzle_id: string };
        Returns: undefined;
      };
      increment_junior_play_count: {
        Args: { puzzle_id: string };
        Returns: undefined;
      };
      add_junior_balloon: {
        Args: { puzzle_id: string };
        Returns: undefined;
      };
      submit_rating: {
        Args: { puzzle_id: string; difficulty_val: number; cleverness_val: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
