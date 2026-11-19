"""Términos estructurados de una entry PLACSP (CODICE) para el expediente.

Solo lee XML: documentos (PCAP/PPT/anexos/biblioteca), lotes, criterios de
adjudicación, solvencia/clasificación/declaraciones, garantías y plazos.
Sin DB ni red. Los textos libres de solvencia se copian tal cual; interpretar
el PDF queda fuera (fase IA, ADR aparte).
"""

from __future__ import annotations

from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from lxml import etree
from pydantic import BaseModel, Field

from efilicit_ingestion.connectors.placsp.parser import NS

MADRID = ZoneInfo("Europe/Madrid")

PliegoType = Literal["pcap", "ppt", "anexo", "otro"]
DocumentOrigin = Literal["legal", "technical", "additional", "general"]
CriterionKind = Literal["objetivo", "subjetivo"]
QualificationKind = Literal[
    "solvencia_tecnica",
    "solvencia_economica",
    "clasificacion",
    "declaracion",
]
GuaranteeKind = Literal["provisional", "definitiva", "complementaria", "otra"]

# GuaranteeTypeCode-1.04
_GUARANTEE_KINDS: dict[str, GuaranteeKind] = {
    "1": "provisional",
    "2": "definitiva",
    "3": "complementaria",
}


class OfferDocumentRef(BaseModel):
    origin: DocumentOrigin
    pliego_type: PliegoType
    title: str
    uri: str
    document_hash: str | None = None
    general_type_code: str | None = None

    @property
    def downloadable(self) -> bool:
        """Servlet FileSystem descarga directa; la biblioteca ``wcm`` la bloquea el WAF."""
        return "/FileSystem/servlet/" in self.uri

    @property
    def source_key(self) -> str:
        return f"doc:{self.origin}:{self.document_hash or self.uri}"


class OfferLot(BaseModel):
    lot_id: str
    name: str | None = None
    tax_exclusive_amount: float | None = None
    currency: str | None = None


class OfferAwardingCriterion(BaseModel):
    lot_id: str | None = None
    kind: CriterionKind
    description: str
    note: str | None = None
    weight: float | None = None
    position: int

    @property
    def source_key(self) -> str:
        return f"crit:{self.lot_id or '-'}:{self.position}"


class OfferQualification(BaseModel):
    lot_id: str | None = None
    kind: QualificationKind
    type_code: str | None = None
    description: str
    threshold: float | None = None
    position: int

    @property
    def source_key(self) -> str:
        return f"qual:{self.lot_id or '-'}:{self.kind}:{self.position}"


class OfferGuarantee(BaseModel):
    kind: GuaranteeKind
    type_code: str | None = None
    rate_percent: float | None = None
    amount: float | None = None
    position: int

    @property
    def source_key(self) -> str:
        return f"guar:{self.kind}:{self.position}"


class OfferIntakeExtract(BaseModel):
    contract_folder_id: str | None = None
    documents: list[OfferDocumentRef] = Field(default_factory=list)
    lots: list[OfferLot] = Field(default_factory=list)
    criteria: list[OfferAwardingCriterion] = Field(default_factory=list)
    qualifications: list[OfferQualification] = Field(default_factory=list)
    guarantees: list[OfferGuarantee] = Field(default_factory=list)
    submission_deadline_at: datetime | None = None
    documents_available_until: datetime | None = None


class OfferTermsParseError(Exception):
    """El RAW no es un Atom/entry PLACSP con ContractFolderStatus."""


def parse_offer_terms(raw: bytes) -> OfferIntakeExtract:
    """Extrae términos de la primera entry con ``ContractFolderStatus``."""
    try:
        root = etree.fromstring(raw)
    except etree.XMLSyntaxError as exc:
        raise OfferTermsParseError("invalid Atom XML") from exc

    status = root.find(".//cac_ext:ContractFolderStatus", NS)
    if status is None:
        raise OfferTermsParseError("missing ContractFolderStatus")

    return OfferIntakeExtract(
        contract_folder_id=_text(status.find("cbc:ContractFolderID", NS)),
        documents=_documents(status),
        lots=_lots(status),
        criteria=_criteria(status),
        qualifications=_qualifications(status),
        guarantees=_guarantees(status),
        submission_deadline_at=_period_end(
            status.find("cac:TenderingProcess/cac:TenderSubmissionDeadlinePeriod", NS)
        ),
        documents_available_until=_period_end(
            status.find("cac:TenderingProcess/cac:DocumentAvailabilityPeriod", NS)
        ),
    )


