from app.agent.trades.base import TradeConfig

MOKGONG = TradeConfig(
    trade="mokgong",
    name="목공",
    # "방문"은 실측 방문과 겹쳐서 넣지 않는다
    symptom_words=("목공", "몰딩", "걸레받이", "문틀", "문짝", "평탄화", "석고보드", "테두리"),
    cautions=("목공을 도배보다 먼저 끝내요",),
    survey_vars=("몰딩 · 걸레받이 길이", "방문 개수 · 크기"),
    prep=("바꿀 방문 고르기",),
)
