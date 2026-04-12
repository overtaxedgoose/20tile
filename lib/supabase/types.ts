export type PuzzleStatus = "published" | "hidden";

export interface PuzzleRow {
  id: string;
  number: number;
  tiles: string;        // raw "|" and "," encoded string, NOT url-encoded
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

export interface Database {
  public: {
    Tables: {
      puzzles: {
        Row: PuzzleRow;
        Insert: Omit<PuzzleRow, "id" | "number" | "play_count" | "avg_difficulty" | "avg_cleverness" | "rating_count" | "published_at"> & {
          id?: string;
          number?: number;
          play_count?: number;
          avg_difficulty?: number | null;
          avg_cleverness?: number | null;
          rating_count?: number;
          published_at?: string;
        };
        Update: Partial<PuzzleRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_play_count: {
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
