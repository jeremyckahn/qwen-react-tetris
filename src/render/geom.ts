import { COLS, VISIBLE_ROWS, VISIBLE_TOP } from '../engine/constants';

export const CELL = 32;
export const BOARD_W = COLS * CELL;
export const BOARD_H = VISIBLE_ROWS * CELL;

export const xOf = (col: number): number => col * CELL;
export const yOf = (row: number): number => (row - VISIBLE_TOP) * CELL;
