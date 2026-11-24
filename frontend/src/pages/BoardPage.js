import markup from './board/markup.html?raw';
import { mountBoard } from './board/main.js';

export async function BoardPage() {
  return markup;
}

BoardPage.mount = mountBoard;
