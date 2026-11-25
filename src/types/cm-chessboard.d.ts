// cm-chessboard ships plain ES modules without type declarations.
declare module 'cm-chessboard/src/Chessboard.js' {
  export const COLOR: { white: 'w'; black: 'b' };
  export const BORDER_TYPE: { none: 'none'; thin: 'thin'; frame: 'frame' };
  export const INPUT_EVENT_TYPE: {
    moveInputStarted: 'moveInputStarted';
    movingOverSquare: 'movingOverSquare';
    validateMoveInput: 'validateMoveInput';
    moveInputCanceled: 'moveInputCanceled';
    moveInputFinished: 'moveInputFinished';
  };
  export class Chessboard {
    constructor(context: HTMLElement, props?: Record<string, unknown>);
    setPosition(fen: string, animated?: boolean): Promise<void>;
    setOrientation(color: 'w' | 'b', animated?: boolean): Promise<void>;
    addMarker(type: { class: string; slice: string }, square: string): void;
    removeMarkers(type?: unknown, square?: string): void;
    enableMoveInput(handler: (event: { type: string; squareFrom: string; squareTo?: string }) => boolean, color?: 'w' | 'b'): void;
    disableMoveInput(): void;
    destroy(): void;
  }
}
declare module 'cm-chessboard/src/extensions/markers/Markers.js' {
  export const Markers: unknown;
  export const MARKER_TYPE: Record<string, { class: string; slice: string }>;
}
