def i_ga(name: str) -> str:
    """받침이 있으면 '이', 없으면 '가' (마루와벽이 · 결도배가)"""
    last = name[-1:] or " "
    if "가" <= last <= "힣":
        return name + ("이" if (ord(last) - 0xAC00) % 28 else "가")
    return name + "이"
