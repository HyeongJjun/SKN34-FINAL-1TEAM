"use client";
// 업체 도우미 칸을 왼쪽 재재 칸에 옮겨 그릴 자리(업체 작업 화면 Desk). 자리가 없으면 폼 안에 그대로 그려요.
import { createContext } from "react";

export const AssistSlot = createContext<HTMLElement | null>(null);
