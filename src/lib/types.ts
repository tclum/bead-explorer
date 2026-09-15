export type SourceKind = "pdf" | "html";

export type Source = {
  id: string;
  short: string;
  title: string;
  publisher: string;
  date: string | null;
  kind: SourceKind;
  url: string;
  expect_pages?: number;
  page_range?: [number, number];
  notes?: string;
  selector?: string;
  strip?: string[];
  sha256?: string;
  bytes?: number;
  pages?: number;
  fetched_at?: string;
};

export type Manifest = {
  manifestVersion: number;
  sources: Source[];
};

export type Chunk = {
  id: string;
  doc: string;
  page: number;
  text: string;
  url: string;
  page_url: string;
};

export type Corpus = {
  generated_at: string;
  manifestVersion: number;
  chunks: Chunk[];
};

export type Citation = { passage_id: string; quote: string };
export type VerifiedCitation = Citation & {
  doc: string;
  page: number;
  url: string;
  page_url: string;
  reattributed: boolean;
};

export type RetrievedChunk = {
  id: string;
  doc: string;
  page: number;
  score: number;
  text: string;
  url: string;
  page_url: string;
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
};

export type GroundedResult = {
  question: string;
  answer: string;
  refused: boolean;
  refusal_reason?: string;
  citations: VerifiedCitation[];
  dropped_citations: number;
  retrieved: { id: string; doc: string; page: number; score: number }[];
  model: string;
  latency_ms: number;
  retried: boolean;
  uncovered_numbers: string[];
  usage: Usage;
};

export type StatusItem = {
  key: string;
  label: string;
  value: string;
  detail?: string;
  source:
    | {
        doc: string;
        page: number;
        quote: string;
      }
    | {
        csv: string;
        row: Record<string, string>;
        columns: Record<string, number>;
        note?: string;
      };
};

export type StatusFile = {
  statusVersion: number;
  items: StatusItem[];
};
