import { v7 } from "uuid";

/** 主キー用のID（UUID v7。基本設計書 4.1） */
export const newId = (): string => v7();
