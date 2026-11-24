import { getItem, setItem } from '../utils/storage.js';

export async function getBoard(boardId) {
  return getItem(`boards:${boardId}`);
}

export async function saveBoard(payload) {
  setItem(`boards:${payload.boardId}`, payload);
  return payload;
}
