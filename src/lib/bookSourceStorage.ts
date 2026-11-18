/**
 * 단어장별 최신 사진(최대 2장) 및 페이지 인식 텍스트 영구/세션 보관 스토리지
 * - IndexedDB 우선 사용 (5MB 용량 제한 없이 단어장별로 고화질 사진 영구 보관)
 * - SessionStorage 안전 폴백 지원
 */

export interface BookSourceData {
  bookTitle: string;
  images: { base64: string; mimeType: string }[];
  ocrText: string;
  updatedAt?: number;
}

const DB_NAME = 'divivid_voca_source_db';
const DB_VERSION = 1;
const STORE_NAME = 'book_sources';

function openSourceDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event: any) => {
        const db: IDBDatabase = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'bookTitle' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => {
        console.warn('IndexedDB open error:', err);
        resolve(null);
      };
    } catch (e) {
      console.warn('IndexedDB not supported or blocked:', e);
      resolve(null);
    }
  });
}

function getSessionKey(bookTitle: string): string {
  const safe = encodeURIComponent((bookTitle || '기본 단어장').trim());
  return `context_vocab_source_book_${safe}`;
}

/**
 * 특정 단어장에 최신 사진(최대 2장) 및 추출 텍스트 저장
 */
export async function saveBookSourceData(
  bookTitle: string,
  images: { base64: string; mimeType: string }[],
  ocrText: string = ''
): Promise<void> {
  const safeTitle = (bookTitle || '기본 단어장').trim();
  const data: BookSourceData = {
    bookTitle: safeTitle,
    images: images.slice(-2), // 최신 2장까지만 보관
    ocrText,
    updatedAt: Date.now(),
  };

  // 1. IndexedDB 저장 시도 (대용량 고화질 사진 안전 보관)
  try {
    const db = await openSourceDB();
    if (db) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
      return;
    }
  } catch (err) {
    console.warn('IndexedDB save failed, falling back to sessionStorage:', err);
  }

  // 2. SessionStorage 폴백
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(getSessionKey(safeTitle), JSON.stringify(data));
    } catch {
      // 용량 초과 시 조용히 무시
    }
  }
}

/**
 * 특정 단어장의 저장된 최신 사진 및 텍스트 불러오기
 */
export async function loadBookSourceData(
  bookTitle: string
): Promise<BookSourceData | null> {
  const safeTitle = (bookTitle || '기본 단어장').trim();

  // 1. IndexedDB에서 조회 시도
  try {
    const db = await openSourceDB();
    if (db) {
      const result = await new Promise<BookSourceData | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(safeTitle);
        req.onsuccess = () => {
          resolve((req.result as BookSourceData) || null);
        };
        req.onerror = () => resolve(null);
      });

      if (result) return result;
    }
  } catch (err) {
    console.warn('IndexedDB load failed, trying session fallback:', err);
  }

  // 2. SessionStorage 폴백 조회
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(getSessionKey(safeTitle));
      if (raw) {
        return JSON.parse(raw) as BookSourceData;
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * 특정 단어장의 저장된 사진 및 텍스트 삭제 (초기화)
 */
export async function deleteBookSourceData(bookTitle: string): Promise<void> {
  const safeTitle = (bookTitle || '기본 단어장').trim();

  try {
    const db = await openSourceDB();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(safeTitle);
    }
  } catch {
    // ignore
  }

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(getSessionKey(safeTitle));
    } catch {}
  }
}

/**
 * 구버전 전역 사진 데이터가 sessionStorage에 남아있을 경우 현재 단어장으로 마이그레이션
 */
export async function migrateLegacySourceData(currentBookTitle: string): Promise<BookSourceData | null> {
  if (typeof window === 'undefined') return null;

  try {
    const legacyImagesStr = sessionStorage.getItem('context_vocab_source_images');
    const legacyOcrStr = localStorage.getItem('context_vocab_cached_page_ocr') || '';

    if (legacyImagesStr) {
      const parsedImages = JSON.parse(legacyImagesStr);
      if (Array.isArray(parsedImages) && parsedImages.length > 0) {
        await saveBookSourceData(currentBookTitle, parsedImages, legacyOcrStr);
        // 마이그레이션 후 레거시 키 정리
        sessionStorage.removeItem('context_vocab_source_images');
        sessionStorage.removeItem('context_vocab_source_image');
        return {
          bookTitle: currentBookTitle,
          images: parsedImages.slice(-2),
          ocrText: legacyOcrStr,
        };
      }
    }
  } catch {
    // ignore
  }

  return null;
}
