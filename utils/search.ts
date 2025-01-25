import { VectorDB } from 'imvectordb';
import round from 'lodash/round';
import sortBy from 'lodash/sortBy';
import MiniSearch, { SearchResult } from 'minisearch';

import { getEmbedding } from './etl';

export interface CombinedScore {
  id: string;
  keywordScore: number;
  rank: number;
  semanticScore: number;
  text: string;
  title: string;
}
export interface Score {
  id: string;
  rank: number;
  text: string;
  title: string;
}

// keyword + fuzzy
export const findKeywordMatches = (
  db: MiniSearch,
  query: string
): SearchResult[] =>
  db.search(query);

export const findSemanticMatches = async (
  db: VectorDB,
  query: string,
  limit = 10,
): Promise<any[]> => {
  const embedding = await getEmbedding(query);

  return db.query(embedding, limit);
};

export const getScores = (
  keywordResults: SearchResult[],
  semanticResults: any[],
  limit?: number,
): CombinedScore[] => {
  const scores: any[] = [];

  for (const keywordResult of keywordResults) {
    const match = semanticResults.find(
      (semanticResult) => semanticResult.document.id === keywordResult.id.toString()
    );

    scores.push({
      id: keywordResult.id.toString(),
      keywordScore: keywordResult.score,
      semanticScore: match ? match.similarity : 0,
      text: keywordResult.text,
      title: keywordResult.title,
    });
  }

  for (const semanticResult of semanticResults) {
    const match = scores.find(
      (score) => score.id === semanticResult.document.id
    );

    if (!match) {
      scores.push({
        id: semanticResult.document.id,
        keywordScore: 0,
        semanticScore: semanticResult.similarity,
        text: semanticResult.document.metadata.text,
        title: semanticResult.document.metadata.title,
      });
    }
  }

  const rankedScores = scores.map(
    (score) => ({
      ...score,
      rank: round(
        rank(score.keywordScore, score.semanticScore),
        4
      ),
    })
  );

  const sortedScores = sortBy(rankedScores, 'rank').reverse();

  if (limit) {
    return sortedScores.slice(0, limit);
  }

  return sortedScores;
};

export const keywordSearch = (
  keywordDatabase: MiniSearch,
  query: string,
  limit?: number,
): Score[] => {
  const keywordResults = findKeywordMatches(keywordDatabase, query);

  const scores = keywordResults.map((keywordResult) => ({
    id: keywordResult.id.toString(),
    rank: round(keywordResult.score, 4),
    text: keywordResult.text,
    title: keywordResult.title,
  }));

  if (limit) {
    return scores.slice(0, limit);
  }

  return scores;
};

// rank search result using reciprocal ranked fusion
export interface RankOptions {
  keywordWeight?: number;
  semanticWeight?: number;
  rrfK?: number;
}
export const RankOptionDefaults = {
  keywordWeight: 1,
  semanticWeight: 2,
  rrfK: 10,
};
export const rank = (
  keywordScore: number,
  semanticScore: number,
  rankOptions: RankOptions = RankOptionDefaults,
): number => {
  const keywordWeight = rankOptions.keywordWeight ?? RankOptionDefaults.keywordWeight;
  const semanticWeight = rankOptions.semanticWeight ?? RankOptionDefaults.semanticWeight;
  const rrfK = rankOptions.rrfK ?? RankOptionDefaults.rrfK;

  const ks = keywordScore
    ? 1 / (rrfK + keywordScore) * keywordWeight
    : 0;
  const ss = semanticScore
    ? 1 / (rrfK + semanticScore) * semanticWeight
    : 0;

  return 1 - (ks + ss);
};

export const search = async (
  keywordDatabase: MiniSearch,
  semanticDatabase: VectorDB,
  query: string,
  limit?: number,
): Promise<CombinedScore[]> => {
  const keywordResults = findKeywordMatches(keywordDatabase, query);
  const semanticResults = await findSemanticMatches(semanticDatabase, query);

  return getScores(keywordResults, semanticResults, limit);
};

export const semanticSearch = async (
  semanticDatabase: VectorDB,
  query: string,
  limit?: number,
): Promise<Score[]> => {
  const semanticResults = await findSemanticMatches(semanticDatabase, query);

  const scores = semanticResults.map((semanticResult) => ({
    id: semanticResult.document.id,
    rank: round(semanticResult.similarity, 4),
    text: semanticResult.document.metadata.text,
    title: semanticResult.document.metadata.title,
  }));

  if (limit) {
    return scores.slice(0, limit);
  }

  return scores;
};
