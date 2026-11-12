// 견적서 · 공정표 단계 함수를 F 표에 넣는다
import { register } from "../engine";
import {
  bandWhy,
  buildPlan,
  buildQuote,
  ensureQuote,
  explainQuote,
  openPlanDoc,
  openQuoteDoc,
  quoteCheckCard,
  quoteStep,
  schedAgent,
  schedStep,
} from "./steps";

register({
  quoteStep,
  schedStep,
  openQuoteDoc,
  openPlanDoc,
  explainQuote,
  bandWhy,
  quoteCheckCard,
  schedAgent,
  buildQuote,
  buildPlan,
  ensureQuote,
});