def _documents(status: etree._Element) -> list[OfferDocumentRef]:
    out: list[OfferDocumentRef] = []
    seen: set[str] = set()
    direct: list[tuple[str, DocumentOrigin, PliegoType]] = [
        ("cac:LegalDocumentReference", "legal", "pcap"),
        ("cac:TechnicalDocumentReference", "technical", "ppt"),
        ("cac:AdditionalDocumentReference", "additional", "anexo"),
    ]
    for path, origin, pliego_type in direct:
        for ref in status.findall(path, NS):
            uri = _text(ref.find("cac:Attachment/cac:ExternalReference/cbc:URI", NS))
            if not uri or uri in seen:
                continue
            seen.add(uri)
            out.append(
                OfferDocumentRef(
                    origin=origin,
                    pliego_type=pliego_type,
                    title=_text(ref.find("cbc:ID", NS)) or pliego_type.upper(),
                    uri=uri,
                    document_hash=_text(
                        ref.find(
                            "cac:Attachment/cac:ExternalReference/cbc:DocumentHash",
                            NS,
                        )
                    ),
                )
            )

    for ref in status.findall(
        "cac_ext:GeneralDocument/cac_ext:GeneralDocumentDocumentReference", NS
    ):
        ext = ref.find("cac:Attachment/cac:ExternalReference", NS)
        uri = _text(ext.find("cbc:URI", NS)) if ext is not None else None
        if not uri or uri in seen:
            continue
        seen.add(uri)
        title = (
            _text(ext.find("cbc:FileName", NS)) if ext is not None else None
        ) or _text(ref.find("cbc:ID", NS)) or "Documento"
        out.append(
            OfferDocumentRef(
                origin="general",
                pliego_type="anexo" if _looks_like_template(title) else "otro",
                title=title,
                uri=uri,
                general_type_code=_text(ref.find("cbc:DocumentTypeCode", NS)),
            )
        )
    return out


def _looks_like_template(title: str) -> bool:
    lowered = title.lower()
    return any(word in lowered for word in ("modelo", "anexo", "declaración", "declaracion"))


def _lots(status: etree._Element) -> list[OfferLot]:
    out: list[OfferLot] = []
    for lot in status.findall("cac:ProcurementProjectLot", NS):
        lot_id = _text(lot.find("cbc:ID", NS))
        if not lot_id:
            continue
        amount = lot.find("cac:ProcurementProject/cac:BudgetAmount/cbc:TaxExclusiveAmount", NS)
        out.append(
            OfferLot(
                lot_id=lot_id,
                name=_text(lot.find("cac:ProcurementProject/cbc:Name", NS)),
                tax_exclusive_amount=_number(amount),
                currency=amount.get("currencyID") if amount is not None else None,
            )
        )
    return out


def _terms_scopes(status: etree._Element) -> list[tuple[str | None, etree._Element]]:
    """Términos del expediente y, si los hay, los de cada lote."""
    scopes: list[tuple[str | None, etree._Element]] = []
    root_terms = status.find("cac:TenderingTerms", NS)
    if root_terms is not None:
        scopes.append((None, root_terms))
    for lot in status.findall("cac:ProcurementProjectLot", NS):
        terms = lot.find("cac:TenderingTerms", NS)
        lot_id = _text(lot.find("cbc:ID", NS))
        if terms is not None and lot_id:
            scopes.append((lot_id, terms))
    return scopes


