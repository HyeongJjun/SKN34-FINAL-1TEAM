from app.agent.trades.base import TradeConfig

DOBAE = TradeConfig(
    trade="dobae",
    name="도배",
    symptom_words=("도배", "벽지", "합지", "실크", "초배", "누렇", "누래", "들뜸", "들떠", "얼룩")
    + ("곰팡이", "찢어", "낙서"),
    cautions=("천장 평탄화 · 몰딩 같은 목공이 끝난 뒤에 도배해요",),
    survey_vars=("벽 · 천장 면적", "기존 벽지 상태 (들뜸 · 곰팡이)"),
    prep=("벽 앞 가구 옮기기",),
)
