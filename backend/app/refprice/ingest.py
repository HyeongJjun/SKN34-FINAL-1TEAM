"""정형 CSV의 타입 변환. 원본 문자열은 행별 provenance에 그대로 보존한다."""

import re
from datetime import date
from decimal import Decimal, InvalidOperation

from sqlalchemy import BigInteger, Date, Integer, Numeric, SmallInteger

from app.refprice.models import FloorplanRow, ProductivityRow, UnitPriceRow, WageRow

MODELS = {
    "floorplan": FloorplanRow,
    "unit_price": UnitPriceRow,
    "productivity": ProductivityRow,
    "wage": WageRow,
}
# 파일명 대신 각 종류의 고유한 열 조합으로 분류한다.
SIGNATURES = {
    "floorplan": {"apartment_type", "quantity_item", "aggregation_role"},
    "unit_price": {"component_name", "basis_normalized_unit", "specification"},
    "productivity": {"division", "numeric_role", "table_column"},
    "wage": {"occupation_code", "publication_date", "basis_hours"},
}


def decimal_value(value: str) -> Decimal:
    try:
        result = Decimal(value)
    except InvalidOperation:
        raise ValueError("유효하지 않은 Decimal") from None
    if not result.is_finite():
        raise ValueError("유한한 수치가 필요해요")
    return result


def date_value(value: str) -> date:
    if re.fullmatch(r"\d{4}\.\d{1,2}\.\d{1,2}", value):
        return date(*(int(part) for part in value.split(".")))
    return date.fromisoformat(value)


def convert(kind: str, raw: dict[str, str]) -> dict:
    out = {
        "record_key": raw["id"],
        "parent_key": raw["parent_id"] or None,
        "dataset_kind": kind,
        "provenance": raw,
    }
    for col in MODELS[kind].__table__.columns:
        if col.name in {"dataset_id", "dataset_kind", "record_key", "parent_key", "provenance"}:
            continue
        value = raw[col.name]
        if value == "" and col.nullable:
            out[col.name] = None
        elif isinstance(col.type, Numeric):
            out[col.name] = decimal_value(value)
        elif isinstance(col.type, (Integer, SmallInteger, BigInteger)):
            number = decimal_value(value)
            if number != number.to_integral_value():
                raise ValueError("정수 열에 소수가 있어요")
            out[col.name] = int(number)
        elif isinstance(col.type, Date):
            out[col.name] = date_value(value)
        else:
            out[col.name] = value
    allowed = {
        "floorplan": {"page_context", "summary", "detail", "total", "conditional_total"},
        "unit_price": {"auxiliary_row", "work_header", "layout_row", "component", "total", "note"},
        "productivity": {"page_context", "table", "table_cell", "work_heading", "cross_reference"},
        "wage": {"page_context", "table", "table_cell", "occupation_wage", "occupation_definition"},
    }
    if out["record_type"] not in allowed[kind]:
        raise ValueError("알 수 없는 레코드 종류")
    for field in ("page", "table_row", "table_column"):
        if out.get(field) is not None and out[field] < 1:
            raise ValueError("페이지·행·열은 양수여야 해요")
    if (
        kind in {"floorplan", "wage"}
        and out["normalized_value"] is not None
        and out["normalized_value"] < 0
    ):
        raise ValueError("해당 자료의 음수는 스키마에서 허용하지 않아요")
    if kind == "wage":
        if out["basis_hours"] is not None and not 1 <= out["basis_hours"] <= 24:
            raise ValueError("근무시간 범위 오류")
        if out["survey_flag"] not in {None, "*", "**"}:
            raise ValueError("조사 표식 오류")
        if out["record_type"] == "occupation_wage" and (
            not out["occupation_code"]
            or out["publication_date"] is None
            or out["basis_hours"] is None
        ):
            raise ValueError("임금의 직종·공표일·근무시간이 필요해요")
    return out