def _criteria(status: etree._Element) -> list[OfferAwardingCriterion]:
    out: list[OfferAwardingCriterion] = []
    for lot_id, terms in _terms_scopes(status):
        for position, crit in enumerate(
            terms.findall("cac:AwardingTerms/cac:AwardingCriteria", NS), start=1
        ):
            description = _text(crit.find("cbc:Description", NS))
            if not description:
                continue
            code = (_text(crit.find("cbc:AwardingCriteriaTypeCode", NS)) or "").upper()
            out.append(
                OfferAwardingCriterion(
                    lot_id=lot_id,
                    kind="subjetivo" if code == "SUBJ" else "objetivo",
                    description=description,
                    note=_text(crit.find("cbc:Note", NS)),
                    weight=_number(crit.find("cbc:WeightNumeric", NS)),
                    position=position,
                )
            )
    return out


def _qualifications(status: etree._Element) -> list[OfferQualification]:
    out: list[OfferQualification] = []
    blocks: list[tuple[str, QualificationKind, str]] = [
        ("cac:TechnicalEvaluationCriteria", "solvencia_tecnica", "cbc:EvaluationCriteriaTypeCode"),
        ("cac:FinancialEvaluationCriteria", "solvencia_economica", "cbc:EvaluationCriteriaTypeCode"),
        ("cac:SpecificTendererRequirement", "declaracion", "cbc:RequirementTypeCode"),
    ]
    for lot_id, terms in _terms_scopes(status):
        request = terms.find("cac:TendererQualificationRequest", NS)
        if request is None:
            continue
        for path, kind, code_path in blocks:
            for position, node in enumerate(request.findall(path, NS), start=1):
                description = _text(node.find("cbc:Description", NS))
                if not description:
                    continue
                out.append(
                    OfferQualification(
                        lot_id=lot_id,
                        kind=kind,
                        type_code=_text(node.find(code_path, NS)),
                        description=description,
                        threshold=_number(node.find("cbc:ThresholdQuantity", NS)),
                        position=position,
                    )
                )
        for position, scheme in enumerate(
            request.findall("cac:RequiredBusinessClassificationScheme", NS), start=1
        ):
            codes = [
                code
                for code in (
                    _text(node)
                    for node in scheme.findall("cac:ClassificationCategory/cbc:CodeValue", NS)
                )
                if code
            ]
            if not codes:
                continue
            out.append(
                OfferQualification(
                    lot_id=lot_id,
                    kind="clasificacion",
                    description=f"Clasificación empresarial: {', '.join(codes)}",
                    position=position,
                )
            )
    return out


def _guarantees(status: etree._Element) -> list[OfferGuarantee]:
    out: list[OfferGuarantee] = []
    terms = status.find("cac:TenderingTerms", NS)
    if terms is None:
        return out
    for position, node in enumerate(
        terms.findall("cac:RequiredFinancialGuarantee", NS), start=1
    ):
        code = _text(node.find("cbc:GuaranteeTypeCode", NS))
        rate = _number(node.find("cbc:AmountRate", NS))
        amount = _number(node.find("cbc:LiabilityAmount", NS))
        if (rate is None or rate == 0) and (amount is None or amount == 0):
            continue
        out.append(
            OfferGuarantee(
                kind=_GUARANTEE_KINDS.get(code or "", "otra"),
                type_code=code,
                rate_percent=rate,
                amount=amount,
                position=position,
            )
        )
    return out


def _period_end(period: etree._Element | None) -> datetime | None:
    if period is None:
        return None
    end_date = _text(period.find("cbc:EndDate", NS))
    if not end_date:
        return None
    end_time = _text(period.find("cbc:EndTime", NS)) or "23:59:59"
    try:
        naive = datetime.fromisoformat(f"{end_date}T{end_time}")
    except ValueError:
        return None
    return naive.replace(tzinfo=MADRID)


def _number(node: etree._Element | None) -> float | None:
    value = _text(node)
    if value is None:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def _text(node: etree._Element | None) -> str | None:
    if node is None:
        return None
    value = (node.text or "").strip()
    return value or None
