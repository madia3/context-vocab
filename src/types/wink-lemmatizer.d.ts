declare module 'wink-lemmatizer' {
  export function lemmatizeNoun(word: string): string;
  export function lemmatizeVerb(word: string): string;
  export function lemmatizeAdjective(word: string): string;
  export function noun(word: string): string;
  export function verb(word: string): string;
  export function adjective(word: string): string;

  const lemmatizer: {
    lemmatizeNoun: (word: string) => string;
    lemmatizeVerb: (word: string) => string;
    lemmatizeAdjective: (word: string) => string;
    noun: (word: string) => string;
    verb: (word: string) => string;
    adjective: (word: string) => string;
  };

  export default lemmatizer;
}
